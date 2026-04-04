const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getDb } = require('../db');

const router = express.Router();

// GET /:evidenceId - list comments for evidence point
router.get('/:evidenceId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { evidenceId } = req.params;

    // Verify evidence exists
    const evidence = db.prepare('SELECT id FROM evidence_points WHERE id = ?').get(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    const comments = db.prepare(`
      SELECT * FROM comments WHERE evidence_point_id = ?
      ORDER BY created_at DESC
    `).all(evidenceId);

    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to retrieve comments' });
  }
});

// POST /:evidenceId - add comment
router.post('/:evidenceId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { evidenceId } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text required' });
    }

    // Verify evidence exists
    const evidence = db.prepare('SELECT id FROM evidence_points WHERE id = ?').get(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence point not found' });
    }

    // Insert comment
    const stmt = db.prepare(`
      INSERT INTO comments (evidence_point_id, user_id, username, display_name, role, comment)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      evidenceId,
      req.user.id,
      req.user.username,
      req.user.display_name,
      req.user.role,
      comment.trim()
    );

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'add_comment', 'evidence', ?)
    `).run(req.user.id, req.user.username, `Added comment to evidence ${evidenceId}`);

    const newComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newComment);
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;
