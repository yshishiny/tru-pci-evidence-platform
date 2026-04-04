#!/bin/bash
# TRU PCI DSS Evidence Platform - Push & Seed Script
# Run this from the tru-pci-evidence-platform folder

echo "=== Step 1: Push updated code to GitHub ==="
echo "This will push: seed endpoint, upgraded dashboard, JSON limit increase"

# Initialize git if needed
if [ ! -d ".git" ]; then
    git init
    git add -A
    git commit -m "Add bulk seed endpoint, upgrade dashboard, increase JSON limit"
fi

# Add remote if needed
git remote add origin https://github.com/yshishiny/tru-pci-evidence-platform.git 2>/dev/null

# Push
git push -u origin master || git push -u origin main

echo ""
echo "=== Step 2: Wait for Railway to redeploy ==="
echo "Railway will auto-detect the push and rebuild (~2-3 minutes)"
echo "Check: https://tru-pci-evidence-platform-production.up.railway.app/api/health"
echo ""
echo "Once deployed, run Step 3 below..."
echo ""
echo "=== Step 3: Seed Evidence Data ==="
echo "Run this after Railway redeploy completes:"
echo ""
echo 'TOKEN=$(curl -s -X POST https://tru-pci-evidence-platform-production.up.railway.app/api/auth/login -H "Content-Type: application/json" -d '"'"'{"username":"yasser","password":"Tru@PCI2026"}'"'"' | python3 -c "import sys,json; print(json.load(sys.stdin)['"'"'token'"'"'])")'
echo ""
echo 'curl -X POST https://tru-pci-evidence-platform-production.up.railway.app/api/admin/seed-evidence -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d @evidence_data.json'
echo ""
echo "=== Done! ==="
