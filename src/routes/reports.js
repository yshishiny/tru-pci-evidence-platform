const express = require('express');
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
 * Generate today's daily HTML report
 */
function generateDailyReportHTML(db) {
  const today = new Date().toISOString().split('T')[0];

  // Get overall stats
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM evidence_points').get();
  const total = totalResult.count;

  const filledResult = db.prepare(
    "SELECT COUNT(*) as count FROM evidence_points WHERE status != 'empty'"
  ).get();
  const filled = filledResult.count;

  const emptyResult = db.prepare(
    "SELECT COUNT(*) as count FROM evidence_points WHERE status = 'empty'"
  ).get();
  const empty = emptyResult.count;

  const totalPct = total > 0 ? Math.round((filled / total) * 100) : 0;

  // Build requirement breakdown
  const requirementStats = REQUIREMENTS.map(req => {
    const reqTotal = db.prepare(
      'SELECT COUNT(*) as count FROM evidence_points WHERE requirement_id = ?'
    ).get(req.id).count;

    const reqFilled = db.prepare(
      "SELECT COUNT(*) as count FROM evidence_points WHERE requirement_id = ? AND status != 'empty'"
    ).get(req.id).count;

    const reqPct = reqTotal > 0 ? Math.round((reqFilled / reqTotal) * 100) : 0;

    return {
      id: req.id,
      name: req.name,
      total: reqTotal,
      filled: reqFilled,
      empty: reqTotal - reqFilled,
      percentage: reqPct
    };
  });

  // Get users with pending items
  const pendingByOwner = db.prepare(`
    SELECT assigned_owner, COUNT(*) as pending_count
    FROM evidence_points
    WHERE status IN ('empty', 'uploaded', 'under_review', 'pm_revision', 'grc_revision')
    AND assigned_owner IS NOT NULL
    GROUP BY assigned_owner
    ORDER BY pending_count DESC
  `).all();

  // Generate self-contained HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TRU PCI DSS Daily Report - ${today}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .header p {
      opacity: 0.9;
    }
    .content {
      padding: 2rem;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      border-top: 4px solid #3b82f6;
    }
    .kpi-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    .kpi-value {
      font-size: 2rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }
    .kpi-detail {
      font-size: 0.85rem;
      color: #475569;
    }
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.5rem;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
      transition: width 0.3s ease;
    }
    .section {
      margin-bottom: 2rem;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    table th {
      background: #f1f5f9;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    table td {
      padding: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
    }
    table tr:hover {
      background: #f8fafc;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    .footer {
      background: #f8fafc;
      padding: 1.5rem 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .requirement-row {
      display: grid;
      grid-template-columns: 1fr 80px 80px 80px 100px;
      gap: 1rem;
      padding: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
      align-items: center;
    }
    .requirement-row:hover {
      background: #f8fafc;
    }
    .requirement-name {
      font-weight: 500;
    }
    .requirement-stat {
      text-align: center;
      font-size: 0.9rem;
    }
    .requirement-pct {
      text-align: center;
      font-weight: 600;
      color: #10b981;
    }
    .pending-list {
      list-style: none;
    }
    .pending-list li {
      padding: 0.5rem;
      background: #f8fafc;
      margin-bottom: 0.5rem;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pending-badge {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TRU PCI DSS Evidence Platform</h1>
      <p>Daily Report - ${today}</p>
    </div>

    <div class="content">
      <div class="section">
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Evidence Points</div>
            <div class="kpi-value">${total}</div>
            <div class="kpi-detail">across all requirements</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Completed</div>
            <div class="kpi-value">${filled}</div>
            <div class="kpi-detail">${totalPct}% of total</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${totalPct}%"></div>
            </div>
          </div>

          <div class="kpi-card" style="border-top-color: #ef4444;">
            <div class="kpi-label">Pending</div>
            <div class="kpi-value">${empty}</div>
            <div class="kpi-detail">${100 - totalPct}% remaining</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Requirement Breakdown</div>
        <div>
          ${requirementStats.map(req => `
            <div class="requirement-row">
              <div class="requirement-name">Req ${req.id}: ${req.name}</div>
              <div class="requirement-stat">${req.total} total</div>
              <div class="requirement-stat">${req.filled} done</div>
              <div class="requirement-stat">${req.empty} left</div>
              <div class="requirement-pct">${req.percentage}%</div>
            </div>
          `).join('')}
        </div>
      </div>

      ${pendingByOwner.length > 0 ? `
        <div class="section">
          <div class="section-title">Pending Items by Assignee</div>
          <ul class="pending-list">
            ${pendingByOwner.map(item => `
              <li>
                <span>${item.assigned_owner}</span>
                <span class="pending-badge">${item.pending_count} pending</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()} | TRU PCI DSS Evidence Platform</p>
    </div>
  </div>
</body>
</html>`;

  return {
    html,
    stats: {
      report_date: today,
      total,
      filled,
      empty,
      percentage: totalPct,
      requirements_count: REQUIREMENTS.length,
      completed_requirements: requirementStats.filter(r => r.percentage === 100).length
    }
  };
}

/**
 * POST /api/reports/generate - Generate today's daily report (admin only)
 */
router.post('/generate', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    // Check if report already exists for today
    const existing = db.prepare(
      'SELECT id FROM daily_reports WHERE report_date = ?'
    ).get(today);

    if (existing && !req.body.force) {
      return res.status(409).json({
        error: 'Report already exists for today',
        id: existing.id
      });
    }

    // Generate report
    const { html, stats } = generateDailyReportHTML(db);

    // Delete old report if force regenerate
    if (existing && req.body.force) {
      db.prepare('DELETE FROM daily_reports WHERE id = ?').run(existing.id);
    }

    // Store report
    const result = db.prepare(`
      INSERT INTO daily_reports (report_date, html_content, stats_json, created_by)
      VALUES (?, ?, ?, ?)
    `).run(today, html, JSON.stringify(stats), req.user.username);

    // Log audit entry
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, target, details)
      VALUES (?, ?, 'generate_report', 'reports', ?)
    `).run(req.user.id, req.user.username, `Generated daily report for ${today}`);

    res.status(201).json({
      id: result.lastInsertRowid,
      report_date: today,
      stats
    });
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/reports - List all stored reports (paginated)
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const total = db.prepare('SELECT COUNT(*) as count FROM daily_reports').get().count;
    const reports = db.prepare(`
      SELECT id, report_date, created_by, created_at,
             json_extract(stats_json, '$.total') as total,
             json_extract(stats_json, '$.filled') as filled,
             json_extract(stats_json, '$.percentage') as percentage
      FROM daily_reports
      ORDER BY report_date DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
      reports,
      total,
      limit,
      offset,
      has_more: offset + limit < total
    });
  } catch (err) {
    console.error('List reports error:', err);
    res.status(500).json({ error: 'Failed to retrieve reports' });
  }
});

/**
 * GET /api/reports/latest - Get the most recent report
 */
router.get('/latest', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const report = db.prepare(`
      SELECT id, report_date, html_content, stats_json, created_at, created_by
      FROM daily_reports
      ORDER BY report_date DESC
      LIMIT 1
    `).get();

    if (!report) {
      return res.status(404).json({ error: 'No reports found' });
    }

    res.json({
      id: report.id,
      report_date: report.report_date,
      html_content: report.html_content,
      stats: JSON.parse(report.stats_json || '{}'),
      created_at: report.created_at,
      created_by: report.created_by
    });
  } catch (err) {
    console.error('Get latest report error:', err);
    res.status(500).json({ error: 'Failed to retrieve report' });
  }
});

/**
 * GET /api/reports/:id - Get a specific report by ID
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const report = db.prepare(`
      SELECT id, report_date, html_content, stats_json, created_at, created_by
      FROM daily_reports
      WHERE id = ?
    `).get(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      id: report.id,
      report_date: report.report_date,
      html_content: report.html_content,
      stats: JSON.parse(report.stats_json || '{}'),
      created_at: report.created_at,
      created_by: report.created_by
    });
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Failed to retrieve report' });
  }
});

module.exports = router;
