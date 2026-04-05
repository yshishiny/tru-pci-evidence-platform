const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { getDb } = require('../db');

const router = express.Router();

// PCI DSS v4.0 Requirements
const REQUIREMENTS = [
  { id: 1, name: 'Install and Maintain Network Security Controls' },
  { id: 2, name: 'Apply Secure Configurations to Network Resources' },
  { id: 3, name: 'Protect Stored Account Data' },
  { id: 4, name: 'Protect Account Data in Transit' },
  { id: 5, name: 'Protect Systems and Networks from Malware' },
  { id: 6, name: 'Develop and Maintain Secure Systems and Applications' },
  { id: 7, name: 'Restrict Access to Account Data' },
  { id: 8, name: 'Identify and Authenticate Access' },
  { id: 9, name: 'Restrict Physical Access to Cardholder Data' },
  { id: 10, name: 'Log and Monitor Access to Network Resources' },
  { id: 11, name: 'Test Security of Systems and Networks' },
  { id: 12, name: 'Support Information Security with Organizational Processes' }
];

const IGNORE_FILES = ['desktop.ini', '.DS_Store', 'Thumbs.db', 'STATUS.md'];

/**
 * Get file count and names for an evidence point using actual evidence folder
 */
function getEvidenceFiles(evidenceId, folderPath) {
  const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
  const evidenceFolderPath = path.join(evidenceDir, folderPath || '');

  let fileCount = 0;
  let fileNames = [];

  if (fs.existsSync(evidenceFolderPath)) {
    try {
      const files = fs.readdirSync(evidenceFolderPath).filter(f => {
        try {
          return fs.statSync(path.join(evidenceFolderPath, f)).isFile() && !IGNORE_FILES.includes(f);
        } catch(e) { return false; }
      });
      fileCount = files.length;
      fileNames = files.slice(0, 10);
    } catch (err) {
      console.error(`Error reading files for evidence ${evidenceId}:`, err);
    }
  }

  return { fileCount, fileNames };
}

/**
 * Determine color code based on status
 */
function getStatusColor(hasFiles, status) {
  if (!hasFiles || status === 'empty') {
    return 'red'; // empty/missing
  }
  if (status === 'admin_approved' || status === 'assessor_approved') {
    return 'green'; // has files + reviewed
  }
  return 'yellow'; // has files, not reviewed
}

/**
 * GET /api/review/evidence - Get all evidence organized by requirement
 * Allowed roles: admin, iexpert_pm, iexpert_grc, assessor
 */
router.get('/evidence', requireAuth, (req, res) => {
  // Check role authorization
  const allowedRoles = ['admin', 'iexpert_pm', 'iexpert_grc', 'assessor'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const db = getDb();
    const { requirement_id, status, assignee } = req.query;

    // Build query
    let query = 'SELECT * FROM evidence_points WHERE 1=1';
    const params = [];

    if (requirement_id) {
      query += ' AND requirement_id = ?';
      params.push(parseInt(requirement_id, 10));
    }

    if (status === 'empty') {
      query += " AND status = 'empty'";
    } else if (status === 'filled') {
      query += " AND status != 'empty'";
    } else if (status === 'reviewed') {
      query += " AND status IN ('admin_approved', 'assessor_approved')";
    }

    if (assignee) {
      query += ' AND assigned_owner = ?';
      params.push(assignee);
    }

    query += ' ORDER BY requirement_id, folder_name';

    const results = db.prepare(query).all(...params);

    // Enhance with file info and color coding
    const enhanced = results.map(ep => {
      const { fileCount, fileNames } = getEvidenceFiles(ep.id, ep.folder_path);
      const hasFiles = fileCount > 0 || ep.status !== 'empty';
      const colorCode = getStatusColor(hasFiles, ep.status);

      return {
        ...ep,
        file_count: fileCount,
        file_names: fileNames,
        has_files: hasFiles,
        color_code: colorCode
      };
    });

    // Group by requirement
    const grouped = {};
    REQUIREMENTS.forEach(req => {
      grouped[req.id] = {
        requirement_id: req.id,
        requirement_name: req.name,
        evidence_points: enhanced.filter(e => e.requirement_id === req.id)
      };
    });

    // Calculate summary stats
    const summary = {
      total_items: enhanced.length,
      with_files: enhanced.filter(e => e.has_files).length,
      without_files: enhanced.filter(e => !e.has_files).length,
      reviewed: enhanced.filter(e => e.color_code === 'green').length,
      needs_review: enhanced.filter(e => e.color_code === 'yellow').length,
      empty: enhanced.filter(e => e.color_code === 'red').length,
      ready_to_sync: enhanced.filter(e => e.color_code !== 'red').length
    };

    res.json({
      summary,
      grouped,
      requirements: REQUIREMENTS
    });
  } catch (err) {
    console.error('Review evidence error:', err);
    res.status(500).json({ error: 'Failed to retrieve review data' });
  }
});

/**
 * POST /api/review/bulk-status - Bulk update evidence status
 * Role-based status restrictions:
 * - iexpert_pm: can set pm_approved or pm_revision
 * - iexpert_grc: can set grc_approved or grc_revision
 * - assessor: can set assessor_approved or assessor_rejected
 * - admin: can set any status
 */
router.post('/bulk-status', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { evidence_ids, status, action } = req.body;

    // Check role authorization
    const allowedRoles = ['admin', 'iexpert_pm', 'iexpert_grc', 'assessor'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!evidence_ids || !Array.isArray(evidence_ids) || evidence_ids.length === 0) {
      return res.status(400).json({ error: 'evidence_ids array is required' });
    }

    // Role-based status validation
    if (status) {
      const validStatuses = {
        'admin': ['admin_approved', 'assessor_approved', 'pm_approved', 'pm_revision', 'grc_approved', 'grc_revision', 'assessor_rejected', 'under_review', 'empty'],
        'iexpert_pm': ['pm_approved', 'pm_revision'],
        'iexpert_grc': ['grc_approved', 'grc_revision'],
        'assessor': ['assessor_approved', 'assessor_rejected']
      };

      const userValidStatuses = validStatuses[req.user.role] || [];
      if (!userValidStatuses.includes(status)) {
        return res.status(403).json({
          error: `Role ${req.user.role} cannot set status ${status}. Allowed statuses: ${userValidStatuses.join(', ')}`
        });
      }
    }

    if (action === 'mark_reviewed') {
      // Mark all as admin_approved (admin only)
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can use mark_reviewed action' });
      }
      const placeholders = evidence_ids.map(() => '?').join(',');
      const updateQuery = `
        UPDATE evidence_points
        SET status = 'admin_approved', updated_by = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})
      `;
      db.prepare(updateQuery).run(req.user.username, ...evidence_ids);
    } else if (action === 'flag_attention') {
      // Mark status as under_review (admin only)
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can use flag_attention action' });
      }
      const placeholders = evidence_ids.map(() => '?').join(',');
      const updateQuery = `
        UPDATE evidence_points
        SET status = 'under_review', updated_by = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})
      `;
      db.prepare(updateQuery).run(req.user.username, ...evidence_ids);
    } else if (status) {
      // Update to specific status (respects role-based restrictions)
      const placeholders = evidence_ids.map(() => '?').join(',');
      const updateQuery = `
        UPDATE evidence_points
        SET status = ?, updated_by = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})
      `;
      db.prepare(updateQuery).run(status, req.user.username, ...evidence_ids);
    } else {
      return res.status(400).json({ error: 'status or action parameter required' });
    }

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'bulk_status_update', 'evidence', ?)
    `).run(req.user.id, req.user.username, `Updated ${evidence_ids.length} evidence items, action: ${action || status}, role: ${req.user.role}`);

    res.json({
      success: true,
      updated_count: evidence_ids.length,
      action: action || status
    });
  } catch (err) {
    console.error('Bulk status update error:', err);
    res.status(500).json({ error: 'Failed to update evidence status' });
  }
});

/**
 * GET /api/review/files/:evidence_id - Get list of files for an evidence item
 * Enhanced with preview URLs, MIME types, and Google Drive links
 */
router.get('/files/:evidence_id', requireAuth, (req, res) => {
  try {
    // Check role authorization
    const allowedRoles = ['admin', 'iexpert_pm', 'iexpert_grc', 'assessor', 'tru_team'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const db = getDb();
    const evidenceId = req.params.evidence_id;

    // Get the evidence point to find its folder_path
    const ep = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(evidenceId);
    if (!ep) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    // Get comments for this evidence
    const comments = db.prepare(
      'SELECT * FROM comments WHERE evidence_point_id = ? ORDER BY created_at DESC'
    ).all(evidenceId);

    // Get Google Drive link if synced
    let driveLink = null;
    try {
      const driveSync = db.prepare(
        'SELECT drive_link FROM drive_sync WHERE evidence_id = ? ORDER BY last_synced DESC LIMIT 1'
      ).get(evidenceId);
      if (driveSync) driveLink = driveSync.drive_link;
    } catch (e) { /* drive_sync table may not exist yet */ }

    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
    const evidenceFolderPath = path.join(evidenceDir, ep.folder_path || '');
    const mime = require('mime-types');

    const files = [];

    if (fs.existsSync(evidenceFolderPath)) {
      try {
        const fileNames = fs.readdirSync(evidenceFolderPath).filter(f => {
          try { return fs.statSync(path.join(evidenceFolderPath, f)).isFile() && !IGNORE_FILES.includes(f); }
          catch(e) { return false; }
        });
        fileNames.forEach(fileName => {
          const filePath = path.join(evidenceFolderPath, fileName);
          const stats = fs.statSync(filePath);
          const mimeType = mime.lookup(fileName) || 'application/octet-stream';
          const ext = path.extname(fileName).toLowerCase().replace('.', '');

          // Determine if previewable inline
          const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
          const previewable = imageExts.includes(ext) || ext === 'pdf';

          files.push({
            name: fileName,
            size: stats.size,
            mime: mimeType,
            ext: ext,
            previewable: previewable,
            previewUrl: `/api/review/preview/${evidenceId}/${encodeURIComponent(fileName)}`,
            downloadUrl: `/api/review/download/${evidenceId}/${encodeURIComponent(fileName)}`
          });
        });
      } catch (err) {
        console.error(`Error reading files for evidence ${evidenceId}:`, err);
        return res.status(500).json({ error: 'Failed to read files' });
      }
    }

    res.json({
      evidence_id: evidenceId,
      evidence: {
        id: ep.id,
        requirement_id: ep.requirement_id,
        sub_requirement: ep.sub_requirement,
        folder_name: ep.folder_name,
        evidence_type: ep.evidence_type,
        status: ep.status,
        assigned_owner: ep.assigned_owner,
        updated_at: ep.updated_at,
        updated_by: ep.updated_by
      },
      files: files,
      file_count: files.length,
      comments: comments,
      drive_link: driveLink
    });
  } catch (err) {
    console.error('Get files error:', err);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

/**
 * GET /api/review/preview/:evidence_id/:filename - Serve file inline for preview
 */
router.get('/preview/:evidence_id/:filename', requireAuth, (req, res) => {
  try {
    const allowedRoles = ['admin', 'iexpert_pm', 'iexpert_grc', 'assessor', 'tru_team'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const db = getDb();
    const evidenceId = req.params.evidence_id;
    const filename = decodeURIComponent(req.params.filename);

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const ep = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(evidenceId);
    if (!ep) return res.status(404).json({ error: 'Evidence point not found' });

    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
    const filePath = path.join(evidenceDir, ep.folder_path || '', filename);
    const resolved = path.resolve(filePath);
    const baseResolved = path.resolve(evidenceDir);

    if (!resolved.startsWith(baseResolved)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const mime = require('mime-types');
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(resolved);
  } catch (err) {
    console.error('Preview file error:', err);
    res.status(500).json({ error: 'Failed to preview file' });
  }
});

/**
 * POST /api/review/comment/:evidence_id - Add a review comment
 */
router.post('/comment/:evidence_id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const evidenceId = req.params.evidence_id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const ep = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(evidenceId);
    if (!ep) return res.status(404).json({ error: 'Evidence point not found' });

    db.prepare(`
      INSERT INTO comments (evidence_point_id, user_id, username, display_name, role, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(evidenceId, req.user.id, req.user.username, req.user.display_name || req.user.username, req.user.role, text.trim());

    // Log audit
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'add_comment', 'evidence', ?)
    `).run(req.user.id, req.user.username, `Comment on evidence ${evidenceId}`);

    res.json({ success: true });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/review/download/:evidence_id/:filename - Download/preview a file
 */
router.get('/download/:evidence_id/:filename', requireAuth, (req, res) => {
  try {
    // Check role authorization
    const allowedRoles = ['admin', 'iexpert_pm', 'iexpert_grc', 'assessor'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const db = getDb();
    const evidenceId = req.params.evidence_id;
    const filename = decodeURIComponent(req.params.filename);

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Get the evidence point to find its folder_path
    const ep = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(evidenceId);
    if (!ep) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
    const filePath = path.join(evidenceDir, ep.folder_path, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Stream the file for download/preview
    res.download(filePath, filename);
  } catch (err) {
    console.error('Download file error:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * GET /api/review/summary - Get quick summary stats for review section
 */
router.get('/summary', requireAuth, (req, res) => {
  // Check role authorization
  const allowedRoles = ['admin', 'iexpert_pm', 'iexpert_grc', 'assessor'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const db = getDb();

    const totalResult = db.prepare('SELECT COUNT(*) as count FROM evidence_points').get();
    const emptyResult = db.prepare(
      "SELECT COUNT(*) as count FROM evidence_points WHERE status = 'empty'"
    ).get();
    const reviewedResult = db.prepare(
      "SELECT COUNT(*) as count FROM evidence_points WHERE status IN ('admin_approved', 'assessor_approved')"
    ).get();

    const total = totalResult.count;
    const empty = emptyResult.count;
    const reviewed = reviewedResult.count;
    const withFiles = total - empty;

    res.json({
      total,
      with_files: withFiles,
      without_files: empty,
      reviewed,
      needs_review: withFiles - reviewed,
      ready_to_sync: withFiles
    });
  } catch (err) {
    console.error('Review summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

module.exports = router;
