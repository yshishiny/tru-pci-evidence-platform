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

/**
 * Get file count and names for an evidence point
 */
function getEvidenceFiles(evidenceId) {
  const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
  const evidenceUploadDir = path.join(uploadDir, evidenceId.toString());

  let fileCount = 0;
  let fileNames = [];

  if (fs.existsSync(evidenceUploadDir)) {
    try {
      const files = fs.readdirSync(evidenceUploadDir);
      fileCount = files.length;
      fileNames = files.slice(0, 10); // Limit to first 10 file names
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
 * GET /api/review/evidence - Get all evidence organized by requirement (admin only)
 */
router.get('/evidence', requireAuth, requireRole('admin'), (req, res) => {
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
      const { fileCount, fileNames } = getEvidenceFiles(ep.id);
      const hasFiles = fileCount > 0;
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
 * POST /api/review/bulk-status - Bulk update evidence status (admin only)
 */
router.post('/bulk-status', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { evidence_ids, status, action } = req.body;

    if (!evidence_ids || !Array.isArray(evidence_ids) || evidence_ids.length === 0) {
      return res.status(400).json({ error: 'evidence_ids array is required' });
    }

    if (action === 'mark_reviewed') {
      // Mark all as admin_approved
      const placeholders = evidence_ids.map(() => '?').join(',');
      const updateQuery = `
        UPDATE evidence_points
        SET status = 'admin_approved', updated_by = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})
      `;
      db.prepare(updateQuery).run(req.user.username, ...evidence_ids);
    } else if (action === 'flag_attention') {
      // Mark status as under_review
      const placeholders = evidence_ids.map(() => '?').join(',');
      const updateQuery = `
        UPDATE evidence_points
        SET status = 'under_review', updated_by = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})
      `;
      db.prepare(updateQuery).run(req.user.username, ...evidence_ids);
    } else if (status) {
      // Update to specific status
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
    `).run(req.user.id, req.user.username, `Updated ${evidence_ids.length} evidence items, action: ${action || status}`);

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
 * GET /api/review/summary - Get quick summary stats for review section
 */
router.get('/summary', requireAuth, requireRole('admin'), (req, res) => {
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
