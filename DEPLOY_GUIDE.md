# TRU PCI DSS Evidence Platform — Railway Deployment Guide

## Quick Deploy (3 Steps)

### Step 1: Login to Railway
```bash
railway login
```

### Step 2: Initialize Project
```bash
cd tru-pci-evidence-platform
railway init
# Choose: "Create new project"
# Name: tru-pci-evidence
```

### Step 3: Deploy
```bash
# Add a volume for persistent data
railway volume add --mount /data

# Set environment variables
railway vars set JWT_SECRET=$(openssl rand -hex 32)
railway vars set DEFAULT_PASSWORD=Tru@PCI2026
railway vars set EVIDENCE_DIR=/data/evidence
railway vars set DATA_DIR=/data
railway vars set NODE_ENV=production

# Deploy
railway up

# Get your URL
railway domain
```

## After Deployment

1. Visit your Railway URL
2. Login with: `yasser` / `Tru@PCI2026`
3. Go to Admin panel → Trigger folder scan if needed
4. Share URLs with team members using their assigned credentials

## Default Users

| Username | Password | Role |
|----------|----------|------|
| yasser | Tru@PCI2026 | Admin |
| amr | Tru@PCI2026 | TRU IT Team |
| tamer | Tru@PCI2026 | TRU IT Team |
| ahmad | Tru@PCI2026 | TRU IT Team |
| iexpert_pm | Tru@PCI2026 | iExpert PM |
| iexpert_grc | Tru@PCI2026 | iExpert GRC |
| assessor | Tru@PCI2026 | Assessor |

## Uploading Evidence Data

To populate the platform with existing evidence files:
1. SSH or use Railway's file manager to copy files to `/data/evidence/`
2. The folder structure should mirror the PCI DSS requirements:
   ```
   /data/evidence/
   ├── Requirement 1 - Network Security Controls/
   │   ├── 001 - Security policy.../
   │   ├── 002 - Roles and responsibilities.../
   │   ...
   ```
3. Go to Admin → Trigger Re-scan to detect new files

## Troubleshooting

- **Can't login**: Check DEFAULT_PASSWORD env var matches what you're typing
- **No evidence points**: Ensure EVIDENCE_DIR points to correct path, run admin scan
- **Upload fails**: Check /data/uploads has write permissions (volume mount)
