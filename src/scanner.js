const fs = require('fs');
const path = require('path');

const IGNORE_FILES = ['desktop.ini', '.DS_Store', 'Thumbs.db'];
const REQUIREMENT_REGEX = /^Requirement\s+(\d+)\s*[-–]/i;

function isIgnoredFile(filename) {
  return IGNORE_FILES.includes(filename);
}

function detectEvidenceType(name) {
  const lower = name.toLowerCase();
  if (lower.includes('screenshot')) return 'screenshot';
  if (lower.includes('scan report') || lower.includes('scan reports') || lower.includes('vulnerability scan') || lower.includes('penetration test') || lower.includes('card finder')) return 'scan';
  if (lower.includes('configuration') || lower.includes('config') || lower.includes('ntp') || lower.includes('hsm')) return 'config';
  return 'document';
}

function extractSubReq(folderPath) {
  const match = folderPath.match(/(\d+\.\d+(?:\.\d+)*(?:\.\d+)?)/);
  return match ? match[1] : '';
}

function getLeafDirs(dirPath) {
  // Recursively collect all directories that have no sub-directories (leaf nodes)
  // OR that directly contain evidence files at any level
  const results = [];

  function walk(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch { return; }

    const subDirs = entries.filter(e => e.isDirectory() && !IGNORE_FILES.includes(e.name));
    const files = entries.filter(e => e.isFile() && !isIgnoredFile(e.name));

    if (subDirs.length === 0) {
      // Leaf directory
      results.push({ path: currentPath, hasFiles: files.length > 0 });
    } else {
      // Has sub-dirs — if it also directly has files, count it too
      if (files.length > 0) {
        results.push({ path: currentPath, hasFiles: true });
      }
      // Recurse into sub-dirs
      for (const sd of subDirs) {
        walk(path.join(currentPath, sd.name));
      }
    }
  }

  walk(dirPath);
  return results;
}

function scanFolders(basePath) {
  if (!fs.existsSync(basePath)) {
    console.warn(`Evidence base path does not exist: ${basePath}`);
    return [];
  }

  const allResults = [];

  let items;
  try {
    items = fs.readdirSync(basePath, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch (err) {
    console.error(`Error reading base path: ${err.message}`);
    return [];
  }

  for (const item of items) {
    const match = item.name.match(REQUIREMENT_REGEX);
    if (!match) continue;

    const reqId = parseInt(match[1], 10);
    if (reqId < 1 || reqId > 12) continue;

    const reqPath = path.join(basePath, item.name);

    // Get all leaf directories under this requirement
    const leaves = getLeafDirs(reqPath);

    for (const leaf of leaves) {
      // Build a relative path for storage
      const relativePath = path.relative(basePath, leaf.path);
      const folderName = path.relative(reqPath, leaf.path);

      allResults.push({
        requirement_id: reqId,
        sub_requirement: extractSubReq(leaf.path),
        folder_path: relativePath,
        folder_name: folderName,
        evidence_type: detectEvidenceType(folderName),
        has_files: leaf.hasFiles ? 1 : 0
      });
    }
  }

  console.log(`Scanner found ${allResults.length} evidence points across ${new Set(allResults.map(r => r.requirement_id)).size} requirements`);
  return allResults;
}

function syncToDb(db, scanResults) {
  if (!scanResults || scanResults.length === 0) {
    return { inserted: 0, updated: 0, errors: 0 };
  }

  const stats = { inserted: 0, updated: 0, errors: 0 };

  const insertStmt = db.prepare(`
    INSERT INTO evidence_points (
      requirement_id, sub_requirement, folder_path, folder_name,
      evidence_type, status, has_original_doc, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const updateDocStmt = db.prepare(`
    UPDATE evidence_points SET has_original_doc = 1 WHERE folder_path = ? AND has_original_doc = 0
  `);

  const selectStmt = db.prepare(`
    SELECT id, status FROM evidence_points WHERE folder_path = ?
  `);

  const tx = db.transaction(() => {
    for (const r of scanResults) {
      try {
        const existing = selectStmt.get(r.folder_path);

        if (existing) {
          if (r.has_files) {
            updateDocStmt.run(r.folder_path);
          }
          stats.updated++;
        } else {
          const status = r.has_files ? 'uploaded' : 'empty';
          insertStmt.run(
            r.requirement_id,
            r.sub_requirement,
            r.folder_path,
            r.folder_name,
            r.evidence_type,
            status,
            r.has_files
          );
          stats.inserted++;
        }
      } catch (err) {
        console.error(`Error processing ${r.folder_path}: ${err.message}`);
        stats.errors++;
      }
    }
  });

  tx();
  return stats;
}

module.exports = { scanFolders, syncToDb };
