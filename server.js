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

// Evidence Reviewer - public, same live data as command center
app.get('/reviewer', (req, res) => {
  try {
    const templatePath = path.join(__dirname, 'public', 'evidence-reviewer.html');
    if (fs.existsSync(templatePath)) {
      let html = fs.readFileSync(templatePath, 'utf8');
      const { buildLiveData } = require('./src/routes/command-center');
      // buildLiveData isn't exported, so we use the same approach as command-center route
      const { getDb: getDatabase } = require('./src/db');
      const db = getDatabase();

      const REQUIREMENTS = [
        { id: 1, name: 'Network Security Controls' },{ id: 2, name: 'Secure Configurations' },
        { id: 3, name: 'Protect Stored Account Data' },{ id: 4, name: 'Protect Cardholder Data in Transit' },
        { id: 5, name: 'Protect Against Malicious Software' },{ id: 6, name: 'Develop and Maintain Secure Systems' },
        { id: 7, name: 'Restrict Access by Business Need' },{ id: 8, name: 'Identify Users and Authenticate Access' },
        { id: 9, name: 'Restrict Physical Access' },{ id: 10, name: 'Log and Monitor All Access' },
        { id: 11, name: 'Test Security Regularly' },{ id: 12, name: 'Support InfoSec with Policies and Programs' }
      ];
      const OWNERS = {
        'Amr Abdelnasr': { role: 'IT Infrastructure', reqs: [1,2,4,5], color: '#3b82f6' },
        'Tamer Sherif': { role: 'App Development', reqs: [3,6,8], color: '#8b5cf6' },
        'Ahmad Sayed': { role: 'Cyber Force / SOC', reqs: [9,10,11], color: '#10b981' },
        'Yasser Shishiny': { role: 'Project Lead', reqs: [7,12], color: '#f59e0b' }
      };

      const allEPs = db.prepare('SELECT * FROM evidence_points ORDER BY requirement_id, sub_requirement').all();
      const fileCounts = {};
      try {
        db.prepare('SELECT evidence_point_id, COUNT(*) as cnt, GROUP_CONCAT(file_name, \'||\') as names, SUM(file_size) as total_size FROM evidence_files GROUP BY evidence_point_id').all().forEach(row => {
          fileCounts[row.evidence_point_id] = { count: row.cnt, names: row.names ? row.names.split('||') : [], totalSize: row.total_size || 0 };
        });
      } catch(e) {}

      const evidencePoints = allEPs.map(ep => {
        const fc = fileCounts[ep.id] || { count: 0, names: [], totalSize: 0 };
        const hasFiles = ep.status !== 'empty';
        let owner = 'Unassigned';
        for (const [name, info] of Object.entries(OWNERS)) {
          if (info.reqs.includes(ep.requirement_id)) { owner = name; break; }
        }
        return {
          id: 'R' + ep.requirement_id + '-' + (ep.sub_requirement || ep.id),
          epId: ep.sub_requirement || String(ep.id), requirement: ep.requirement_id,
          folder: ep.folder_name || 'EP-' + ep.id, type: ep.evidence_type || 'document',
          hasFiles, files: fc.names.map(n => ({ name: n, size: 0, ext: path.extname(n).toLowerCase() })),
          fileCount: hasFiles ? Math.max(fc.count, 1) : 0, totalSize: fc.totalSize,
          owner, reviewStatus: 'pending'
        };
      });

      const requirements = REQUIREMENTS.map(req => {
        const eps = evidencePoints.filter(ep => ep.requirement === req.id);
        const filled = eps.filter(ep => ep.hasFiles).length;
        return { id: req.id, name: req.name, total: eps.length, filled, empty: eps.length - filled,
          percentage: eps.length > 0 ? Math.round((filled / eps.length) * 100) : 0 };
      });

      const totalEPs = evidencePoints.length, filledEPs = evidencePoints.filter(ep => ep.hasFiles).length;
      const data = {
        requirements, evidencePoints, owners: OWNERS,
        summary: { totalEPs, filledEPs, emptyEPs: totalEPs - filledEPs,
          percentage: totalEPs > 0 ? Math.round((filledEPs / totalEPs) * 100) : 0,
          reqsAt100: requirements.filter(r => r.percentage === 100).length }
      };

      html = html.replace('__DATA_PLACEHOLDER__', JSON.stringify(data));
      res.type('html').send(html);
    } else {
      res.status(404).send('Evidence reviewer template not found');
    }
  } catch(err) {
    console.error('Evidence reviewer error:', err);
    res.status(500).send('Error loading Evidence Reviewer');
  }
});

// Public rescan endpoint - rebuilds DB from seed-172.json
app.post('/api/rescan', (req, res) => {
  try {
    const db = getDb();
    const seedPath = path.join(__dirname, 'data', 'seed-172.json');
    if (!fs.existsSync(seedPath)) {
      return res.status(404).json({ error: 'seed-172.json not found' });
    }
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM evidence_points').run();
      const insertStmt = db.prepare(`
        INSERT INTO evidence_points (
          requirement_id, sub_requirement, folder_path, folder_name,
          evidence_type, status, has_original_doc, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      for (const ep of seedData) {
        insertStmt.run(
          ep.r || ep.requirement_id,
          ep.s || ep.sub_requirement || '',
          ep.p || ep.folder_path,
          ep.n || ep.folder_name,
          ep.t || ep.evidence_type || 'document',
          ep.st || ep.status || 'empty',
          ep.d !== undefined ? ep.d : (ep.has_original_doc !== undefined ? ep.has_original_doc : 0)
        );
      }
    });
    tx();
    const newCount = db.prepare('SELECT COUNT(*) as count FROM evidence_points').get().count;
    const uploaded = db.prepare("SELECT COUNT(*) as count FROM evidence_points WHERE status = 'uploaded'").get().count;
    res.json({ success: true, total: newCount, uploaded, empty: newCount - uploaded, message: `Reseeded ${newCount} evidence points from seed-172.json` });
  } catch (err) {
    console.error('Rescan error:', err);
    res.status(500).json({ error: 'Rescan failed: ' + err.message });
  }
});

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

    // Evidence seeding logic - use seed-172.json as source of truth (exactly 172 EPs)
    const evidenceDir = process.env.EVIDENCE_DIR || './data/evidence';
    const epCount = db.prepare('SELECT COUNT(*) as count FROM evidence_points').get().count;
    const seedPath = path.join(__dirname, 'data', 'seed-172.json');
    console.log(`Evidence directory: ${evidenceDir} | ${epCount} evidence points in database`);

    // Auto-fix: if DB has wrong EP count AND seed file exists, rebuild from seed
    if (fs.existsSync(seedPath)) {
      const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      const expectedCount = seedData.length; // Should be 172
      if (epCount !== expectedCount) {
        console.log(`EP count mismatch: DB has ${epCount}, expected ${expectedCount}. Rebuilding from seed...`);
        const tx = db.transaction(() => {
          db.prepare('DELETE FROM evidence_points').run();
          const insertStmt = db.prepare(`
            INSERT INTO evidence_points (
              requirement_id, sub_requirement, folder_path, folder_name,
              evidence_type, status, has_original_doc, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `);
          for (const ep of seedData) {
            insertStmt.run(
              ep.r || ep.requirement_id,
              ep.s || ep.sub_requirement || '',
              ep.p || ep.folder_path,
              ep.n || ep.folder_name,
              ep.t || ep.evidence_type || 'document',
              ep.st || ep.status || 'empty',
              ep.d !== undefined ? ep.d : (ep.has_original_doc !== undefined ? ep.has_original_doc : 0)
            );
          }
        });
        tx();
        const newCount = db.prepare('SELECT COUNT(*) as count FROM evidence_points').get().count;
        console.log(`Rebuild complete: ${newCount} evidence points seeded from seed-172.json`);
      } else {
        console.log(`EP count matches expected ${expectedCount}. No rebuild needed.`);
      }
    } else if (epCount === 0 && fs.existsSync(evidenceDir)) {
      console.log('Empty database, no seed file - running initial folder scan...');
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
