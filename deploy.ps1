# TRU PCI DSS - Deploy updated files to GitHub
# Run from PowerShell in the tru-pci-evidence-platform folder

Write-Host "=== TRU PCI DSS Platform Deploy ===" -ForegroundColor Cyan

# Navigate to repo directory
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoDir
Write-Host "Working in: $repoDir" -ForegroundColor Gray

# Check git status
Write-Host "`nChecking modified files..." -ForegroundColor Yellow
git status --short

# Stage the 3 updated files
Write-Host "`nStaging files..." -ForegroundColor Yellow
git add server.js
git add public/evidence-reviewer.html
git add public/ceo-dashboard.html

# Show what will be committed
Write-Host "`nFiles to commit:" -ForegroundColor Yellow
git diff --cached --stat

# Commit
$msg = "Add IExperts audit status layer + dual progress metrics (TRU upload 85% vs Audit 15% approved)"
Write-Host "`nCommitting: $msg" -ForegroundColor Green
git commit -m $msg

# Push
Write-Host "`nPushing to GitHub (Railway auto-deploys)..." -ForegroundColor Green
git push origin main

Write-Host "`n=== Deploy complete! Railway will auto-deploy in ~60 seconds ===" -ForegroundColor Cyan
Write-Host "Check: https://tru-pci-evidence-platform-production.up.railway.app/reviewer" -ForegroundColor White
Write-Host "CEO:   https://tru-pci-evidence-platform-production.up.railway.app/ceo" -ForegroundColor White
