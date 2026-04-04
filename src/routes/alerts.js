const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { getDb } = require('../db');
const {
  getSMTPConfig,
  createTransporter,
  sendAlert,
  sendBulkAlerts
} = require('../email-alerts');

const router = express.Router();

/**
 * POST /api/alerts/config - Save SMTP configuration (admin only)
 */
router.post('/config', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { host, port, user, pass, from_email, secure } = req.body;

    if (!host || !port || !user || !pass || !from_email) {
      return res.status(400).json({
        error: 'host, port, user, pass, and from_email are required'
      });
    }

    // Validate SMTP config by attempting to create transporter
    const testConfig = {
      host,
      port: parseInt(port, 10),
      secure: secure === true || secure === 'true',
      auth: { user, pass }
    };

    try {
      // This will throw if config is invalid
      require('nodemailer').createTransport(testConfig);
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid SMTP configuration',
        details: err.message
      });
    }

    const configJson = JSON.stringify({
      host,
      port: parseInt(port, 10),
      secure: secure === true || secure === 'true',
      user,
      pass,
      from_email
    });

    // Check if config already exists
    const existing = db.prepare(
      "SELECT id FROM cloud_config WHERE provider = 'smtp'"
    ).get();

    if (existing) {
      db.prepare(
        "UPDATE cloud_config SET config_json = ?, is_active = 1, updated_at = datetime('now') WHERE provider = 'smtp'"
      ).run(configJson);
    } else {
      db.prepare(
        "INSERT INTO cloud_config (provider, config_json, is_active) VALUES ('smtp', ?, 1)"
      ).run(configJson);
    }

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'update_smtp_config', 'alerts', ?)
    `).run(req.user.id, req.user.username, 'Updated SMTP configuration');

    res.json({
      success: true,
      message: 'SMTP configuration saved successfully'
    });
  } catch (err) {
    console.error('Update SMTP config error:', err);
    res.status(500).json({ error: 'Failed to save SMTP configuration' });
  }
});

/**
 * GET /api/alerts/config - Get SMTP configuration (admin only, without password)
 */
router.get('/config', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const config = db.prepare(
      "SELECT config_json, is_active FROM cloud_config WHERE provider = 'smtp'"
    ).get();

    if (!config) {
      return res.json({
        configured: false,
        is_active: false
      });
    }

    const parsed = JSON.parse(config.config_json);

    // Remove password from response
    const safe = {
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      from_email: parsed.from_email,
      secure: parsed.secure,
      is_active: config.is_active === 1
    };

    res.json({
      configured: true,
      ...safe
    });
  } catch (err) {
    console.error('Get SMTP config error:', err);
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

/**
 * POST /api/alerts/send - Send alert to specific user (admin only)
 */
router.post('/send', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { recipient_email, recipient_name, evidence_ids, deadline } = req.body;

    if (!recipient_email || !recipient_name || !evidence_ids || !Array.isArray(evidence_ids)) {
      return res.status(400).json({
        error: 'recipient_email, recipient_name, and evidence_ids array are required'
      });
    }

    const db = getDb();

    // Get evidence details
    const placeholders = evidence_ids.map(() => '?').join(',');
    const evidenceItems = db.prepare(`
      SELECT id, requirement_id, folder_name, status
      FROM evidence_points
      WHERE id IN (${placeholders})
    `).all(...evidence_ids);

    if (evidenceItems.length === 0) {
      return res.status(404).json({ error: 'No evidence items found' });
    }

    try {
      const result = await sendAlert(
        recipient_email,
        recipient_name,
        evidenceItems,
        {
          deadline: deadline || '7 days',
          from_email: getSMTPConfig()?.from_email
        }
      );

      // Log audit entry
      db.prepare(`
        INSERT INTO audit_log (user_id, username, action, target, details)
        VALUES (?, ?, 'send_alert', 'alerts', ?)
      `).run(req.user.id, req.user.username, `Sent alert to ${recipient_email} for ${evidence_ids.length} items`);

      res.json({
        success: true,
        recipient: recipient_email,
        evidence_count: evidenceItems.length,
        message_id: result.message_id
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to send alert',
        details: err.message
      });
    }
  } catch (err) {
    console.error('Send alert error:', err);
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

/**
 * POST /api/alerts/send-bulk - Send alerts to all users with pending items (admin only)
 */
router.post('/send-bulk', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { deadline } = req.body;

    const results = await sendBulkAlerts({
      deadline: deadline || '7 days'
    });

    const db = getDb();

    // Count successful sends
    const successCount = results.filter(r => r.status === 'sent').length;

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'send_bulk_alerts', 'alerts', ?)
    `).run(req.user.id, req.user.username, `Sent bulk alerts to ${successCount} users`);

    res.json({
      success: true,
      total_users: results.length,
      sent: successCount,
      failed: results.filter(r => r.status === 'failed').length,
      results
    });
  } catch (err) {
    console.error('Bulk alert error:', err);
    res.status(500).json({
      error: 'Bulk alert failed',
      details: err.message
    });
  }
});

/**
 * GET /api/alerts/history - Get alert history (paginated)
 */
router.get('/history', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const total = db.prepare('SELECT COUNT(*) as count FROM alert_history').get().count;
    const history = db.prepare(`
      SELECT id, recipient_email, recipient_name, subject, sent_at, status
      FROM alert_history
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
      history,
      total,
      limit,
      offset,
      has_more: offset + limit < total
    });
  } catch (err) {
    console.error('Alert history error:', err);
    res.status(500).json({ error: 'Failed to retrieve alert history' });
  }
});

/**
 * GET /api/alerts/history/:id - Get specific alert details
 */
router.get('/history/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const alert = db.prepare(`
      SELECT * FROM alert_history WHERE id = ?
    `).get(req.params.id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const evidenceIds = alert.evidence_ids
      ? alert.evidence_ids.split(',').map(id => parseInt(id, 10))
      : [];

    let evidenceDetails = [];
    if (evidenceIds.length > 0) {
      const placeholders = evidenceIds.map(() => '?').join(',');
      evidenceDetails = db.prepare(`
        SELECT id, requirement_id, folder_name, status
        FROM evidence_points
        WHERE id IN (${placeholders})
      `).all(...evidenceIds);
    }

    res.json({
      ...alert,
      evidence_ids: evidenceIds,
      evidence_details: evidenceDetails
    });
  } catch (err) {
    console.error('Get alert detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve alert details' });
  }
});

module.exports = router;
