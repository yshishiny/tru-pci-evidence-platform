# Quick Deploy Guide — 5 Minutes to Live

## What's Already Done
- GitHub repo created: https://github.com/yshishiny/tru-pci-evidence-platform
- Full app code is in this folder, tested and working
- Docker + Railway configs ready

---

## Step 1: Push Code to GitHub (2 min)

Open a terminal in THIS folder (`tru-pci-evidence-platform/`) and run:

```bash
git remote add origin https://github.com/yshishiny/tru-pci-evidence-platform.git
git branch -M main
git push -u origin main
```

(GitHub will ask for your credentials — use a Personal Access Token as password)

---

## Step 2: Connect Railway to GitHub (2 min)

1. Go to https://railway.com/new
2. Click "GitHub Repository"
3. Select `yshishiny/tru-pci-evidence-platform`
4. Railway will auto-detect the Dockerfile and start building

---

## Step 3: Configure Railway (1 min)

In the Railway project settings, add these:

**Volume:**
- Click the service → Settings → Add Volume
- Mount path: `/data`

**Environment Variables:**
- `JWT_SECRET` = (any random string, e.g. `tru-pci-secret-2026-iexperts`)
- `DEFAULT_PASSWORD` = `Tru@PCI2026`
- `EVIDENCE_DIR` = `/data/evidence`
- `DATA_DIR` = `/data`
- `NODE_ENV` = `production`

**Generate Domain:**
- Click the service → Settings → Networking → Generate Domain

---

## Step 4: Access Your Platform

Visit your Railway domain (e.g., `tru-pci-evidence-platform.up.railway.app`)

Login credentials:

| Username | Password | Role |
|----------|----------|------|
| yasser | Tru@PCI2026 | Admin (full access) |
| amr | Tru@PCI2026 | TRU IT Team |
| tamer | Tru@PCI2026 | TRU IT Team |
| ahmad | Tru@PCI2026 | TRU IT Team |
| iexpert_pm | Tru@PCI2026 | iExpert PM |
| iexpert_grc | Tru@PCI2026 | iExpert GRC |
| assessor | Tru@PCI2026 | PCI QSA Assessor |

---

## To Upload Evidence Files

After deployment, you can upload evidence through the web UI.
The TRU team members (Amr, Tamer, Ahmad) can upload files to their assigned requirements.
