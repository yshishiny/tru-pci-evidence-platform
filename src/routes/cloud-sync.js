const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { getDb } = require('../db');
const cloudSync = require('../cloud-sync');
const dropboxSync = require('../dropbox-sync');

const router = express.Router();

/**
 * GET /api/cloud-sync/status
 * Returns sync status (last sync time, total synced, errors)
 * Admin only
 */
router.get('/status', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { provider } = req.query;

    if (!provider || !['google_drive', 'dropbox'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider parameter' });
    }

    let status;
    if (provider === 'google_drive') {
      status = cloudSync.getSyncStatus(db);
    } else if (provider === 'dropbox') {
      status = dropboxSync.getSyncStatus(db);
    }

    res.json({ provider, status });
  } catch (err) {
    console.error('Get sync status error:', err);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * POST /api/cloud-sync/trigger
 * Triggers a full sync
 * Admin only
 */
router.post('/trigger', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { provider } = req.body;

    if (!provider || !['google_drive', 'dropbox'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider' });
    }

    // Get active config
    const config = db.prepare(`
      SELECT * FROM cloud_config WHERE provider = ? AND is_active = 1
    `).get(provider);

    if (!config) {
      return res.status(400).json({ error: `No active ${provider} configuration found` });
    }

    const configJson = JSON.parse(config.config_json);
    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';

    let stats;
    if (provider === 'google_drive') {
      // Initialize Drive client - use credentials_json if available, otherwise credentials_path
      const credentials = configJson.credentials_json || configJson.credentials_path;
      await cloudSync.initDriveClient(
        credentials,
        configJson.auth_type || 'service_account'
      );

      // Perform sync
      stats = await cloudSync.syncAllEvidence(db, evidenceDir, configJson.parent_folder_id);
    } else if (provider === 'dropbox') {
      // Initialize Dropbox client
      dropboxSync.initDropboxClient(configJson.access_token);

      // Perform sync
      stats = await dropboxSync.syncAllEvidence(db, evidenceDir, configJson.parent_path);
    }

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'sync_trigger', 'cloud', ?)
    `).run(req.user.id, req.user.username, `Triggered ${provider} sync`);

    res.json({ success: true, provider, stats });
  } catch (err) {
    console.error('Trigger sync error:', err);
    res.status(500).json({ error: 'Failed to trigger sync: ' + err.message });
  }
});

/**
 * GET /api/cloud-sync/config
 * Returns current config (without secrets)
 * Admin only
 */
router.get('/config', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { provider } = req.query;

    if (!provider || !['google_drive', 'dropbox'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider parameter' });
    }

    const config = db.prepare(`
      SELECT id, provider, is_active, updated_at FROM cloud_config WHERE provider = ?
    `).get(provider);

    if (!config) {
      return res.json({ provider, configured: false });
    }

    res.json({
      provider,
      configured: true,
      is_active: config.is_active === 1,
      updated_at: config.updated_at
    });
  } catch (err) {
    console.error('Get config error:', err);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

/**
 * POST /api/cloud-sync/config
 * Save Google Drive or Dropbox config
 * Admin only
 */
router.post('/config', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { provider, config_data, activate } = req.body;

    if (!provider || !['google_drive', 'dropbox'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider' });
    }

    if (!config_data) {
      return res.status(400).json({ error: 'config_data required' });
    }

    // Validate config based on provider
    if (provider === 'google_drive') {
      if (!config_data.parent_folder_id) {
        return res.status(400).json({
          error: 'Google Drive config requires parent_folder_id'
        });
      }
      // Accept either credentials_json (pasted JSON) or credentials_path (file path)
      if (!config_data.credentials_json && !config_data.credentials_path) {
        return res.status(400).json({
          error: 'Google Drive config requires credentials_json (paste service account JSON) or credentials_path (file path)'
        });
      }
      // If credentials_json is a string, validate it parses
      if (config_data.credentials_json && typeof config_data.credentials_json === 'string') {
        try {
          JSON.parse(config_data.credentials_json);
        } catch (e) {
          return res.status(400).json({ error: 'credentials_json is not valid JSON' });
        }
      }
    } else if (provider === 'dropbox') {
      if (!config_data.access_token || !config_data.parent_path) {
        return res.status(400).json({
          error: 'Dropbox config requires access_token and parent_path'
        });
      }
    }

    // Check if config exists
    const existing = db.prepare('SELECT id FROM cloud_config WHERE provider = ?').get(provider);

    const configJson = JSON.stringify(config_data);

    if (existing) {
      db.prepare(`
        UPDATE cloud_config
        SET config_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider = ?
      `).run(configJson, activate ? 1 : 0, provider);
    } else {
      db.prepare(`
        INSERT INTO cloud_config (provider, config_json, is_active, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(provider, configJson, activate ? 1 : 0);
    }

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'update_config', 'cloud', ?)
    `).run(req.user.id, req.user.username, `Updated ${provider} configuration`);

    res.json({
      success: true,
      provider,
      message: `${provider} configuration saved ${activate ? 'and activated' : ''}`
    });
  } catch (err) {
    console.error('Save config error:', err);
    res.status(500).json({ error: 'Failed to save configuration: ' + err.message });
  }
});

/**
 * GET /api/cloud-sync/link/:evidence_id
 * Returns the Google Drive/Dropbox link for a specific evidence file
 * Any authenticated user
 */
router.get('/link/:evidence_id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { evidence_id } = req.params;
    const { provider } = req.query;

    if (!provider || !['google_drive', 'dropbox'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider parameter' });
    }

    // Verify evidence exists
    const evidence = db.prepare('SELECT id FROM evidence_points WHERE id = ?').get(evidence_id);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    let syncRecord;
    if (provider === 'google_drive') {
      syncRecord = db.prepare(`
        SELECT drive_file_id, drive_link FROM drive_sync WHERE evidence_id = ?
      `).get(evidence_id);
    } else if (provider === 'dropbox') {
      syncRecord = db.prepare(`
        SELECT dropbox_path, dropbox_link FROM dropbox_sync WHERE evidence_id = ?
      `).get(evidence_id);
    }

    if (!syncRecord) {
      return res.status(404).json({
        error: `No ${provider} sync found for this evidence`
      });
    }

    if (provider === 'google_drive') {
      if (!syncRecord.drive_link) {
        return res.status(404).json({ error: 'No Drive link available' });
      }
      res.json({
        provider: 'google_drive',
        link: syncRecord.drive_link,
        file_id: syncRecord.drive_file_id
      });
    } else if (provider === 'dropbox') {
      if (!syncRecord.dropbox_link) {
        return res.status(404).json({ error: 'No Dropbox link available' });
      }
      res.json({
        provider: 'dropbox',
        link: syncRecord.dropbox_link,
        path: syncRecord.dropbox_path
      });
    }
  } catch (err) {
    console.error('Get link error:', err);
    res.status(500).json({ error: 'Failed to retrieve link' });
  }
});

module.exports = router;
