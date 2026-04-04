const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { getDb } = require('../db');

const router = express.Router();

// Configure multer
const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const evidenceId = req.params.id;
    const dir = path.join(uploadDir, evidenceId.toString());
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const db = getDb();
    const evidence = db.prepare('SELECT file_version FROM evidence_points WHERE id = ?').get(req.params.id);
    const nextVersion = (evidence?.file_version || 0) + 1;
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `v${nextVersion}_${baseName}${ext}`);
  }
});

const upload = multer({ storage });

// GET / - list evidence points with filters
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { requirement_id, status, type, owner, search } = req.query;

    let query = 'SELECT * FROM evidence_points WHERE 1=1';
    const params = [];

    if (requirement_id) {
      query += ' AND requirement_id = ?';
      params.push(parseInt(requirement_id, 10));
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND evidence_type = ?';
      params.push(type);
    }

    if (owner) {
      query += ' AND assigned_owner = ?';
      params.push(owner);
    }

    if (search) {
      query += ' AND (folder_name LIKE ? OR sub_requirement LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY requirement_id, folder_name';

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    res.json({ evidence_points: results });
  } catch (err) {
    console.error('Evidence list error:', err);
    res.status(500).json({ error: 'Failed to retrieve evidence points' });
  }
});

// GET /:id - single evidence point with comments and versions
router.get('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const evidence = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(req.params.id);

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    const comments = db.prepare(
      'SELECT * FROM comments WHERE evidence_point_id = ? ORDER BY created_at DESC'
    ).all(req.params.id);

    const versions = db.prepare(
      'SELECT * FROM file_versions WHERE evidence_point_id = ? ORDER BY version DESC'
    ).all(req.params.id);

    res.json({
      evidence_point: evidence,
      comments,
      versions
    });
  } catch (err) {
    console.error('Get evidence error:', err);
    res.status(500).json({ error: 'Failed to retrieve evidence point' });
  }
});

// PATCH /:id/status - update status
router.patch('/:id/status', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    const evidence = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(req.params.id);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    // Check role-based permissions
    const allowed = [];
    const role = req.user.role;

    if (role === 'admin') {
      allowed.push('empty', 'uploaded', 'under_review', 'pm_approved', 'pm_revision',
        'grc_approved', 'grc_revision', 'admin_approved', 'assessor_approved', 'assessor_rejected');
    } else if (role === 'tru_team') {
      allowed.push('uploaded');
    } else if (role === 'iexpert_pm') {
      allowed.push('pm_approved', 'pm_revision', 'under_review');
    } else if (role === 'iexpert_grc') {
      allowed.push('grc_approved', 'grc_revision', 'under_review');
    } else if (role === 'assessor') {
      allowed.push('assessor_approved', 'assessor_rejected');
    }

    if (!allowed.includes(status)) {
      return res.status(403).json({ error: `Role ${role} cannot set status to ${status}` });
    }

    db.prepare(`
      UPDATE evidence_points
      SET status = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ?
    `).run(status, req.user.username, req.params.id);

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'update_status', 'evidence', ?)
    `).run(req.user.id, req.user.username, `Updated evidence ${req.params.id} to ${status}`);

    res.json({ success: true, status });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /:id/upload - upload file
router.post('/:id/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const db = getDb();
    const evidence = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(req.params.id);

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    // Check permissions
    const role = req.user.role;
    if (role === 'tru_team') {
      // Can only upload own assigned evidence
      if (evidence.assigned_owner && evidence.assigned_owner !== req.user.username) {
        return res.status(403).json({ error: 'Cannot upload to another user\'s evidence' });
      }
    } else if (!['iexpert_grc', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Your role cannot upload files' });
    }

    const nextVersion = (evidence.file_version || 0) + 1;

    // Create file_versions record
    db.prepare(`
      INSERT INTO file_versions (evidence_point_id, version, filename, original_name, uploaded_by, file_size, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      nextVersion,
      req.file.filename,
      req.file.originalname,
      req.user.username,
      req.file.size,
      req.file.mimetype
    );

    // Update evidence point
    db.prepare(`
      UPDATE evidence_points
      SET current_file = ?, file_version = ?, status = 'uploaded', updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ?
    `).run(req.file.filename, nextVersion, req.user.username, req.params.id);

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'upload_file', 'evidence', ?)
    `).run(req.user.id, req.user.username, `Uploaded file v${nextVersion} to evidence ${req.params.id}`);

    res.json({
      success: true,
      version: nextVersion,
      filename: req.file.filename,
      original_name: req.file.originalname
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// GET /:id/download/:version? - download file
router.get('/:id/download/:version?', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const evidence = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(req.params.id);

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    let fileVersion;
    if (req.params.version) {
      fileVersion = db.prepare(`
        SELECT * FROM file_versions WHERE evidence_point_id = ? AND version = ?
      `).get(req.params.id, parseInt(req.params.version, 10));
    } else {
      fileVersion = db.prepare(`
        SELECT * FROM file_versions WHERE evidence_point_id = ?
        ORDER BY version DESC LIMIT 1
      `).get(req.params.id);
    }

    if (!fileVersion) {
      return res.status(404).json({ error: 'File version not found' });
    }

    const filePath = path.join(uploadDir, req.params.id.toString(), fileVersion.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(filePath, fileVersion.original_name);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'File download failed' });
  }
});

// GET /:id/preview - serve file inline
router.get('/:id/preview', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const evidence = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(req.params.id);

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    const fileVersion = db.prepare(`
      SELECT * FROM file_versions WHERE evidence_point_id = ?
      ORDER BY version DESC LIMIT 1
    `).get(req.params.id);

    if (!fileVersion) {
      return res.status(404).json({ error: 'No file available' });
    }

    const filePath = path.join(uploadDir, req.params.id.toString(), fileVersion.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', fileVersion.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename=' + fileVersion.original_name);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: 'File preview failed' });
  }
});

// GET /:id/original-files - list original files in the evidence folder
router.get('/:id/original-files', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const evidence = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(req.params.id);
    if (!evidence) return res.status(404).json({ error: 'Evidence point not found' });

    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
    const fullPath = path.join(evidenceDir, evidence.folder_path);

    if (!fs.existsSync(fullPath)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(fullPath)
      .filter(f => !['desktop.ini', '.DS_Store', 'Thumbs.db'].includes(f))
      .filter(f => {
        const stat = fs.statSync(path.join(fullPath, f));
        return stat.isFile();
      })
      .map(f => {
        const stat = fs.statSync(path.join(fullPath, f));
        return {
          name: f,
          size: stat.size,
          mime: mime.lookup(f) || 'application/octet-stream',
          modified: stat.mtime
        };
      });

    res.json({ files, folder_path: evidence.folder_path });
  } catch (err) {
    console.error('Original files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// GET /:id/original-download/:filename - download original file from evidence folder
router.get('/:id/original-download/:filename', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const evidence = db.prepare('SELECT * FROM evidence_points WHERE id = ?').get(req.params.id);
    if (!evidence) return res.status(404).json({ error: 'Evidence point not found' });

    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
    const filePath = path.join(evidenceDir, evidence.folder_path, req.params.filename);

    // Security: ensure the resolved path is within the evidence dir
    const resolved = path.resolve(filePath);
    const baseResolved = path.resolve(evidenceDir);
    if (!resolved.startsWith(baseResolved)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
    res.sendFile(resolved);
  } catch (err) {
    console.error('Original download error:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

module.exports = router;
