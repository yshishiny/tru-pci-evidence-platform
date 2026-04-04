# Cloud Sync Integration Guide

This document describes the Google Drive and Dropbox synchronization features added to the TRU PCI DSS Evidence Platform.

## Overview

The cloud sync feature allows evidence files to be automatically synchronized to Google Drive or Dropbox, enabling team members and assessors to download, review, and collaborate on evidence files independently.

## Architecture

### New Files Created

1. **src/cloud-sync.js** - Google Drive synchronization module
2. **src/dropbox-sync.js** - Dropbox synchronization module
3. **src/routes/cloud-sync.js** - Express routes for cloud sync API
4. **public/js/cloud-sync.js** - Frontend UI component
5. **public/html/cloud-sync-panel.html** - HTML template for cloud sync panel

### Database Tables

Three new tables were added to track cloud synchronization:

- **drive_sync** - Tracks Google Drive file synchronization
  - evidence_id, local_path, drive_file_id, drive_link, last_synced, file_hash

- **dropbox_sync** - Tracks Dropbox file synchronization
  - evidence_id, local_path, dropbox_path, dropbox_link, last_synced, file_hash

- **cloud_config** - Stores cloud provider configurations
  - provider, config_json, is_active, updated_at

## Google Drive Setup

### Prerequisites

1. Google Cloud Project with Drive API enabled
2. Service Account with Drive API access

### Step 1: Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API
4. Create a Service Account:
   - Go to "Service Accounts" in the sidebar
   - Create a new service account
   - Grant it the "Editor" role (or custom role with Drive API access)
5. Create a JSON key for the service account:
   - Open the service account
   - Go to "Keys" tab
   - Create a new JSON key
   - Download the key file

### Step 2: Create Google Drive Folder

1. Create a folder in Google Drive for evidence storage
2. Share the folder with the service account email:
   - Copy the service account email from the JSON key
   - Right-click the folder in Drive
   - Click "Share"
   - Add the service account email with "Editor" role

### Step 3: Configure in Platform

1. Log in as admin
2. Go to **Admin > Cloud Sync > Google Drive tab**
3. Enter:
   - **Google Drive Parent Folder ID**: The ID from the Drive folder URL
   - **Service Account Key File Path**: Path to your downloaded JSON key file
   - Check "Activate Google Drive sync" to enable
4. Click "Save Configuration"

### Step 4: Trigger Sync

1. In the Google Drive tab, click "Sync Google Drive"
2. The system will:
   - Create a folder structure mirroring local evidence structure
   - Upload all evidence files
   - Store file IDs for future syncs
3. View status showing files uploaded/updated/skipped

## Dropbox Setup

### Prerequisites

1. Dropbox Business account
2. App created in Dropbox Developer Console

### Step 1: Create Dropbox App

1. Go to [Dropbox Developer Console](https://www.dropbox.com/developers/apps)
2. Create a new app:
   - Choose "Scoped access"
   - Choose "Full Dropbox" or "App folder"
   - Give your app a name
3. In the app settings:
   - Go to "Permissions" and enable:
     - files.metadata.read
     - files.content.read
     - files.content.write
   - Go to "OAuth 2" and set a redirect URI (e.g., http://localhost:3000/oauth2callback)

### Step 2: Get Access Token

1. In app settings, go to "OAuth 2" section
2. Generate an access token:
   - Click "Generate" under "Access token"
   - Copy the generated token
3. Keep this token secure - it grants access to your Dropbox

### Step 3: Configure in Platform

1. Log in as admin
2. Go to **Admin > Cloud Sync > Dropbox tab**
3. Enter:
   - **Dropbox Access Token**: Your generated access token
   - **Parent Folder Path**: Path where sync folders will be created (e.g., `/PCI_Evidence`)
   - Check "Activate Dropbox sync" to enable
4. Click "Save Configuration"

### Step 4: Trigger Sync

1. In the Dropbox tab, click "Sync Dropbox"
2. The system will:
   - Create folder structure in Dropbox
   - Upload all evidence files
   - Generate shareable links
3. View status showing files uploaded/updated/skipped

## API Endpoints

### Cloud Sync Routes

All endpoints require authentication. Admin-only endpoints require admin role.

#### GET /api/cloud-sync/status
- **Description**: Get sync status for a provider
- **Query Parameters**:
  - `provider` (required): 'google_drive' or 'dropbox'
- **Response**:
  ```json
  {
    "provider": "google_drive",
    "status": {
      "lastSyncTime": "2024-01-15T10:30:00Z",
      "totalSyncedFiles": 150,
      "syncErrors": 2
    }
  }
  ```
- **Auth**: Admin only

#### POST /api/cloud-sync/trigger
- **Description**: Trigger a full sync to the specified provider
- **Body**:
  ```json
  {
    "provider": "google_drive"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "provider": "google_drive",
    "stats": {
      "uploaded": 45,
      "updated": 10,
      "skipped": 95,
      "errors": 0,
      "totalFiles": 150
    }
  }
  ```
- **Auth**: Admin only

#### GET /api/cloud-sync/config
- **Description**: Get current configuration for a provider (without secrets)
- **Query Parameters**:
  - `provider` (required): 'google_drive' or 'dropbox'
- **Response**:
  ```json
  {
    "provider": "google_drive",
    "configured": true,
    "is_active": true,
    "updated_at": "2024-01-15T10:00:00Z"
  }
  ```
- **Auth**: Admin only

#### POST /api/cloud-sync/config
- **Description**: Save or update cloud provider configuration
- **Body** (Google Drive):
  ```json
  {
    "provider": "google_drive",
    "config_data": {
      "parent_folder_id": "1ABC123xyz",
      "credentials_path": "/path/to/service-account-key.json",
      "auth_type": "service_account"
    },
    "activate": true
  }
  ```
- **Body** (Dropbox):
  ```json
  {
    "provider": "dropbox",
    "config_data": {
      "access_token": "sl.XXXXXXX",
      "parent_path": "/PCI_Evidence"
    },
    "activate": true
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "provider": "google_drive",
    "message": "google_drive configuration saved and activated"
  }
  ```
- **Auth**: Admin only

#### GET /api/cloud-sync/link/:evidence_id
- **Description**: Get the cloud storage link for a specific evidence file
- **Query Parameters**:
  - `provider` (required): 'google_drive' or 'dropbox'
- **Response** (Google Drive):
  ```json
  {
    "provider": "google_drive",
    "link": "https://drive.google.com/file/d/FILE_ID/view",
    "file_id": "FILE_ID"
  }
  ```
- **Response** (Dropbox):
  ```json
  {
    "provider": "dropbox",
    "link": "https://www.dropbox.com/s/SHARE_CODE/filename",
    "path": "/PCI_Evidence/Requirement-1/filename"
  }
  ```
- **Auth**: Any authenticated user

## Usage

### Admin Panel

1. Log in as admin
2. Navigate to **Admin > Cloud Sync**
3. Select Google Drive or Dropbox tab
4. Configure credentials and parent folder
5. Click "Sync [Provider]" to start synchronization

### Viewing Evidence Links

Team members and assessors can view cloud storage links for evidence files:

1. Navigate to evidence file details
2. Look for "Cloud Links" section (implemented in evidence view)
3. Click link to open file in Google Drive or Dropbox

## How It Works

### Sync Process

1. **Folder Structure Creation**:
   - System creates folders for each requirement (1-12)
   - Mirrors local evidence directory structure

2. **File Upload**:
   - Scans all evidence points in database
   - Gets latest file version from local storage
   - Calculates file hash to detect changes
   - Uploads new files or updates modified files
   - Skips unchanged files (based on hash comparison)

3. **Sync Tracking**:
   - Records file ID, link, and hash in sync table
   - Updates last_synced timestamp
   - Enables incremental syncs on future runs

### Error Handling

- Failed uploads logged in database with error details
- Sync continues even if individual files fail
- Errors reported in sync stats
- Retryable errors can be fixed and sync re-run

## Security Considerations

1. **Service Account Keys**:
   - Store JSON keys securely (not in version control)
   - Use appropriate file permissions
   - Consider rotating keys periodically

2. **Dropbox Tokens**:
   - Store tokens securely in environment or encrypted config
   - Treat like passwords
   - Can be revoked in Dropbox settings if compromised

3. **Access Control**:
   - Only admins can configure cloud sync
   - Authenticated users can view links for evidence they have access to
   - Consider folder-level sharing to restrict access

4. **Data Privacy**:
   - Evidence files synced to cloud storage
   - Ensure cloud provider complies with regulatory requirements
   - Consider encryption for sensitive evidence

## Troubleshooting

### Google Drive Sync Issues

- **"Folder not found"**: Verify folder ID and service account has access
- **"Permission denied"**: Share Google Drive folder with service account email
- **"Invalid credentials path"**: Check file path is correct and readable

### Dropbox Sync Issues

- **"Invalid access token"**: Regenerate token in Dropbox Developer Console
- **"Folder not found"**: Verify parent path format (should start with /)
- **"Share link failed"**: Check app has files.metadata and files.content permissions

### General Issues

- **No files synced**: Check evidence points have files uploaded
- **Sync hangs**: Check file sizes, may timeout on large files
- **Audit log shows errors**: Check sync stats and individual errors

## Future Enhancements

- OAuth2 flow for Google Drive (instead of service account)
- Incremental sync by requirement or folder
- Schedule automatic syncs
- Selective sync (choose which evidence to sync)
- Sync status dashboard with real-time updates
- Two-way sync (download from cloud)
- Webhook support for external integrations
