const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function initDb() {
  const dataDir = process.env.DATA_DIR || './data';

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'app.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'tru_team', 'iexpert_pm', 'iexpert_grc', 'assessor')),
      email TEXT,
      assigned_requirements TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS evidence_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requirement_id INTEGER NOT NULL CHECK(requirement_id BETWEEN 1 AND 12),
      sub_requirement TEXT,
      folder_path TEXT UNIQUE NOT NULL,
      folder_name TEXT NOT NULL,
      evidence_type TEXT NOT NULL CHECK(evidence_type IN ('screenshot', 'scan', 'config', 'document')),
      status TEXT NOT NULL DEFAULT 'empty' CHECK(status IN ('empty', 'uploaded', 'under_review', 'pm_approved', 'pm_revision', 'grc_approved', 'grc_revision', 'admin_approved', 'assessor_approved', 'assessor_rejected')),
      assigned_owner TEXT,
      current_file TEXT,
      file_version INTEGER DEFAULT 0,
      has_original_doc INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_point_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evidence_point_id) REFERENCES evidence_points(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS file_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_point_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_size INTEGER,
      mime_type TEXT,
      FOREIGN KEY (evidence_point_id) REFERENCES evidence_points(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      target TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS drive_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id INTEGER,
      local_path TEXT,
      drive_file_id TEXT,
      drive_link TEXT,
      last_synced DATETIME,
      file_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evidence_id) REFERENCES evidence_points(id)
    );

    CREATE TABLE IF NOT EXISTS dropbox_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id INTEGER,
      local_path TEXT,
      dropbox_path TEXT,
      dropbox_link TEXT,
      last_synced DATETIME,
      file_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evidence_id) REFERENCES evidence_points(id)
    );

    CREATE TABLE IF NOT EXISTS cloud_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL CHECK(provider IN ('google_drive', 'dropbox')),
      config_json TEXT,
      is_active INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_requirement ON evidence_points(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence_points(status);
    CREATE INDEX IF NOT EXISTS idx_evidence_owner ON evidence_points(assigned_owner);
    CREATE INDEX IF NOT EXISTS idx_comments_evidence ON comments(evidence_point_id);
    CREATE INDEX IF NOT EXISTS idx_file_versions_evidence ON file_versions(evidence_point_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_drive_sync_evidence ON drive_sync(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_dropbox_sync_evidence ON dropbox_sync(evidence_id);
  `);

  return db;
}

function getDb() {
  if (!db) {
    initDb();
  }
  return db;
}

module.exports = {
  getDb,
  initDb
};
