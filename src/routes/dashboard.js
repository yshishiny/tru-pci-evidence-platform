const express = require('express');
const requireAuth = require('../middleware/requireAuth');
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

// GET /stats
router.get('/stats', requireAuth, (req, res) => {
  try {
    const db = getDb();

    // Overall counts
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

    // By status
    const byStatus = {};
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as count FROM evidence_points GROUP BY status
    `).all();
    statusRows.forEach(row => {
      byStatus[row.status] = row.count;
    });

    // By type
    const byType = {};
    const typeRows = db.prepare(`
      SELECT evidence_type, COUNT(*) as count FROM evidence_points GROUP BY evidence_type
    `).all();
    typeRows.forEach(row => {
      byType[row.evidence_type] = row.count;
    });

    // By requirement
    const byRequirement = REQUIREMENTS.map(req => {
      const reqTotal = db.prepare(
        'SELECT COUNT(*) as count FROM evidence_points WHERE requirement_id = ?'
      ).get(req.id).count;

      const reqFilled = db.prepare(
        "SELECT COUNT(*) as count FROM evidence_points WHERE requirement_id = ? AND status != 'empty'"
      ).get(req.id).count;

      const reqEmpty = reqTotal - reqFilled;
      const pct = reqTotal > 0 ? Math.round((reqFilled / reqTotal) * 100) : 0;

      return {
        id: req.id,
        name: req.name,
        total: reqTotal,
        filled: reqFilled,
        empty: reqEmpty,
        percentage: pct
      };
    });

    res.json({
      total,
      filled,
      empty,
      percentage: total > 0 ? Math.round((filled / total) * 100) : 0,
      by_status: byStatus,
      by_type: byType,
      by_requirement: byRequirement
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// GET /requirements
router.get('/requirements', requireAuth, (req, res) => {
  try {
    const db = getDb();

    const requirements = REQUIREMENTS.map(req => {
      const total = db.prepare(
        'SELECT COUNT(*) as count FROM evidence_points WHERE requirement_id = ?'
      ).get(req.id).count;

      const filled = db.prepare(
        "SELECT COUNT(*) as count FROM evidence_points WHERE requirement_id = ? AND status != 'empty'"
      ).get(req.id).count;

      const statusCounts = {};
      const statusRows = db.prepare(`
        SELECT status, COUNT(*) as count FROM evidence_points
        WHERE requirement_id = ?
        GROUP BY status
      `).all(req.id);
      statusRows.forEach(row => {
        statusCounts[row.status] = row.count;
      });

      return {
        id: req.id,
        name: req.name,
        total,
        filled,
        empty: total - filled,
        percentage: total > 0 ? Math.round((filled / total) * 100) : 0,
        statuses: statusCounts
      };
    });

    res.json({ requirements });
  } catch (err) {
    console.error('Requirements error:', err);
    res.status(500).json({ error: 'Failed to retrieve requirements' });
  }
});

module.exports = router;
