const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let driveClient = null;
let driveAuthType = null; // 'service_account' or 'oauth2'

/**
 * Initialize Google Drive client
 * Supports both service account and OAuth2 authentication
 */
async function initDriveClient(credentialsPath, authType = 'service_account') {
  try {
    const { google } = require('googleapis');

    if (authType === 'service_account') {
      // Service account authentication
      if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Service account key file not found: ${credentialsPath}`);
      }

      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      driveClient = google.drive({
        version: 'v3',
        auth: new google.auth.GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/drive']
        })
      });
      driveAuthType = 'service_account';
    } else if (authType === 'oauth2') {
      // OAuth2 authentication (requires refresh token)
      if (!fs.existsSync(credentialsPath)) {
        throw new Error(`OAuth2 config file not found: ${credentialsPath}`);
      }

      const config = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      const oauth2Client = new google.auth.OAuth2(
        config.client_id,
        config.client_secret,
        config.redirect_uri || 'http://localhost:3000/oauth2callback'
      );

      oauth2Client.setCredentials({
        refresh_token: config.refresh_token
      });

      driveClient = google.drive({
        version: 'v3',
        auth: oauth2Client
      });
      driveAuthType = 'oauth2';
    } else {
      throw new Error('Invalid auth type. Use "service_account" or "oauth2"');
    }

    console.log('Google Drive client initialized successfully');
    return driveClient;
  } catch (err) {
    console.error('Failed to initialize Drive client:', err.message);
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
 * Create folder structure on Google Drive
 */
async function createFolderStructure(parentFolderId, requirementFolders) {
  if (!driveClient) {
    throw new Error('Drive client not initialized');
  }

  const createdFolders = {};

  for (const reqFolder of requirementFolders) {
    try {
      const response = await driveClient.files.create({
        resource: {
          name: reqFolder.name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id, webViewLink'
      });

      createdFolders[reqFolder.id] = {
        driveId: response.data.id,
        link: response.data.webViewLink
      };

      console.log(`Created folder: ${reqFolder.name} (${response.data.id})`);
    } catch (err) {
      console.error(`Failed to create folder ${reqFolder.name}:`, err.message);
      createdFolders[reqFolder.id] = { error: err.message };
    }
  }

  return createdFolders;
}

/**
 * Upload a single file to Google Drive
 */
async function uploadFileToDrive(filePath, fileName, parentFolderId) {
  if (!driveClient) {
    throw new Error('Drive client not initialized');
  }

  try {
    const fileStream = fs.createReadStream(filePath);

    const response = await driveClient.files.create({
      resource: {
        name: fileName,
        parents: [parentFolderId]
      },
      media: {
        body: fileStream
      },
      fields: 'id, webViewLink, mimeType'
    });

    return {
      driveFileId: response.data.id,
      driveLink: response.data.webViewLink,
      mimeType: response.data.mimeType
    };
  } catch (err) {
    console.error(`Failed to upload ${fileName} to Drive:`, err.message);
    throw err;
  }
}

/**
 * Update an existing file on Google Drive
 */
async function updateFileOnDrive(driveFileId, filePath) {
  if (!driveClient) {
    throw new Error('Drive client not initialized');
  }

  try {
    const fileStream = fs.createReadStream(filePath);

    const response = await driveClient.files.update({
      fileId: driveFileId,
      media: {
        body: fileStream
      },
      fields: 'id, webViewLink'
    });

    return {
      driveFileId: response.data.id,
      driveLink: response.data.webViewLink
    };
  } catch (err) {
    console.error(`Failed to update file ${driveFileId} on Drive:`, err.message);
    throw err;
  }
}

/**
 * Sync a single file to Google Drive
 */
async function syncSingleFile(db, filePath, evidenceId, parentFolderId, driveSyncRecord) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return { status: 'error', message: 'File not found' };
    }

    const fileHash = calculateFileHash(filePath);
    const fileName = path.basename(filePath);

    // Check if file has been modified since last sync
    if (driveSyncRecord && driveSyncRecord.file_hash === fileHash) {
      console.log(`Skipping ${fileName} - no changes since last sync`);
      return { status: 'skipped', message: 'No changes' };
    }

    let result;

    if (driveSyncRecord && driveSyncRecord.drive_file_id) {
      // Update existing file
      result = await updateFileOnDrive(driveSyncRecord.drive_file_id, filePath);
      result.status = 'updated';
    } else {
      // Upload new file
      result = await uploadFileToDrive(filePath, fileName, parentFolderId);
      result.status = 'uploaded';
    }

    // Update or insert sync record
    if (driveSyncRecord) {
      db.prepare(`
        UPDATE drive_sync
        SET drive_file_id = ?, drive_link = ?, last_synced = CURRENT_TIMESTAMP, file_hash = ?
        WHERE id = ?
      `).run(result.driveFileId, result.driveLink, fileHash, driveSyncRecord.id);
    } else {
      db.prepare(`
        INSERT INTO drive_sync (evidence_id, local_path, drive_file_id, drive_link, last_synced, file_hash)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(evidenceId, filePath, result.driveFileId, result.driveLink, fileHash);
    }

    console.log(`Successfully synced ${fileName} to Drive`);
    return result;
  } catch (err) {
    console.error(`Error syncing file ${filePath}:`, err.message);
    return { status: 'error', message: err.message };
  }
}

/**
 * Sync all evidence files to Google Drive
 */
async function syncAllEvidence(db, evidenceDir, parentFolderId) {
  if (!driveClient) {
    throw new Error('Drive client not initialized');
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

    const folderMap = await createFolderStructure(parentFolderId, Object.values(requirements));

    // Sync each evidence point
    for (const evidence of evidencePoints) {
      const reqFolderId = folderMap[evidence.requirement_id]?.driveId;
      if (!reqFolderId) {
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

      const driveSyncRecord = db.prepare(`
        SELECT * FROM drive_sync WHERE evidence_id = ?
      `).get(evidence.id);

      const result = await syncSingleFile(db, filePath, evidence.id, reqFolderId, driveSyncRecord);

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

    console.log('Google Drive sync complete:', stats);
    return stats;
  } catch (err) {
    console.error('Error syncing to Google Drive:', err.message);
    throw err;
  }
}

/**
 * Get sync status
 */
function getSyncStatus(db) {
  try {
    const lastSync = db.prepare(`
      SELECT MAX(last_synced) as last_synced FROM drive_sync
    `).get();

    const totalSynced = db.prepare('SELECT COUNT(*) as count FROM drive_sync').get().count;

    const syncErrors = db.prepare(`
      SELECT COUNT(*) as count FROM drive_sync WHERE drive_file_id IS NULL
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
  initDriveClient,
  syncAllEvidence,
  syncSingleFile,
  createFolderStructure,
  calculateFileHash,
  uploadFileToDrive,
  updateFileOnDrive,
  getSyncStatus
};
