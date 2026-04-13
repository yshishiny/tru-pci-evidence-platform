const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let dropboxClient = null;

/**
 * Initialize Dropbox client
 */
function initDropboxClient(accessToken) {
  try {
    const { Dropbox } = require('dropbox');

    if (!accessToken) {
      throw new Error('Dropbox access token required');
    }

    dropboxClient = new Dropbox({ auth: accessToken });
    console.log('Dropbox client initialized successfully');
    return dropboxClient;
  } catch (err) {
    console.error('Failed to initialize Dropbox client:', err.message);
    throw err;
  }
}

/**
 * Calculate SHA256 hash of a file
 */
function calculateFileHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch (err) {
    console.error(`Error calculating hash for ${filePath}:`, err);
    return null;
  }
}

/**
 * Create folder structure on Dropbox
 */
async function createFolderStructure(parentPath, requirementFolders) {
  if (!dropboxClient) {
    throw new Error('Dropbox client not initialized');
  }

  const createdFolders = {};

  for (const reqFolder of requirementFolders) {
    try {
      const folderPath = `${parentPath}/Requirement-${reqFolder.id}`;

      // Try to create folder (Dropbox will handle if it already exists)
      try {
        await dropboxClient.filesCreateFolderV2({
          path: folderPath
        });
        console.log(`Created folder: ${folderPath}`);
      } catch (err) {
        // Folder may already exist - that's okay
        if (err.error?.error?.['.tag'] !== 'path' || !err.error?.error?.path?.reason?.['.tag'] !== 'conflict') {
          throw err;
        }
        console.log(`Folder already exists: ${folderPath}`);
      }

      createdFolders[reqFolder.id] = {
        path: folderPath
      };
    } catch (err) {
      console.error(`Failed to create folder for requirement ${reqFolder.id}:`, err.message);
      createdFolders[reqFolder.id] = { error: err.message };
    }
  }

  return createdFolders;
}

/**
 * Upload a single file to Dropbox
 */
async function uploadFileToDropbox(filePath, fileName, parentPath) {
  if (!dropboxClient) {
    throw new Error('Dropbox client not initialized');
  }

  try {
    const fileContent = fs.readFileSync(filePath);
    const dropboxPath = `${parentPath}/${fileName}`;

    const response = await dropboxClient.filesUpload({
      path: dropboxPath,
      contents: fileContent,
      autorename: true,
      mode: { '.tag': 'add' }
    });

    // Get sharing link
    let shareLink = null;
    try {
      const linkResponse = await dropboxClient.sharingCreateSharedLinkWithSettings({
        path: dropboxPath,
        settings: { requested_visibility: { '.tag': 'public' } }
      }).catch(() => null);
      shareLink = linkResponse?.data?.url || null;
    } catch (err) {
      console.log('Could not create share link:', err.message);
    }

    return {
      dropboxPath: response.data.path_display,
      dropboxLink: shareLink,
      rev: response.data.rev
    };
  } catch (err) {
    console.error(`Failed to upload ${fileName} to Dropbox:`, err.message);
    throw err;
  }
}

/**
 * Update an existing file on Dropbox
 */
async function updateFileOnDropbox(filePath, dropboxPath) {
  if (!dropboxClient) {
    throw new Error('Dropbox client not initialized');
  }

  try {
    const fileContent = fs.readFileSync(filePath);

    const response = await dropboxClient.filesUpload({
      path: dropboxPath,
      contents: fileContent,
      autorename: false,
      mode: { '.tag': 'overwrite' }
    });

    return {
      dropboxPath: response.data.path_display,
      rev: response.data.rev
    };
  } catch (err) {
    console.error(`Failed to update file ${dropboxPath} on Dropbox:`, err.message);
    throw err;
  }
}

/**
 * Sync a single file to Dropbox
 */
async function syncSingleFile(db, filePath, evidenceId, parentPath, dropboxSyncRecord) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return { status: 'error', message: 'File not found' };
    }

    const fileHash = calculateFileHash(filePath);
    const fileName = path.basename(filePath);

    // Check if file has been modified since last sync
    if (dropboxSyncRecord && dropboxSyncRecord.file_hash === fileHash) {
      console.log(`Skipping ${fileName} - no changes since last sync`);
      return { status: 'skipped', message: 'No changes' };
    }

    let result;

    if (dropboxSyncRecord && dropboxSyncRecord.dropbox_path) {
      // Update existing file
      result = await updateFileOnDropbox(filePath, dropboxSyncRecord.dropbox_path);
      result.status = 'updated';
    } else {
      // Upload new file
      result = await uploadFileToDropbox(filePath, fileName, parentPath);
      result.status = 'uploaded';
    }

    // Update or insert sync record
    if (dropboxSyncRecord) {
      db.prepare(`
        UPDATE dropbox_sync
        SET dropbox_path = ?, dropbox_link = ?, last_synced = CURRENT_TIMESTAMP, file_hash = ?
        WHERE id = ?
      `).run(result.dropboxPath, result.dropboxLink || dropboxSyncRecord.dropbox_link, fileHash, dropboxSyncRecord.id);
    } else {
      db.prepare(`
        INSERT INTO dropbox_sync (evidence_id, local_path, dropbox_path, dropbox_link, last_synced, file_hash)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(evidenceId, filePath, result.dropboxPath, result.dropboxLink || null, fileHash);
    }

    console.log(`Successfully synced ${fileName} to Dropbox`);
    return result;
  } catch (err) {
    console.error(`Error syncing file ${filePath}:`, err.message);
    return { status: 'error', message: err.message };
  }
}

/**
 * Sync all evidence files to Dropbox
 */
async function syncAllEvidence(db, evidenceDir, parentPath) {
  if (!dropboxClient) {
    throw new Error('Dropbox client not initialized');
  }

  const stats = {
    uploaded: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    totalFiles: 0
  };

  try {
    // Get all evidence points
    const evidencePoints = db.prepare('SELECT * FROM evidence_points').all();

    // Create folder structure by requirement
    const requirements = {};
    for (let i = 1; i <= 12; i++) {
      requirements[i] = {
        id: i,
        name: `Requirement ${i}`
      };
    }

    const folderMap = await createFolderStructure(parentPath, Object.values(requirements));

    // Sync each evidence point
    for (const evidence of evidencePoints) {
      const reqFolderPath = folderMap[evidence.requirement_id]?.path;
      if (!reqFolderPath) {
        console.warn(`Skipping evidence ${evidence.id} - requirement folder not found`);
        stats.errors++;
        continue;
      }

      // Get file versions
      const versions = db.prepare(`
        SELECT * FROM file_versions WHERE evidence_point_id = ?
        ORDER BY version DESC
      `).all(evidence.id);

      if (versions.length === 0) {
        console.log(`Skipping evidence ${evidence.id} - no files`);
        continue;
      }

      const latestVersion = versions[0];
      const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
      const filePath = path.join(uploadDir, evidence.id.toString(), latestVersion.filename);

      const dropboxSyncRecord = db.prepare(`
        SELECT * FROM dropbox_sync WHERE evidence_id = ?
      `).get(evidence.id);

      const result = await syncSingleFile(db, filePath, evidence.id, reqFolderPath, dropboxSyncRecord);

      stats.totalFiles++;
      if (result.status === 'uploaded') {
        stats.uploaded++;
      } else if (result.status === 'updated') {
        stats.updated++;
      } else if (result.status === 'skipped') {
        stats.skipped++;
      } else if (result.status === 'error') {
        stats.errors++;
      }
    }

    console.log('Dropbox sync complete:', stats);
    return stats;
  } catch (err) {
    console.error('Error syncing to Dropbox:', err.message);
    throw err;
  }
}

/**
 * Get sync status
 */
function getSyncStatus(db) {
  try {
    const lastSync = db.prepare(`
      SELECT MAX(last_synced) as last_synced FROM dropbox_sync
    `).get();

    const totalSynced = db.prepare('SELECT COUNT(*) as count FROM dropbox_sync').get().count;

    const syncErrors = db.prepare(`
      SELECT COUNT(*) as count FROM dropbox_sync WHERE dropbox_path IS NULL
    `).get().count;

    return {
      lastSyncTime: lastSync.last_synced || null,
      totalSyncedFiles: totalSynced,
      syncErrors: syncErrors
    };
  } catch (err) {
    console.error('Error getting sync status:', err);
    return { error: err.message };
  }
}

module.exports = {
  initDropboxClient,
  syncAllEvidence,
  syncSingleFile,
  createFolderStructure,
  calculateFileHash,
  uploadFileToDropbox,
  updateFileOnDropbox,
  getSyncStatus
};
