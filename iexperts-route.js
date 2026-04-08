/**
 * IExperts Audit Portal Routes
 * Add these routes to server.js with: app.use(require('./iexperts-route.js'));
 * Or paste the content directly into server.js
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDb } = require('./src/db');

// In-memory storage for IExperts review updates (persists during server session)
let IE_REVIEWS = {"R1-1.1.1":{"s":"approved"},"R1-1.1.2":{"s":"approved"},"R1-1.2.1":{"s":"approved"},"R1-1.2.1/2":{"s":"approved"},"R1-1.2.2":{"s":"approved"},"R1-1.2.3":{"s":"need_review","c":"file empty"},"R1-1.2.3/2":{"s":"need_review","c":"file empty"},"R1-1.2.4":{"s":"need_review","c":"file empty"},"R1-1.2.5":{"s":"approved"},"R1-1.2.7":{"s":"rejected","c":"we need the configuration rules from ( firewall ,waf , ips,vpn , mfa ) , all of them in one documents"},"R1-1.2.8":{"s":"approved"},"R1-1.2.8/2":{"s":"na"},"R1-1.3.3":{"s":"approved"},"R1-1.3.3/2":{"s":"need_review","c":"file empty"},"R1-1.4.3":{"s":"need_review","c":"file empty"},"R1-1.4.5":{"s":"not_reviewed"},"R1-1.5.1":{"s":"na","c":"NA"},"R2-2.1.1":{"s":"not_reviewed"},"R2-2.1.1/2":{"s":"not_reviewed"},"R2-2.2.1":{"s":"not_reviewed"},"R2-2.3.1":{"s":"na"},"R3-3.1.2":{"s":"na"},"R3-3.2.1":{"s":"na"},"R3-3.2.1/2":{"s":"na"},"R3-3.2.1/3":{"s":"not_reviewed"},"R3-3.2.1/4":{"s":"na"},"R3-3.3.3":{"s":"na"},"R3-3.3.1.1":{"s":"na"},"R3-3.3.3/2":{"s":"na"},"R3-3.4.1":{"s":"na"},"R3-3.4.1/2":{"s":"na"},"R3-3.4.1.c":{"s":"na"},"R3-3.4.2":{"s":"not_reviewed"},"R3-3.5.1":{"s":"na"},"R3-3.5.1/2":{"s":"na"},"R3-3.5.1/3":{"s":"na"},"R3-3.5.1.1":{"s":"na"},"R3-3.5.1.2, 3.5.1.3":{"s":"na"},"R3-3.6.1.1":{"s":"na"},"R3-3.6.1.1/2":{"s":"na"},"R3-3.6.1.3":{"s":"na"},"R3-3.7.6":{"s":"na"},"R3-3.7.8":{"s":"na"},"R3-3.7.9":{"s":"na"},"R4-4.1.2":{"s":"na"},"R4-4.1.1":{"s":"na"},"R4-4.2.1":{"s":"na"},"R4-4.2.1.1":{"s":"na"},"R4-4.2.1.2":{"s":"na"},"R4-4.2.2":{"s":"na"},"R5-5.1.1":{"s":"not_reviewed"},"R5-5.1.2":{"s":"not_reviewed"},"R5-5.2.1":{"s":"not_reviewed"},"R5-5.2.2":{"s":"not_reviewed"},"R5-5.2.3":{"s":"not_reviewed"},"R5-5.2.3.1":{"s":"not_reviewed"},"R5-5.3.1":{"s":"not_reviewed"},"R5-5.3.2":{"s":"not_reviewed"},"R5-5.3.2.1":{"s":"not_reviewed"},"R5-5.3.3":{"s":"not_reviewed"},"R5-5.3.4":{"s":"not_reviewed"},"R5-5.3.5":{"s":"not_reviewed"},"R5-5.4.1":{"s":"not_reviewed"},"R6-6.1.1":{"s":"not_reviewed"},"R6-6.1.2":{"s":"not_reviewed"},"R6-6.2.1":{"s":"not_reviewed"},"R6-6.2.2":{"s":"not_reviewed"},"R6-6.2.3":{"s":"not_reviewed"},"R6-6.2.3.1":{"s":"not_reviewed"},"R6-6.3.1":{"s":"not_reviewed"},"R6-6.3.2":{"s":"not_reviewed"},"R6-6.3.3":{"s":"not_reviewed"},"R6-6.3.3/2":{"s":"not_reviewed"},"R6-6.4.1":{"s":"not_reviewed"},"R6-6.4.2":{"s":"not_reviewed"},"R6-6.4.2/2":{"s":"not_reviewed"},"R6-6.4.3a":{"s":"na"},"R6-6.4.3b":{"s":"na"},"R6-6.4.3c":{"s":"na"},"R6-6.4.3d":{"s":"na"},"R6-6.5.1a":{"s":"not_reviewed"},"R6-6.5.5":{"s":"not_reviewed"},"R6-6.5.6":{"s":"not_reviewed"},"R7-7.1.1":{"s":"not_reviewed"},"R7-7.1.2":{"s":"na"},"R7-7.2.2b":{"s":"not_reviewed"},"R7-7.2.4":{"s":"not_reviewed"},"R7-7.2.5.1a":{"s":"not_reviewed"},"R7-7.2.5.1b":{"s":"not_reviewed"},"R7-7.2.4b":{"s":"not_reviewed"},"R8-8.1.2":{"s":"not_reviewed"},"R8-8.2.4":{"s":"not_reviewed"},"R8-8.4.2":{"s":"not_reviewed"},"R8-8.3.6":{"s":"not_reviewed"},"R8-8.3.6/2":{"s":"not_reviewed"},"R8-8.3.6/3":{"s":"not_reviewed"},"R8-8.2.5":{"s":"not_reviewed"},"R8-8.3.2":{"s":"not_reviewed"},"R8-8.1.1":{"s":"not_reviewed"},"R8-8.4.2/2":{"s":"not_reviewed"},"R8-8.5.1":{"s":"not_reviewed"},"R8-8.6.3":{"s":"not_reviewed"},"R8-8.3.6/4":{"s":"not_reviewed"},"R9-9.1.1, 9.2.1, 9.3.1":{"s":"not_reviewed"},"R9-9.2.1.1":{"s":"not_reviewed"},"R9-9.3.1.1":{"s":"not_reviewed"},"R9-9.2.1.1/2":{"s":"not_reviewed"},"R9-9.2.1.1/3":{"s":"not_reviewed"},"R9-9.1.2":{"s":"na"},"R9-9.3.2":{"s":"not_reviewed"},"R9-9.4.1.1":{"s":"not_reviewed"},"R9-9.4.3":{"s":"na"},"R9-9.4.7":{"s":"not_reviewed"},"R9-9.5.1.2":{"s":"na"},"R9-9.4.5.1":{"s":"not_reviewed"},"R9-9.5.1.3":{"s":"na"},"R9-9.5.1.3/2":{"s":"na"},"R9-9.5.1.3/3":{"s":"not_reviewed"},"R10-10.1.2":{"s":"na"},"R10-10.4.1.1":{"s":"not_reviewed"},"R10-10.4.2.1":{"s":"not_reviewed"},"R10-10.3.1":{"s":"not_reviewed"},"R10-10.3":{"s":"not_reviewed"},"R10-10.1":{"s":"not_reviewed"},"R10-10.5":{"s":"not_reviewed"},"R10-10.6":{"s":"not_reviewed"},"R10-10.6/2":{"s":"not_reviewed"},"R10-10.7":{"s":"not_reviewed"},"R10-10.7/2":{"s":"not_reviewed"},"R10-10.7/3":{"s":"not_reviewed"},"R10-10.7/4":{"s":"not_reviewed"},"R10-10.7/5":{"s":"not_reviewed"},"R10-10.7/6":{"s":"not_reviewed"},"R9-9.4.1":{"s":"not_reviewed"},"R11-11.1.2":{"s":"approved"},"R11-11.1.1":{"s":"approved"},"R11-11.2.1":{"s":"na"},"R11-11.2.2":{"s":"approved"},"R11-11.2.1.c":{"s":"na"},"R11-11.2.1.d":{"s":"na"},"R11-11.3.1":{"s":"need_review"},"R11-11.3.1.1":{"s":"approved"},"R11-11.3.1.2.d":{"s":"approved"},"R11-11.3.2":{"s":"need_review"},"R11-11.4.2":{"s":"need_review"},"R11-11.4.3":{"s":"need_review"},"R11-11.4.6":{"s":"need_review"},"R11-11.5.1":{"s":"need_review"},"R11-11.5.1.1":{"s":"need_review"},"R11-11.5.2":{"s":"need_review","c":"fill in the document"},"R11-11.6.1":{"s":"na"},"R11-11.6.1/2":{"s":"na"},"R12-12.1.1":{"s":"approved"},"R12-12.2.1":{"s":"approved"},"R12-12.3.1":{"s":"approved"},"R12-12.3.2":{"s":"approved"},"R12-12.3.3":{"s":"na"},"R12-12.3.4":{"s":"approved"},"R12-12.4.2":{"s":"approved"},"R12-12.5.2":{"s":"need_review","c":"pls fill in the files with all the required"},"R12-12.6.1":{"s":"approved"},"R12-12.6.3":{"s":"approved"},"R12-12.7.1":{"s":"need_review","c":"I need a real sample for any employee joined from HR department"},"R12-12.8.1":{"s":"approved"},"R12-12.8.2":{"s":"need_review","c":"Provide screenshots or copies of signed agreements with all TPSPs"},"R12-12.8.3.b":{"s":"need_review","c":"does not provide a completed sample due diligence assessment for a TPSP"},"R12-12.3.4/2":{"s":"approved"},"R12-12.8.5":{"s":"approved"},"R12-12.10.1":{"s":"approved"},"R12-12.10.2":{"s":"approved"},"R12-12.10.4.1":{"s":"na"},"R12-12.10.7":{"s":"na"}};

const REQUIREMENTS = [
  { id: 1, name: 'Network Security Controls' },
  { id: 2, name: 'Secure Configurations' },
  { id: 3, name: 'Protect Stored Account Data' },
  { id: 4, name: 'Protect Cardholder Data in Transit' },
  { id: 5, name: 'Protect Against Malicious Software' },
  { id: 6, name: 'Develop and Maintain Secure Systems' },
  { id: 7, name: 'Restrict Access by Business Need' },
  { id: 8, name: 'Identify Users and Authenticate Access' },
  { id: 9, name: 'Restrict Physical Access' },
  { id: 10, name: 'Log and Monitor All Access' },
  { id: 11, name: 'Test Security Regularly' },
  { id: 12, name: 'Support InfoSec with Policies and Programs' }
];

const OWNERS = {
  'Amr Abdelnasr': { role: 'IT Infrastructure', reqs: [1,2,4,5], color: '#3b82f6' },
  'Tamer Sherif': { role: 'App Development', reqs: [3,6,8], color: '#8b5cf6' },
  'Ahmad Sayed': { role: 'Cyber Force / SOC', reqs: [9,10,11], color: '#10b981' },
  'Yasser Shishiny': { role: 'Project Lead', reqs: [7,12], color: '#f59e0b' }
};

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

/**
 * GET /iexperts — Serve the IExperts Review Portal
 */
router.get('/iexperts', (req, res) => {
  try {
    const __dirname = path.resolve('.');
    const templatePath = path.join(__dirname, 'public', 'iexperts-review.html');

    if (!fs.existsSync(templatePath)) {
      return res.status(404).send('IExperts review template not found at ' + templatePath);
    }

    let html = fs.readFileSync(templatePath, 'utf8');
    const db = getDb();

    // Get all evidence points
    const allEPs = db.prepare('SELECT * FROM evidence_points ORDER BY requirement_id, sub_requirement').all();

    // Get file counts
    const fileCounts = {};
    try {
      db.prepare('SELECT evidence_point_id, COUNT(*) as cnt, GROUP_CONCAT(file_name, \'||\') as names, SUM(file_size) as total_size FROM evidence_files GROUP BY evidence_point_id').all().forEach(row => {
        fileCounts[row.evidence_point_id] = { count: row.cnt, names: row.names ? row.names.split('||') : [], totalSize: row.total_size || 0 };
      });
    } catch(e) {}

    // Build evidence points with current IE review status
    const subReqCounts = {};
    const evidencePoints = allEPs.map(ep => {
      const fc = fileCounts[ep.id] || { count: 0, names: [], totalSize: 0 };
      const hasFiles = ep.status !== 'empty';

      // Find owner
      let owner = 'Unassigned';
      for (const [name, info] of Object.entries(OWNERS)) {
        if (info.reqs.includes(ep.requirement_id)) { owner = name; break; }
      }

      // Get drive folder URL
      const driveFolderId = DRIVE_FOLDERS[ep.requirement_id] || '';
      const driveUrl = driveFolderId ? 'https://drive.google.com/drive/folders/' + driveFolderId : '';

      // Build IE_REVIEWS key with duplicate handling
      const baseKey = 'R' + ep.requirement_id + '-' + (ep.sub_requirement || ep.id);
      subReqCounts[baseKey] = (subReqCounts[baseKey] || 0) + 1;
      const ieKey = subReqCounts[baseKey] > 1 ? baseKey + '/' + subReqCounts[baseKey] : baseKey;
      const ieReview = IE_REVIEWS[ieKey] || { s: 'not_reviewed' };

      return {
        id: ieKey,
        epId: ep.sub_requirement || String(ep.id),
        requirement: ep.requirement_id,
        folder: ep.folder_name || 'EP-' + ep.id,
        type: ep.evidence_type || 'document',
        hasFiles,
        files: fc.names.map(n => ({ name: n, size: 0, ext: path.extname(n).toLowerCase() })),
        fileCount: hasFiles ? Math.max(fc.count, 1) : 0,
        totalSize: fc.totalSize,
        owner,
        driveUrl,
        ieStatus: ieReview.s,
        ieComment: ieReview.c || ''
      };
    });

    // Build requirements summary with IE review breakdown
    const requirements = REQUIREMENTS.map(req => {
      const eps = evidencePoints.filter(ep => ep.requirement === req.id);
      const filled = eps.filter(ep => ep.hasFiles).length;
      const ieApproved = eps.filter(ep => ep.ieStatus === 'approved').length;
      const ieNeedReview = eps.filter(ep => ep.ieStatus === 'need_review').length;
      const ieRejected = eps.filter(ep => ep.ieStatus === 'rejected').length;
      const ieNA = eps.filter(ep => ep.ieStatus === 'na').length;
      const ieNotReviewed = eps.filter(ep => ep.ieStatus === 'not_reviewed').length;
      const ieReviewed = ieApproved + ieNeedReview + ieRejected;

      const driveFolderId = DRIVE_FOLDERS[req.id] || '';
      const driveUrl = driveFolderId ? 'https://drive.google.com/drive/folders/' + driveFolderId : '';

      return {
        id: req.id,
        name: req.name,
        total: eps.length,
        filled,
        empty: eps.length - filled,
        percentage: eps.length > 0 ? Math.round((filled / eps.length) * 100) : 0,
        ieApproved,
        ieNeedReview,
        ieRejected,
        ieNA,
        ieNotReviewed,
        ieReviewed,
        iePct: eps.length > 0 ? Math.round((ieApproved / eps.length) * 100) : 0,
        driveUrl
      };
    });

    // Calculate summary statistics
    const totalEPs = evidencePoints.length;
    const filledEPs = evidencePoints.filter(ep => ep.hasFiles).length;
    const ieApprovedTotal = evidencePoints.filter(ep => ep.ieStatus === 'approved').length;
    const ieNeedReviewTotal = evidencePoints.filter(ep => ep.ieStatus === 'need_review').length;
    const ieRejectedTotal = evidencePoints.filter(ep => ep.ieStatus === 'rejected').length;
    const ieNATotal = evidencePoints.filter(ep => ep.ieStatus === 'na').length;
    const ieNotReviewedTotal = evidencePoints.filter(ep => ep.ieStatus === 'not_reviewed').length;
    const ieReviewedTotal = ieApprovedTotal + ieNeedReviewTotal + ieRejectedTotal;

    const data = {
      requirements,
      evidencePoints,
      owners: OWNERS,
      summary: {
        totalEPs,
        filledEPs,
        emptyEPs: totalEPs - filledEPs,
        percentage: totalEPs > 0 ? Math.round((filledEPs / totalEPs) * 100) : 0,
        ieApproved: ieApprovedTotal,
        ieNeedReview: ieNeedReviewTotal,
        ieRejected: ieRejectedTotal,
        ieNA: ieNATotal,
        ieNotReviewed: ieNotReviewedTotal,
        ieReviewed: ieReviewedTotal,
        ieApprovedPct: totalEPs > 0 ? Math.round((ieApprovedTotal / totalEPs) * 100) : 0
      }
    };

    html = html.replace('__DATA_PLACEHOLDER__', JSON.stringify(data));
    res.type('html').send(html);
  } catch(err) {
    console.error('IExperts portal error:', err);
    res.status(500).send('Error loading IExperts Audit Portal: ' + err.message);
  }
});

/**
 * POST /api/iexperts/review — Update review status and comment for an evidence point
 * Body: { epId, status, comment }
 */
router.post('/api/iexperts/review', (req, res) => {
  try {
    const { epId, status, comment } = req.body;

    if (!epId || !status) {
      return res.status(400).json({ error: 'epId and status required' });
    }

    // Valid status values
    const validStatuses = ['not_reviewed', 'approved', 'need_review', 'rejected', 'partial', 'na'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status: ' + status });
    }

    // Update in-memory store
    IE_REVIEWS[epId] = { s: status, c: comment || '' };

    // Log the update
    console.log(`[IExperts] Updated ${epId} -> ${status}${comment ? ' (' + comment + ')' : ''}`);

    res.json({
      success: true,
      message: 'Review updated',
      epId,
      status,
      comment: comment || '',
      timestamp: new Date().toISOString()
    });
  } catch(err) {
    console.error('Review update error:', err);
    res.status(500).json({ error: 'Failed to update review: ' + err.message });
  }
});

/**
 * GET /api/iexperts/reviews — Get all current reviews (for export/backup)
 */
router.get('/api/iexperts/reviews', (req, res) => {
  try {
    res.json({
      total: Object.keys(IE_REVIEWS).length,
      reviews: IE_REVIEWS,
      timestamp: new Date().toISOString()
    });
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch reviews: ' + err.message });
  }
});

/**
 * POST /api/iexperts/reviews/export — Get reviews in a specific format
 */
router.post('/api/iexperts/reviews/export', (req, res) => {
  try {
    const format = req.body.format || 'json'; // json, csv, summary

    if (format === 'summary') {
      const summary = {
        timestamp: new Date().toISOString(),
        total: Object.keys(IE_REVIEWS).length,
        breakdown: {}
      };

      for (const [epId, review] of Object.entries(IE_REVIEWS)) {
        const status = review.s;
        summary.breakdown[status] = (summary.breakdown[status] || 0) + 1;
      }

      return res.json(summary);
    }

    if (format === 'csv') {
      let csv = 'EP ID,Status,Comment\n';
      for (const [epId, review] of Object.entries(IE_REVIEWS)) {
        const comment = (review.c || '').replace(/"/g, '""');
        csv += `"${epId}","${review.s}","${comment}"\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=iexperts-reviews.csv');
      return res.send(csv);
    }

    // Default: JSON
    res.json(IE_REVIEWS);
  } catch(err) {
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

module.exports = router;
