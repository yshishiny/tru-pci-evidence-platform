const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { initDbAsync, getDb } = require('./src/db');
const { scanFolders, syncToDb } = require('./src/scanner');
const { hashPassword, verifyPassword, generateToken, verifyToken } = require('./src/auth');
const { portalAuth, portalAuthAPI } = require('./src/middleware/portalAuth');

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

// ---------- Security Middleware ----------
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Rate limiting for login endpoint (simple in-memory)
const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 min
  const maxAttempts = 10;

  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  if (now - record.firstAttempt > windowMs) {
    record.count = 0;
    record.firstAttempt = now;
  }
  record.count++;
  loginAttempts.set(ip, record);

  if (record.count > maxAttempts) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
  }
  next();
}

// Serve login page (public — no auth required)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Portal login API — authenticates and sets HTTP-only cookie
app.post('/api/portal/login', loginRateLimit, async (req, res) => {
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
      VALUES (?, ?, 'portal_login', 'auth', 'Portal login')
    `).run(user.id, user.username);

    // Set HTTP-only secure cookie (7 days)
    res.cookie('tru_portal_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    res.json({
      success: true,
      user: {
        username: user.username,
        display_name: user.display_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Portal login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify portal session (check if cookie is valid)
app.get('/api/portal/verify', (req, res) => {
  const token = req.cookies && req.cookies['tru_portal_token'];
  if (!token) return res.json({ authenticated: false });
  const decoded = verifyToken(token);
  if (!decoded) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { username: decoded.username, display_name: decoded.display_name, role: decoded.role } });
});

// Logout — clear cookie
app.post('/api/portal/logout', (req, res) => {
  res.clearCookie('tru_portal_token', { path: '/' });
  res.json({ success: true });
});

// Static files (CSS, JS, assets) — public
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
// Command Center — protected by portal auth
app.use('/command-center', portalAuth, commandCenterRoutes);

// IExperts Audit Portal — protected by portal auth
const iexpertsRoutes = require('./iexperts-route');
// Protect the HTML portal page
app.get('/iexperts', portalAuth);
// Protect the review API endpoints
app.post('/api/iexperts/review', portalAuthAPI);
app.use(iexpertsRoutes);

// Evidence Reviewer — protected by portal auth
app.get('/reviewer', portalAuth, (req, res) => {
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
      // Google Drive folder IDs for each requirement (under ! TRU PCI DSS - PROJECT HUB)
      const DRIVE_FOLDERS = {
        1: '1lndjtn4IBk_9rvtOgwhGS-oX8U-xCFiU',
        2: '1zPYU_1kgV1357stMGh-3VSDfIjV1yyYy',
        3: '1e11G3WvfRDIS7ydaUynaFVwCwX4t0qMk',
        4: '16HUAx87RTa5UsGE6qRAOg5ZVMHggKeqg',
        5: '16h7biZ4nHhnCxPYTF3a6a_a0EHV5Q86K',
        6: '1cO_l3re8OxksJ_VV6wW68VGc0yFG4H4R',
        7: '1RB8Ol_jEjfT9PWga9XL8nKZrpBD0G52F',
        8: '1fsDzxZdK5AzCGZj0qIViIfzg_YsNHeLX',
        9: '1JgqHbuUP95qCrKEIr9DHCdtTtNHMlgrt',
        10: '1x3GoZAXKZf2kxOHwFTnnmWO8ZyCNn36_',
        11: '1XpWiZSt1mwd8L1pOr04rNhUZg0BPakxE',
        12: '1tzMD1YM1m89IgFOCJv03p65i7A44ZcNE'
      };

      // IExperts review status (last updated 2026-04-08 from PCI-DSS Tracker v4.1)
      // s: approved|need_review|rejected|na|not_reviewed, c: reviewer comment
      const IE_REVIEWS = {"R1-1.1.1":{"s":"approved"},"R1-1.1.2":{"s":"approved"},"R1-1.2.1":{"s":"approved"},"R1-1.2.1/2":{"s":"approved"},"R1-1.2.2":{"s":"approved"},"R1-1.2.3":{"s":"need_review","c":"file empty"},"R1-1.2.3/2":{"s":"need_review","c":"file empty"},"R1-1.2.4":{"s":"need_review","c":"file empty"},"R1-1.2.5":{"s":"approved"},"R1-1.2.7":{"s":"rejected","c":"we need the configuration rules from ( firewall ,waf , ips,vpn , mfa ) , all of them in one documents"},"R1-1.2.8":{"s":"approved"},"R1-1.2.8/2":{"s":"na"},"R1-1.3.3":{"s":"approved"},"R1-1.3.3/2":{"s":"need_review","c":"file empty"},"R1-1.4.3":{"s":"need_review","c":"file empty"},"R1-1.4.5":{"s":"not_reviewed"},"R1-1.5.1":{"s":"na","c":"NA"},"R2-2.1.1":{"s":"not_reviewed"},"R2-2.1.1/2":{"s":"not_reviewed"},"R2-2.2.1":{"s":"not_reviewed"},"R2-2.3.1":{"s":"na"},"R3-3.1.2":{"s":"na"},"R3-3.2.1":{"s":"na"},"R3-3.2.1/2":{"s":"na"},"R3-3.2.1/3":{"s":"not_reviewed"},"R3-3.2.1/4":{"s":"na"},"R3-3.3.3":{"s":"na"},"R3-3.3.1.1":{"s":"na"},"R3-3.3.3/2":{"s":"na"},"R3-3.4.1":{"s":"na"},"R3-3.4.1/2":{"s":"na"},"R3-3.4.1.c":{"s":"na"},"R3-3.4.2":{"s":"not_reviewed"},"R3-3.5.1":{"s":"na"},"R3-3.5.1/2":{"s":"na"},"R3-3.5.1/3":{"s":"na"},"R3-3.5.1.1":{"s":"na"},"R3-3.5.1.2, 3.5.1.3":{"s":"na"},"R3-3.6.1.1":{"s":"na"},"R3-3.6.1.1/2":{"s":"na"},"R3-3.6.1.3":{"s":"na"},"R3-3.7.6":{"s":"na"},"R3-3.7.8":{"s":"na"},"R3-3.7.9":{"s":"na"},"R4-4.1.2":{"s":"na"},"R4-4.1.1":{"s":"na"},"R4-4.2.1":{"s":"na"},"R4-4.2.1.1":{"s":"na"},"R4-4.2.1.2":{"s":"na"},"R4-4.2.2":{"s":"na"},"R5-5.1.1":{"s":"not_reviewed"},"R5-5.1.2":{"s":"not_reviewed"},"R5-5.2.1":{"s":"not_reviewed"},"R5-5.2.2":{"s":"not_reviewed"},"R5-5.2.3":{"s":"not_reviewed"},"R5-5.2.3.1":{"s":"not_reviewed"},"R5-5.3.1":{"s":"not_reviewed"},"R5-5.3.2":{"s":"not_reviewed"},"R5-5.3.2.1":{"s":"not_reviewed"},"R5-5.3.3":{"s":"not_reviewed"},"R5-5.3.4":{"s":"not_reviewed"},"R5-5.3.5":{"s":"not_reviewed"},"R5-5.4.1":{"s":"not_reviewed"},"R6-6.1.1":{"s":"not_reviewed"},"R6-6.1.2":{"s":"not_reviewed"},"R6-6.2.1":{"s":"not_reviewed"},"R6-6.2.2":{"s":"not_reviewed"},"R6-6.2.3":{"s":"not_reviewed"},"R6-6.2.3.1":{"s":"not_reviewed"},"R6-6.3.1":{"s":"not_reviewed"},"R6-6.3.2":{"s":"not_reviewed"},"R6-6.3.3":{"s":"not_reviewed"},"R6-6.3.3/2":{"s":"not_reviewed"},"R6-6.4.1":{"s":"not_reviewed"},"R6-6.4.2":{"s":"not_reviewed"},"R6-6.4.2/2":{"s":"not_reviewed"},"R6-6.4.3a":{"s":"na"},"R6-6.4.3b":{"s":"na"},"R6-6.4.3c":{"s":"na"},"R6-6.4.3d":{"s":"na"},"R6-6.5.1a":{"s":"not_reviewed"},"R6-6.5.5":{"s":"not_reviewed"},"R6-6.5.6":{"s":"not_reviewed"},"R7-7.1.1":{"s":"not_reviewed"},"R7-7.1.2":{"s":"na"},"R7-7.2.2b":{"s":"not_reviewed"},"R7-7.2.4":{"s":"not_reviewed"},"R7-7.2.5.1a":{"s":"not_reviewed"},"R7-7.2.5.1b":{"s":"not_reviewed"},"R7-7.2.4b":{"s":"not_reviewed"},"R8-8.1.2":{"s":"not_reviewed"},"R8-8.2.4":{"s":"not_reviewed"},"R8-8.4.2":{"s":"not_reviewed"},"R8-8.3.6":{"s":"not_reviewed"},"R8-8.3.6/2":{"s":"not_reviewed"},"R8-8.3.6/3":{"s":"not_reviewed"},"R8-8.2.5":{"s":"not_reviewed"},"R8-8.3.2":{"s":"not_reviewed"},"R8-8.1.1":{"s":"not_reviewed"},"R8-8.4.2/2":{"s":"not_reviewed"},"R8-8.5.1":{"s":"not_reviewed"},"R8-8.6.3":{"s":"not_reviewed"},"R8-8.3.6/4":{"s":"not_reviewed"},"R9-9.1.1, 9.2.1, 9.3.1":{"s":"not_reviewed"},"R9-9.2.1.1":{"s":"not_reviewed"},"R9-9.3.1.1":{"s":"not_reviewed"},"R9-9.2.1.1/2":{"s":"not_reviewed"},"R9-9.2.1.1/3":{"s":"not_reviewed"},"R9-9.1.2":{"s":"na"},"R9-9.3.2":{"s":"not_reviewed"},"R9-9.4.1.1":{"s":"not_reviewed"},"R9-9.4.3":{"s":"na"},"R9-9.4.7":{"s":"not_reviewed"},"R9-9.5.1.2":{"s":"na"},"R9-9.4.5.1":{"s":"not_reviewed"},"R9-9.5.1.3":{"s":"na"},"R9-9.5.1.3/2":{"s":"na"},"R9-9.5.1.3/3":{"s":"not_reviewed"},"R10-10.1.2":{"s":"na"},"R10-10.4.1.1":{"s":"not_reviewed"},"R10-10.4.2.1":{"s":"not_reviewed"},"R10-10.3.1":{"s":"not_reviewed"},"R10-10.3":{"s":"not_reviewed"},"R10-10.1":{"s":"not_reviewed"},"R10-10.5":{"s":"not_reviewed"},"R10-10.6":{"s":"not_reviewed"},"R10-10.6/2":{"s":"not_reviewed"},"R10-10.7":{"s":"not_reviewed"},"R10-10.7/2":{"s":"not_reviewed"},"R10-10.7/3":{"s":"not_reviewed"},"R10-10.7/4":{"s":"not_reviewed"},"R10-10.7/5":{"s":"not_reviewed"},"R10-10.7/6":{"s":"not_reviewed"},"R9-9.4.1":{"s":"not_reviewed"},"R11-11.1.2":{"s":"approved"},"R11-11.1.1":{"s":"approved"},"R11-11.2.1":{"s":"na"},"R11-11.2.2":{"s":"approved"},"R11-11.2.1.c":{"s":"na"},"R11-11.2.1.d":{"s":"na"},"R11-11.3.1":{"s":"need_review"},"R11-11.3.1.1":{"s":"approved"},"R11-11.3.1.2.d":{"s":"approved"},"R11-11.3.2":{"s":"need_review"},"R11-11.4.2":{"s":"need_review"},"R11-11.4.3":{"s":"need_review"},"R11-11.4.6":{"s":"need_review"},"R11-11.5.1":{"s":"need_review"},"R11-11.5.1.1":{"s":"need_review"},"R11-11.5.2":{"s":"need_review","c":"fill in the document"},"R11-11.6.1":{"s":"na"},"R11-11.6.1/2":{"s":"na"},"R12-12.1.1":{"s":"approved"},"R12-12.2.1":{"s":"approved"},"R12-12.3.1":{"s":"approved"},"R12-12.3.2":{"s":"approved"},"R12-12.3.3":{"s":"na"},"R12-12.3.4":{"s":"approved"},"R12-12.4.2":{"s":"approved"},"R12-12.5.2":{"s":"need_review","c":"pls fill in the files with all the required"},"R12-12.6.1":{"s":"approved"},"R12-12.6.3":{"s":"approved"},"R12-12.7.1":{"s":"need_review","c":"I need a real sample for any employee joined from HR department"},"R12-12.8.1":{"s":"approved"},"R12-12.8.2":{"s":"need_review","c":"Provide screenshots or copies of signed agreements with all TPSPs"},"R12-12.8.3.b":{"s":"need_review","c":"does not provide a completed sample due diligence assessment for a TPSP"},"R12-12.3.4/2":{"s":"approved"},"R12-12.8.5":{"s":"approved"},"R12-12.10.1":{"s":"approved"},"R12-12.10.2":{"s":"approved"},"R12-12.10.4.1":{"s":"na"},"R12-12.10.7":{"s":"na"}};

      const allEPs = db.prepare('SELECT * FROM evidence_points ORDER BY requirement_id, sub_requirement').all();
      const fileCounts = {};
      try {
        db.prepare('SELECT evidence_point_id, COUNT(*) as cnt, GROUP_CONCAT(file_name, \'||\') as names, SUM(file_size) as total_size FROM evidence_files GROUP BY evidence_point_id').all().forEach(row => {
          fileCounts[row.evidence_point_id] = { count: row.cnt, names: row.names ? row.names.split('||') : [], totalSize: row.total_size || 0 };
        });
      } catch(e) {}

      // Track duplicate sub_requirements per requirement for IE_REVIEWS key matching
      const subReqCounts = {};
      const evidencePoints = allEPs.map(ep => {
        const fc = fileCounts[ep.id] || { count: 0, names: [], totalSize: 0 };
        const hasFiles = ep.status !== 'empty';
        let owner = 'Unassigned';
        for (const [name, info] of Object.entries(OWNERS)) {
          if (info.reqs.includes(ep.requirement_id)) { owner = name; break; }
        }
        const driveFolderId = DRIVE_FOLDERS[ep.requirement_id] || '';
        const driveUrl = driveFolderId ? 'https://drive.google.com/drive/folders/' + driveFolderId : '';
        // Build IE_REVIEWS key with duplicate handling
        const baseKey = 'R' + ep.requirement_id + '-' + (ep.sub_requirement || ep.id);
        subReqCounts[baseKey] = (subReqCounts[baseKey] || 0) + 1;
        const ieKey = subReqCounts[baseKey] > 1 ? baseKey + '/' + subReqCounts[baseKey] : baseKey;
        const ieReview = IE_REVIEWS[ieKey] || { s: 'not_reviewed' };
        return {
          id: ieKey,
          epId: ep.sub_requirement || String(ep.id), requirement: ep.requirement_id,
          folder: ep.folder_name || 'EP-' + ep.id, type: ep.evidence_type || 'document',
          hasFiles, files: fc.names.map(n => ({ name: n, size: 0, ext: path.extname(n).toLowerCase() })),
          fileCount: hasFiles ? Math.max(fc.count, 1) : 0, totalSize: fc.totalSize,
          owner, reviewStatus: 'pending', driveUrl,
          ieStatus: ieReview.s, ieComment: ieReview.c || ''
        };
      });

      const requirements = REQUIREMENTS.map(req => {
        const eps = evidencePoints.filter(ep => ep.requirement === req.id);
        const filled = eps.filter(ep => ep.hasFiles).length;
        const ieApproved = eps.filter(ep => ep.ieStatus === 'approved').length;
        const ieReviewed = eps.filter(ep => ['approved','need_review','rejected'].includes(ep.ieStatus)).length;
        const driveFolderId = DRIVE_FOLDERS[req.id] || '';
        const driveUrl = driveFolderId ? 'https://drive.google.com/drive/folders/' + driveFolderId : '';
        return { id: req.id, name: req.name, total: eps.length, filled, empty: eps.length - filled,
          percentage: eps.length > 0 ? Math.round((filled / eps.length) * 100) : 0, driveUrl,
          ieApproved, ieReviewed };
      });

      const totalEPs = evidencePoints.length, filledEPs = evidencePoints.filter(ep => ep.hasFiles).length;
      const ieApprovedTotal = evidencePoints.filter(ep => ep.ieStatus === 'approved').length;
      const ieReviewedTotal = evidencePoints.filter(ep => ['approved','need_review','rejected'].includes(ep.ieStatus)).length;
      const data = {
        requirements, evidencePoints, owners: OWNERS,
        summary: { totalEPs, filledEPs, emptyEPs: totalEPs - filledEPs,
          percentage: totalEPs > 0 ? Math.round((filledEPs / totalEPs) * 100) : 0,
          reqsAt100: requirements.filter(r => r.percentage === 100).length,
          ieApproved: ieApprovedTotal, ieReviewed: ieReviewedTotal,
          ieApprovedPct: totalEPs > 0 ? Math.round((ieApprovedTotal / totalEPs) * 100) : 0 }
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

// Rescan endpoint — protected (rebuilds DB from seed-172.json)
app.post('/api/rescan', portalAuthAPI, (req, res) => {
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

// Remote seed endpoint - accepts seed data via POST body and rebuilds DB
// This allows updating evidence data without redeploying
app.post('/api/remote-seed', (req, res) => {
  try {
    const key = req.headers['x-seed-key'] || req.query.key;
    if (key !== (process.env.SEED_KEY || 'tru-pci-2026')) {
      return res.status(403).json({ error: 'Invalid seed key' });
    }
    const seedData = req.body;
    if (!Array.isArray(seedData) || seedData.length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty JSON array of evidence points' });
    }
    const db = getDb();
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
    // Also save as the new seed file for future rescans
    fs.writeFileSync(path.join(__dirname, 'data', 'seed-172.json'), JSON.stringify(seedData, null, 1));
    const newCount = db.prepare('SELECT COUNT(*) as count FROM evidence_points').get().count;
    const uploaded = db.prepare("SELECT COUNT(*) as count FROM evidence_points WHERE status = 'uploaded'").get().count;
    res.json({ success: true, total: newCount, uploaded, empty: newCount - uploaded,
      message: `Remote seed complete: ${newCount} evidence points (${uploaded} uploaded, ${newCount - uploaded} empty)` });
  } catch (err) {
    console.error('Remote seed error:', err);
    res.status(500).json({ error: 'Remote seed failed: ' + err.message });
  }
});

// CEO Dashboard — protected by portal auth
app.get('/ceo', portalAuth, (req, res) => {
  try {
    const templatePath = path.join(__dirname, 'public', 'ceo-dashboard.html');
    if (fs.existsSync(templatePath)) {
      let html = fs.readFileSync(templatePath, 'utf8');
      const db = getDb();

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

      // IExperts review data — FULL 172 EP reviews (synced from /reviewer route)
      const IE_REVIEWS_CEO = {"R1-1.1.1":{"s":"approved"},"R1-1.1.2":{"s":"approved"},"R1-1.2.1":{"s":"approved"},"R1-1.2.1/2":{"s":"approved"},"R1-1.2.2":{"s":"approved"},"R1-1.2.3":{"s":"need_review","c":"file empty"},"R1-1.2.3/2":{"s":"need_review","c":"file empty"},"R1-1.2.4":{"s":"need_review","c":"file empty"},"R1-1.2.5":{"s":"approved"},"R1-1.2.7":{"s":"rejected","c":"we need the configuration rules from ( firewall ,waf , ips,vpn , mfa ) , all of them in one documents"},"R1-1.2.8":{"s":"approved"},"R1-1.2.8/2":{"s":"na"},"R1-1.3.3":{"s":"approved"},"R1-1.3.3/2":{"s":"need_review","c":"file empty"},"R1-1.4.3":{"s":"need_review","c":"file empty"},"R1-1.4.5":{"s":"not_reviewed"},"R1-1.5.1":{"s":"na","c":"NA"},"R2-2.1.1":{"s":"not_reviewed"},"R2-2.1.1/2":{"s":"not_reviewed"},"R2-2.2.1":{"s":"not_reviewed"},"R2-2.3.1":{"s":"na"},"R3-3.1.2":{"s":"na"},"R3-3.2.1":{"s":"na"},"R3-3.2.1/2":{"s":"na"},"R3-3.2.1/3":{"s":"not_reviewed"},"R3-3.2.1/4":{"s":"na"},"R3-3.3.3":{"s":"na"},"R3-3.3.1.1":{"s":"na"},"R3-3.3.3/2":{"s":"na"},"R3-3.4.1":{"s":"na"},"R3-3.4.1/2":{"s":"na"},"R3-3.4.1.c":{"s":"na"},"R3-3.4.2":{"s":"not_reviewed"},"R3-3.5.1":{"s":"na"},"R3-3.5.1/2":{"s":"na"},"R3-3.5.1/3":{"s":"na"},"R3-3.5.1.1":{"s":"na"},"R3-3.5.1.2, 3.5.1.3":{"s":"na"},"R3-3.6.1.1":{"s":"na"},"R3-3.6.1.1/2":{"s":"na"},"R3-3.6.1.3":{"s":"na"},"R3-3.7.6":{"s":"na"},"R3-3.7.8":{"s":"na"},"R3-3.7.9":{"s":"na"},"R4-4.1.2":{"s":"na"},"R4-4.1.1":{"s":"na"},"R4-4.2.1":{"s":"na"},"R4-4.2.1.1":{"s":"na"},"R4-4.2.1.2":{"s":"na"},"R4-4.2.2":{"s":"na"},"R5-5.1.1":{"s":"not_reviewed"},"R5-5.1.2":{"s":"not_reviewed"},"R5-5.2.1":{"s":"not_reviewed"},"R5-5.2.2":{"s":"not_reviewed"},"R5-5.2.3":{"s":"not_reviewed"},"R5-5.2.3.1":{"s":"not_reviewed"},"R5-5.3.1":{"s":"not_reviewed"},"R5-5.3.2":{"s":"not_reviewed"},"R5-5.3.2.1":{"s":"not_reviewed"},"R5-5.3.3":{"s":"not_reviewed"},"R5-5.3.4":{"s":"not_reviewed"},"R5-5.3.5":{"s":"not_reviewed"},"R5-5.4.1":{"s":"not_reviewed"},"R6-6.1.1":{"s":"not_reviewed"},"R6-6.1.2":{"s":"not_reviewed"},"R6-6.2.1":{"s":"not_reviewed"},"R6-6.2.2":{"s":"not_reviewed"},"R6-6.2.3":{"s":"not_reviewed"},"R6-6.2.3.1":{"s":"not_reviewed"},"R6-6.3.1":{"s":"not_reviewed"},"R6-6.3.2":{"s":"not_reviewed"},"R6-6.3.3":{"s":"not_reviewed"},"R6-6.3.3/2":{"s":"not_reviewed"},"R6-6.4.1":{"s":"not_reviewed"},"R6-6.4.2":{"s":"not_reviewed"},"R6-6.4.2/2":{"s":"not_reviewed"},"R6-6.4.3a":{"s":"na"},"R6-6.4.3b":{"s":"na"},"R6-6.4.3c":{"s":"na"},"R6-6.4.3d":{"s":"na"},"R6-6.5.1a":{"s":"not_reviewed"},"R6-6.5.5":{"s":"not_reviewed"},"R6-6.5.6":{"s":"not_reviewed"},"R7-7.1.1":{"s":"not_reviewed"},"R7-7.1.2":{"s":"na"},"R7-7.2.2b":{"s":"not_reviewed"},"R7-7.2.4":{"s":"not_reviewed"},"R7-7.2.5.1a":{"s":"not_reviewed"},"R7-7.2.5.1b":{"s":"not_reviewed"},"R7-7.2.4b":{"s":"not_reviewed"},"R8-8.1.2":{"s":"not_reviewed"},"R8-8.2.4":{"s":"not_reviewed"},"R8-8.4.2":{"s":"not_reviewed"},"R8-8.3.6":{"s":"not_reviewed"},"R8-8.3.6/2":{"s":"not_reviewed"},"R8-8.3.6/3":{"s":"not_reviewed"},"R8-8.2.5":{"s":"not_reviewed"},"R8-8.3.2":{"s":"not_reviewed"},"R8-8.1.1":{"s":"not_reviewed"},"R8-8.4.2/2":{"s":"not_reviewed"},"R8-8.5.1":{"s":"not_reviewed"},"R8-8.6.3":{"s":"not_reviewed"},"R8-8.3.6/4":{"s":"not_reviewed"},"R9-9.1.1, 9.2.1, 9.3.1":{"s":"not_reviewed"},"R9-9.2.1.1":{"s":"not_reviewed"},"R9-9.3.1.1":{"s":"not_reviewed"},"R9-9.2.1.1/2":{"s":"not_reviewed"},"R9-9.2.1.1/3":{"s":"not_reviewed"},"R9-9.1.2":{"s":"na"},"R9-9.3.2":{"s":"not_reviewed"},"R9-9.4.1.1":{"s":"not_reviewed"},"R9-9.4.3":{"s":"na"},"R9-9.4.7":{"s":"not_reviewed"},"R9-9.5.1.2":{"s":"na"},"R9-9.4.5.1":{"s":"not_reviewed"},"R9-9.5.1.3":{"s":"na"},"R9-9.5.1.3/2":{"s":"na"},"R9-9.5.1.3/3":{"s":"not_reviewed"},"R10-10.1.2":{"s":"na"},"R10-10.4.1.1":{"s":"not_reviewed"},"R10-10.4.2.1":{"s":"not_reviewed"},"R10-10.3.1":{"s":"not_reviewed"},"R10-10.3":{"s":"not_reviewed"},"R10-10.1":{"s":"not_reviewed"},"R10-10.5":{"s":"not_reviewed"},"R10-10.6":{"s":"not_reviewed"},"R10-10.6/2":{"s":"not_reviewed"},"R10-10.7":{"s":"not_reviewed"},"R10-10.7/2":{"s":"not_reviewed"},"R10-10.7/3":{"s":"not_reviewed"},"R10-10.7/4":{"s":"not_reviewed"},"R10-10.7/5":{"s":"not_reviewed"},"R10-10.7/6":{"s":"not_reviewed"},"R9-9.4.1":{"s":"not_reviewed"},"R11-11.1.2":{"s":"approved"},"R11-11.1.1":{"s":"approved"},"R11-11.2.1":{"s":"na"},"R11-11.2.2":{"s":"approved"},"R11-11.2.1.c":{"s":"na"},"R11-11.2.1.d":{"s":"na"},"R11-11.3.1":{"s":"need_review"},"R11-11.3.1.1":{"s":"approved"},"R11-11.3.1.2.d":{"s":"approved"},"R11-11.3.2":{"s":"need_review"},"R11-11.4.2":{"s":"need_review"},"R11-11.4.3":{"s":"need_review"},"R11-11.4.6":{"s":"need_review"},"R11-11.5.1":{"s":"need_review"},"R11-11.5.1.1":{"s":"need_review"},"R11-11.5.2":{"s":"need_review","c":"fill in the document"},"R11-11.6.1":{"s":"na"},"R11-11.6.1/2":{"s":"na"},"R12-12.1.1":{"s":"approved"},"R12-12.2.1":{"s":"approved"},"R12-12.3.1":{"s":"approved"},"R12-12.3.2":{"s":"approved"},"R12-12.3.3":{"s":"na"},"R12-12.3.4":{"s":"approved"},"R12-12.4.2":{"s":"approved"},"R12-12.5.2":{"s":"need_review","c":"pls fill in the files with all the required"},"R12-12.6.1":{"s":"approved"},"R12-12.6.3":{"s":"approved"},"R12-12.7.1":{"s":"need_review","c":"I need a real sample for any employee joined from HR department"},"R12-12.8.1":{"s":"approved"},"R12-12.8.2":{"s":"need_review","c":"Provide screenshots or copies of signed agreements with all TPSPs"},"R12-12.8.3.b":{"s":"need_review","c":"does not provide a completed sample due diligence assessment for a TPSP"},"R12-12.3.4/2":{"s":"approved"},"R12-12.8.5":{"s":"approved"},"R12-12.10.1":{"s":"approved"},"R12-12.10.2":{"s":"approved"},"R12-12.10.4.1":{"s":"na"},"R12-12.10.7":{"s":"na"}};

      const allEPs = db.prepare('SELECT * FROM evidence_points ORDER BY requirement_id, sub_requirement').all();
      const subReqCounts2 = {};
      const evidencePoints = allEPs.map(ep => {
        const hasFiles = ep.status !== 'empty';
        let owner = 'Unassigned';
        for (const [name, info] of Object.entries(OWNERS)) {
          if (info.reqs.includes(ep.requirement_id)) { owner = name; break; }
        }
        const baseKey = 'R' + ep.requirement_id + '-' + (ep.sub_requirement || ep.id);
        subReqCounts2[baseKey] = (subReqCounts2[baseKey] || 0) + 1;
        const ieKey = subReqCounts2[baseKey] > 1 ? baseKey + '/' + subReqCounts2[baseKey] : baseKey;
        const ieStatus = (IE_REVIEWS_CEO[ieKey] || {}).s || 'not_reviewed';
        return { id: ep.id, requirement: ep.requirement_id, hasFiles, owner, ieStatus };
      });

      const requirements = REQUIREMENTS.map(req => {
        const eps = evidencePoints.filter(ep => ep.requirement === req.id);
        const filled = eps.filter(ep => ep.hasFiles).length;
        const ieApproved = eps.filter(ep => ep.ieStatus === 'approved').length;
        const ieNeedReview = eps.filter(ep => ep.ieStatus === 'need_review').length;
        const ieRejected = eps.filter(ep => ep.ieStatus === 'rejected').length;
        const ieNA = eps.filter(ep => ep.ieStatus === 'na').length;
        const ieNotReviewed = eps.filter(ep => ep.ieStatus === 'not_reviewed').length;
        return { id: req.id, name: req.name, total: eps.length, filled, empty: eps.length - filled,
          percentage: eps.length > 0 ? Math.round((filled / eps.length) * 100) : 0,
          ieApproved, ieNeedReview, ieRejected, ieNA, ieNotReviewed,
          iePct: eps.length > 0 ? Math.round((ieApproved / eps.length) * 100) : 0 };
      });

      const totalEPs = evidencePoints.length, filledEPs = evidencePoints.filter(ep => ep.hasFiles).length;
      const ieApprovedTotal = evidencePoints.filter(ep => ep.ieStatus === 'approved').length;
      const ieNeedReviewTotal = evidencePoints.filter(ep => ep.ieStatus === 'need_review').length;
      const ieRejectedTotal = evidencePoints.filter(ep => ep.ieStatus === 'rejected').length;
      const ieNATotal = evidencePoints.filter(ep => ep.ieStatus === 'na').length;
      const ieNotReviewedTotal = evidencePoints.filter(ep => ep.ieStatus === 'not_reviewed').length;
      const ieReviewedTotal = ieApprovedTotal + ieNeedReviewTotal + ieRejectedTotal;
      const data = {
        requirements, owners: OWNERS,
        summary: { totalEPs, filledEPs, emptyEPs: totalEPs - filledEPs,
          percentage: totalEPs > 0 ? Math.round((filledEPs / totalEPs) * 100) : 0,
          reqsAt100: requirements.filter(r => r.percentage === 100).length,
          ieApproved: ieApprovedTotal, ieNeedReview: ieNeedReviewTotal,
          ieRejected: ieRejectedTotal, ieNA: ieNATotal, ieNotReviewed: ieNotReviewedTotal,
          ieReviewed: ieReviewedTotal,
          ieApprovedPct: totalEPs > 0 ? Math.round((ieApprovedTotal / totalEPs) * 100) : 0 }
      };

      html = html.replace('__DATA_PLACEHOLDER__', JSON.stringify(data));
      res.type('html').send(html);
    } else {
      res.status(404).send('CEO Dashboard template not found');
    }
  } catch(err) {
    console.error('CEO Dashboard error:', err);
    res.status(500).send('Error loading CEO Dashboard');
  }
});

// SPA fallback (skip portal routes, login, and API routes)
app.get('*', (req, res) => {
  if (req.path.startsWith('/command-center') || req.path.startsWith('/api/') ||
      req.path === '/ceo' || req.path === '/login' || req.path === '/iexperts' ||
      req.path === '/reviewer') return;
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