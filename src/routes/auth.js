const express = require('express');
const { hashPassword, verifyPassword, generateToken } = require('../auth');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { getDb } = require('../db');

const router = express.Router();

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'login', 'auth', 'User logged in')
    `).run(user.id, user.username);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        email: user.email,
        assigned_requirements: user.assigned_requirements ? user.assigned_requirements.split(',') : []
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /me
router.get('/me', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      email: user.email,
      assigned_requirements: user.assigned_requirements ? user.assigned_requirements.split(',') : []
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to retrieve user info' });
  }
});

// POST /register (admin only)
router.post('/register', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, display_name, role, email, assigned_requirements } = req.body;

    if (!username || !password || !display_name || !role) {
      return res.status(400).json({ error: 'Username, password, display_name, and role are required' });
    }

    const db = getDb();

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert new user
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
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;
