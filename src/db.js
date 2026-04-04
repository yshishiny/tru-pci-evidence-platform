/**
 * Database module — sql.js (pure JavaScript SQLite, no native build required)
 * Provides a better-sqlite3-compatible API wrapper around sql.js
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
let dbPath = null;

/**
 * Wrapper that mimics better-sqlite3's synchronous API on top of sql.js
 */
class DbWrapper {
  constructor(sqlDb, filePath) {
    this._db = sqlDb;
    this._path = filePath;
    this._saveTimer = null;
  }

  /**
   * Save database to disk (debounced)
   */
  _save() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try {
        const data = this._db.export();
        fs.writeFileSync(this._path, Buffer.from(data));
      } catch (e) {
        console.error('DB save error:', e.message);
      }
    }, 500);
  }

  /**
   * Force immediate save
   */
  saveNow() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    try {
      const data = this._db.export();
      fs.writeFileSync(this._path, Buffer.from(data));
    } catch (e) {
      console.error('DB save error:', e.message);
    }
  }

  /**
   * Execute raw SQL (DDL, multiple statements)
   */
  exec(sql) {
    this._db.run(sql);
    this._save();
  }

  /**
   * Set pragma (simplified — only WAL mode matters and sql.js doesn't support it)
   */
  pragma(str) {
    // sql.js runs in-memory with file persistence, pragmas like WAL are no-ops
    return;
  }

  /**
   * Prepare a statement — returns an object with .get(), .all(), .run()
   */
  prepare(sql) {
    const self = this;
    return {
      /**
       * Get a single row
       */
      get(...params) {
        try {
          const stmt = self._db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          // If it's a parameter binding issue, try named params
          if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
            try {
              const stmt = self._db.prepare(sql);
              stmt.bind(params[0]);
              if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return row;
              }
              stmt.free();
              return undefined;
            } catch (e2) {
              throw e2;
            }
          }
          throw e;
        }
      },

      /**
       * Get all rows
       */
      all(...params) {
        try {
          const stmt = self._db.prepare(sql);
          if (params.length > 0) {
            if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
              stmt.bind(params[0]);
            } else {
              stmt.bind(params);
            }
          }
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        } catch (e) {
          throw e;
        }
      },

      /**
       * Run a statement (INSERT/UPDATE/DELETE) — returns { changes, lastInsertRowid }
       */
      run(...params) {
        try {
          const stmt = self._db.prepare(sql);
          if (params.length > 0) {
            if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
              stmt.bind(params[0]);
            } else {
              stmt.bind(params);
            }
          }
          stmt.step();
          stmt.free();

          const changes = self._db.getRowsModified();
          // Get last insert rowid
          let lastInsertRowid = 0;
          try {
            const ridStmt = self._db.prepare('SELECT last_insert_rowid() as id');
            if (ridStmt.step()) {
              lastInsertRowid = ridStmt.getAsObject().id;
            }
            ridStmt.free();
          } catch (e) {}

          self._save();
          return { changes, lastInsertRowid };
        } catch (e) {
          throw e;
        }
      }
    };
  }

  /**
   * Create a transaction function
   */
  transaction(fn) {
    const self = this;
    return function(...args) {
      self._db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self._db.run('COMMIT');
        self._save();
        return result;
      } catch (e) {
        self._db.run('ROLLBACK');
        throw e;
      }
    };
  }

  /**
   * Close the database
   */
  close() {
    this.saveNow();
    this._db.close();
  }
}

async function initDbAsync() {
  const dataDir = process.env.DATA_DIR || './data';

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'app.db');

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new DbWrapper(new SQL.Database(fileBuffer), dbPath);
  } else {
    db = new DbWrapper(new SQL.Database(), dbPath);
  }

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
      provider TEXT NOT NULL CHECK(provider IN ('google_drive', 'dropbox', 'smtp')),
      config_json TEXT,
      is_active INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date DATE NOT NULL UNIQUE,
      html_content TEXT NOT NULL,
      stats_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_point_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'flagged', 'rejected')),
      reviewer_name TEXT,
      reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      comments TEXT,
      FOREIGN KEY (evidence_point_id) REFERENCES evidence_points(id)
    );

    CREATE TABLE IF NOT EXISTS evidence_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_point_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      file_type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (evidence_point_id) REFERENCES evidence_points(id)
    );

    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      body TEXT,
      evidence_ids TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'failed', 'pending'))
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_requirement ON evidence_points(requirement_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence_points(status);
    CREATE INDEX IF NOT EXISTS idx_evidence_owner ON evidence_points(assigned_owner);
    CREATE INDEX IF NOT EXISTS idx_comments_evidence ON comments(evidence_point_id);
    CREATE INDEX IF NOT EXISTS idx_file_versions_evidence ON file_versions(evidence_point_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_drive_sync_evidence ON drive_sync(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_dropbox_sync_evidence ON dropbox_sync(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
    CREATE INDEX IF NOT EXISTS idx_alert_history_recipient ON alert_history(recipient_email);
    CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at ON alert_history(sent_at);
    CREATE INDEX IF NOT EXISTS idx_reviews_ep ON reviews(evidence_point_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_files_ep ON evidence_files(evidence_point_id);
  `);

  return db;
}

function initDb() {
  // This is now a sync wrapper that returns a promise indicator
  // The actual init happens via initDbAsync() called from server.js
  if (db) return db;
  throw new Error('Database not initialized. Call initDbAsync() first.');
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDbAsync() first.');
  }
  return db;
}

module.exports = {
  getDb,
  initDb,
  initDbAsync
};
