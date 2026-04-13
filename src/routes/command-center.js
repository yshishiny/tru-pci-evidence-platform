/**
 * Command Center Route
 * Serves the TRU PCI DSS Command Center as a self-contained page
 * with live data from the database. No auth required for read-only access.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');

const router = express.Router();

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

function buildLiveData() {
  const db = getDb();

  // Get all evidence points
  const allEPs = db.prepare(`
    SELECT ep.*,
      COALESCE(r.status, 'pending') as review_status,
      r.reviewer_name,
      r.reviewed_at,
      r.comments as review_comment
    FROM evidence_points ep
    LEFT JOIN (
      SELECT evidence_point_id, status, reviewer_name, reviewed_at, comments,
        ROW_NUMBER() OVER (PARTITION BY evidence_point_id ORDER BY reviewed_at DESC) as rn
      FROM reviews
    ) r ON ep.id = r.evidence_point_id AND r.rn = 1
    ORDER BY ep.requirement_id, ep.sub_requirement
  `).all();

  // Get file counts per EP
  const fileCounts = {};
  try {
    const fileRows = db.prepare(`
      SELECT evidence_point_id, COUNT(*) as cnt,
        GROUP_CONCAT(file_name, '||') as names,
        SUM(file_size) as total_size
      FROM evidence_files
      GROUP BY evidence_point_id
    `).all();
    fileRows.forEach(row => {
      fileCounts[row.evidence_point_id] = {
        count: row.cnt,
        names: row.names ? row.names.split('||') : [],
        totalSize: row.total_size || 0
      };
    });
  } catch(e) {
    // evidence_files table may not exist yet
  }

  const evidencePoints = allEPs.map(ep => {
    const fc = fileCounts[ep.id] || { count: 0, names: [], totalSize: 0 };
    const hasFiles = ep.status !== 'empty';

    // Determine owner
    let owner = 'Unassigned';
    for (const [name, info] of Object.entries(OWNERS)) {
      if (info.reqs.includes(ep.requirement_id)) { owner = name; break; }
    }

    return {
      id: 'R' + ep.requirement_id + '-' + (ep.sub_requirement || ep.ep_number || ep.id),
      epId: ep.sub_requirement || ep.ep_number || String(ep.id),
      requirement: ep.requirement_id,
      requirementName: (REQUIREMENTS.find(r => r.id === ep.requirement_id) || {}).name || '',
      folder: ep.folder_name || ep.description || 'EP-' + ep.id,
      type: ep.evidence_type || 'document',
      hasFiles,
      files: fc.names.map(n => ({
        name: n,
        size: 0,
        modified: ep.updated_at || ep.created_at || new Date().toISOString(),
        ext: path.extname(n).toLowerCase()
      })),
      fileCount: hasFiles ? Math.max(fc.count, 1) : 0,
      totalSize: fc.totalSize,
      owner,
      reviewStatus: ep.review_status || 'pending',
      reviewComment: ep.review_comment || ''
    };
  });

  // Build requirements
  const requirements = REQUIREMENTS.map(req => {
    const eps = evidencePoints.filter(ep => ep.requirement === req.id);
    const filled = eps.filter(ep => ep.hasFiles).length;
    return {
      id: req.id,
      name: req.name,
      fullName: 'Requirement ' + req.id + ' - ' + req.name,
      total: eps.length,
      filled,
      empty: eps.length - filled,
      percentage: eps.length > 0 ? Math.round((filled / eps.length) * 100) : 0
    };
  });

  const totalEPs = evidencePoints.length;
  const filledEPs = evidencePoints.filter(ep => ep.hasFiles).length;

  return {
    requirements,
    evidencePoints,
    owners: OWNERS,
    summary: {
      totalEPs,
      filledEPs,
      emptyEPs: totalEPs - filledEPs,
      percentage: totalEPs > 0 ? Math.round((filledEPs / totalEPs) * 100) : 0,
      scanDate: new Date().toISOString(),
      reqsAt100: requirements.filter(r => r.percentage === 100).length,
      totalFiles: evidencePoints.reduce((s, ep) => s + ep.fileCount, 0),
      totalSize: evidencePoints.reduce((s, ep) => s + ep.totalSize, 0)
    }
  };
}

// API endpoint for live data (JSON)
router.get('/data', (req, res) => {
  try {
    const data = buildLiveData();
    res.json(data);
  } catch(err) {
    console.error('Command center data error:', err);
    res.status(500).json({ error: 'Failed to build command center data' });
  }
});

// Serve the Command Center HTML with embedded live data
router.get('/', (req, res) => {
  try {
    const templatePath = path.join(__dirname, '..', '..', 'public', 'command-center.html');

    if (fs.existsSync(templatePath)) {
      let html = fs.readFileSync(templatePath, 'utf8');
      const data = buildLiveData();
      html = html.replace('__DATA_PLACEHOLDER__', JSON.stringify(data));
      res.type('html').send(html);
    } else {
      // Fallback: redirect to the API data
      res.redirect('/api/command-center/data');
    }
  } catch(err) {
    console.error('Command center render error:', err);
    res.status(500).send('Error loading Command Center');
  }
});

module.exports = router;
