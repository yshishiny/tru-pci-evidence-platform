const express = require('express');
const { hashPassword } = require('../auth');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { getDb } = require('../db');
const { scanFolders, syncToDb } = require('../scanner');
const path = require('path');

const router = express.Router();

// GET /users - list all users
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT id, username, display_name, role, email, assigned_requirements, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    const formattedUsers = users.map(u => ({
      ...u,
      assigned_requirements: u.assigned_requirements ? u.assigned_requirements.split(',') : []
    }));

    res.json({ users: formattedUsers });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// POST /users - create user
router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, display_name, role, email, assigned_requirements } = req.body;

    if (!username || !password || !display_name || !role) {
      return res.status(400).json({ error: 'Username, password, display_name, and role are required' });
    }

    const db = getDb();

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert user
    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role, email, assigned_requirements)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      username,
      password_hash,
      display_name,
      role,
      email || null,
      assigned_requirements ? assigned_requirements.join(',') : null
    );

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'create_user', 'user', ?)
    `).run(req.user.id, req.user.username, `Created user ${username} with role ${role}`);

    res.status(201).json({
      id: result.lastInsertRowid,
      username,
      display_name,
      role,
      email,
      assigned_requirements: assigned_requirements || []
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /users/:id - update user
router.patch('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { display_name, role, email, assigned_requirements, is_active } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(display_name);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (assigned_requirements !== undefined) {
      updates.push('assigned_requirements = ?');
      values.push(assigned_requirements ? assigned_requirements.join(',') : null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...values);

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'update_user', 'user', ?)
    `).run(req.user.id, req.user.username, `Updated user ${id}`);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({
      id: updated.id,
      username: updated.username,
      display_name: updated.display_name,
      role: updated.role,
      email: updated.email,
      assigned_requirements: updated.assigned_requirements ? updated.assigned_requirements.split(',') : [],
      is_active: updated.is_active
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /scan - trigger folder re-scan
router.post('/scan', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';

    const scanResults = scanFolders(evidenceDir);
    const syncStats = syncToDb(db, scanResults);

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'scan_folders', 'evidence', ?)
    `).run(
      req.user.id,
      req.user.username,
      `Scanned folders: ${syncStats.inserted} inserted, ${syncStats.updated} updated`
    );

    res.json({
      success: true,
      scan_results: {
        total_folders: scanResults.length,
        inserted: syncStats.inserted,
        updated: syncStats.updated,
        errors: syncStats.errors
      }
    });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: 'Folder scan failed' });
  }
});

// GET /audit-log - list audit log entries (paginated)
router.get('/audit-log', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const total = db.prepare('SELECT COUNT(*) as count FROM audit_log').get().count;
    const entries = db.prepare(`
      SELECT * FROM audit_log
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
      entries,
      total,
      limit,
      offset,
      has_more: offset + limit < total
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

// POST /seed-evidence - bulk seed evidence points from JSON
router.post('/seed-evidence', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const { evidence_points } = req.body;

    if (!evidence_points || !Array.isArray(evidence_points)) {
      return res.status(400).json({ error: 'evidence_points array required' });
    }

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO evidence_points (
        requirement_id, sub_requirement, folder_path, folder_name,
        evidence_type, status, has_original_doc, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    let inserted = 0, skipped = 0;

    const tx = db.transaction(() => {
      for (const ep of evidence_points) {
        const status = ep.has_files ? 'uploaded' : 'empty';
        try {
          const result = insertStmt.run(
            ep.requirement_id,
            ep.sub_requirement || '',
            ep.folder_path,
            ep.folder_name,
            ep.evidence_type || 'document',
            status,
            ep.has_files ? 1 : 0
          );
          if (result.changes > 0) inserted++;
          else skipped++;
        } catch (e) {
          skipped++;
        }
      }
    });

    tx();

    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'seed_evidence', 'evidence', ?)
    `).run(req.user.id, req.user.username, `Seeded ${inserted} evidence points, ${skipped} skipped`);

    res.json({ success: true, inserted, skipped, total: evidence_points.length });
  } catch (err) {
    console.error('Seed evidence error:', err);
    res.status(500).json({ error: 'Failed to seed evidence points' });
  }
});

module.exports = router;
