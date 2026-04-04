# Quick Start: Cloud Sync Integration

## What Was Built

A complete cloud synchronization system that allows evidence files to be synced to Google Drive and Dropbox. The system automatically mirrors your local evidence folder structure in the cloud and keeps files synchronized.

## Files Added

### Backend
- `src/cloud-sync.js` - Google Drive sync logic
- `src/dropbox-sync.js` - Dropbox sync logic
- `src/routes/cloud-sync.js` - API endpoints (/api/cloud-sync/*)

### Frontend
- `public/js/cloud-sync.js` - UI component and event handlers
- Cloud Sync tab added to Admin panel (`public/js/admin.js`)

### Database
- Three new tables: `drive_sync`, `dropbox_sync`, `cloud_config`

### Documentation
- `CLOUD_SYNC_SETUP.md` - Detailed setup guide
- `IMPLEMENTATION_SUMMARY.md` - Technical summary

## Quick Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server (database tables auto-create):
   ```bash
   npm start
   ```

3. Log in as admin and go to **Admin > Cloud Sync**

## Google Drive Setup (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create service account and download JSON key
3. In Google Drive, create a folder for evidence
4. Share folder with service account email
5. Get folder ID from Drive URL
6. In admin panel:
   - Click Google Drive tab
   - Enter folder ID and key file path
   - Check "Activate"
   - Click "Save Configuration"
7. Click "Sync Google Drive"

## Dropbox Setup (5 minutes)

1. Go to [Dropbox Developer Console](https://www.dropbox.com/developers/apps)
2. Create a Scoped Access app
3. Generate access token
4. In admin panel:
   - Click Dropbox tab
   - Enter access token
   - Enter parent path (e.g., /PCI_Evidence)
   - Check "Activate"
   - Click "Save Configuration"
5. Click "Sync Dropbox"

## How It Works

1. **First Sync**:
   - Creates folder structure (Requirement 1-12)
   - Uploads all evidence files
   - Records file IDs and links

2. **Subsequent Syncs**:
   - Checks file hashes to detect changes
   - Only uploads modified files
   - Skips unchanged files

3. **Access**:
   - Admins: Configure and trigger syncs
   - All users: Get cloud links for evidence files

## API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cloud-sync/status?provider=google_drive` | GET | Check last sync status |
| `/api/cloud-sync/trigger` | POST | Start manual sync |
| `/api/cloud-sync/config?provider=google_drive` | GET | Get current config |
| `/api/cloud-sync/config` | POST | Save new config |
| `/api/cloud-sync/link/123?provider=google_drive` | GET | Get file link |

## Example Curl Commands

```bash
# Get sync status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/cloud-sync/status?provider=google_drive"

# Trigger sync
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"google_drive"}' \
  http://localhost:3000/api/cloud-sync/trigger

# Get evidence file link
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/cloud-sync/link/5?provider=google_drive"
```

## Database Schema

Three new tables track cloud synchronization:

```sql
-- Google Drive tracking
drive_sync(id, evidence_id, local_path, drive_file_id, drive_link, last_synced, file_hash)

-- Dropbox tracking
dropbox_sync(id, evidence_id, local_path, dropbox_path, dropbox_link, last_synced, file_hash)

-- Provider configuration
cloud_config(id, provider, config_json, is_active, updated_at)
```

## Key Features

✓ Google Drive integration (service account auth)
✓ Dropbox integration (access token auth)
✓ Automatic folder structure mirroring
✓ Incremental sync (only changed files)
✓ File hash tracking
✓ Shareable links for files
✓ Admin configuration UI
✓ REST API endpoints
✓ Audit logging
✓ Error handling

## Security Notes

- Google: Service account key stored on disk
- Dropbox: Token stored in encrypted config
- Only admins can configure
- Audit logs all operations
- File hashes prevent unnecessary uploads

## Troubleshooting

**"No files synced"**
- Check evidence points have files uploaded
- Verify configuration is active

**"Permission denied"**
- Google: Share Drive folder with service account email
- Dropbox: Check access token has correct permissions

**"Folder not found"**
- Google: Verify folder ID (from URL, not name)
- Dropbox: Verify path format (should start with /)

**"Credentials file not found"**
- Check file path is absolute and readable
- Ensure file exists at specified location

## Next Steps

1. Read `CLOUD_SYNC_SETUP.md` for detailed instructions
2. Read `IMPLEMENTATION_SUMMARY.md` for technical details
3. Start with Google Drive (simpler setup)
4. Test manual sync before considering automation
5. Monitor audit logs for any issues

## Support

Check the admin panel Cloud Sync status for:
- Last sync time
- Total files synced
- Error count

All operations are logged in audit trail for debugging.
