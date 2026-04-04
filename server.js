const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDbAsync, getDb } = require('./src/db');
const { scanFolders, syncToDb } = require('./src/scanner');
const { hashPassword } = require('./src/auth');

// Import routes
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const evidenceRoutes = require('./src/routes/evidence');
const commentsRoutes = require('./src/routes/comments');
const adminRoutes = require('./src/routes/admin');
const cloudSyncRoutes = require('./src/routes/cloud-sync');
const reportsRoutes = require('./src/routes/reports');
const reviewRoutes = require('./src/routes/review');
const alertsRoutes = require('./src/routes/alerts');
const commandCenterRoutes = require('./src/routes/command-center');

const app = express();
const PORT = process.env.PORT || 4500;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cloud-sync', cloudSyncRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/alerts', alertsRoutes);
// Command Center - public, no auth required, shareable URL
app.use('/command-center', commandCenterRoutes);

// SPA fallback (skip command-center and API routes)
app.get('*', (req, res) => {
  if (req.path.startsWith('/command-center') || req.path.startsWith('/api/')) return;
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    await initDbAsync();
    const db = getDb();

    // Seed default users if no users exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
      console.log('No users found. Seeding default users...');
      const defaultPwd = await hashPassword(process.env.DEFAULT_PASSWORD || 'Tru@PCI2026');
      const seedUsers = [
        ['yasser', 'Yasser Shishiny', 'admin', 'shishiny@gmail.com', ''],
        ['amr', 'Amr Abdelnasr', 'tru_team', '', '1,2,4,5'],
        ['tamer', 'Tamer Sherif', 'tru_team', '', '3,6,8'],
        ['ahmad', 'Ahmad Sayed', 'tru_team', '', '9,10,11'],
        ['iexpert_pm', 'iExpert PM', 'iexpert_pm', '', ''],
        ['iexpert_grc', 'iExpert GRC Team', 'iexpert_grc', '', ''],
        ['assessor', 'PCI QSA Assessor', 'assessor', '', '']
      ];
      const insertUser = db.prepare(`
        INSERT INTO users (username, password_hash, display_name, role, email, assigned_requirements, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `);
      for (const [uname, dname, role, email, assigned] of seedUsers) {
        insertUser.run(uname, defaultPwd, dname, role, email, assigned);
      }
      console.log(`Seeded ${seedUsers.length} default users.`);
    }

    // Skip automatic folder scan - DB is seeded from the original 172 EP tracker
    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
    const epCount = db.prepare('SELECT COUNT(*) as count FROM evidence_points').get().count;
    console.log(`Evidence directory: ${evidenceDir} | ${epCount} evidence points in database`);
    if (epCount === 0 && fs.existsSync(evidenceDir)) {
      console.log('Empty database detected - running initial folder scan...');
      const scanResults = scanFolders(evidenceDir);
      const stats = syncToDb(db, scanResults);
      console.log(`Scan complete: ${stats.inserted} inserted, ${stats.updated} updated`);
    }

    app.listen(PORT, () => {
      console.log(`TRU PCI DSS Evidence Platform server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
