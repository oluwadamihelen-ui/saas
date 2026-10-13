# RiskPilot one-click setup for Windows. Double-click "start-windows.bat" instead of running this directly.
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot
$Host.UI.RawUI.WindowTitle = "RiskPilot setup"

function Fail($msg) {
  Write-Host ""
  Write-Host "  PROBLEM: $msg" -ForegroundColor Red
  Write-Host ""
  Write-Host "  Take a screenshot of this window and send it to whoever is helping you." -ForegroundColor Yellow
  Read-Host "  Press Enter to close this window"
  exit 1
}
function Step($n, $text) { Write-Host ""; Write-Host "  [$n/5] $text" -ForegroundColor Cyan }

Write-Host ""
Write-Host "  ==============================" -ForegroundColor Green
Write-Host "    RiskPilot - setup" -ForegroundColor Green
Write-Host "  ==============================" -ForegroundColor Green

# ---- 1. Node.js
Step 1 "Checking Node.js"
$nodeVersion = $null
try { $nodeVersion = (node -v) 2>$null } catch {}
if (-not $nodeVersion) { Fail "Node.js is not installed. Go to https://nodejs.org , download the LTS version, install it (click Next on everything), then double-click start-windows.bat again." }
$major = [int](($nodeVersion -replace "v", "").Split(".")[0])
if ($major -lt 20) { Fail "Your Node.js is too old ($nodeVersion). Install the newest LTS from https://nodejs.org and try again." }
Write-Host "      Node.js $nodeVersion - OK"

# ---- 2. Settings file (.env)
Step 2 "Connecting to your database"
if (-not (Test-Path ".env")) {
  Write-Host ""
  Write-Host "      Paste your database connection string below, then press Enter." -ForegroundColor Yellow
  Write-Host "      (It starts with postgresql:// - see START-HERE.txt, Part 2. Right-click pastes in this window.)"
  Write-Host ""
  $db = (Read-Host "      Connection string").Trim().Trim('"').Trim("'")
  if ($db -notmatch "^postgres(ql)?://") { Fail "That does not look like a connection string. It must start with postgresql://  - please run this again and paste the whole line from Neon." }
  $chars = (48..57) + (65..90) + (97..122)
  $secret = -join ($chars | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  $lines = @(
    "DATABASE_URL=""$db""",
    "AUTH_SECRET=""$secret""",
    "AUTH_URL=""http://localhost:3000""",
    "APP_URL=""http://localhost:3000""",
    "PAYMENT_PROVIDER=""mock""",
    "STORAGE_PROVIDER=""local""",
    "STORAGE_LOCAL_DIR="".uploads"""
  )
  Set-Content -Path ".env" -Value $lines -Encoding ascii
  Write-Host "      Saved."
} else {
  Write-Host "      Already set up - OK"
}

# ---- 3. Install
Step 3 "Installing the app's parts (first time only - takes 3 to 6 minutes, please wait)"
if (-not (Test-Path "node_modules")) {
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail "The install failed. Check your internet connection and run start-windows.bat again." }
} else { Write-Host "      Already installed - OK" }

# ---- 4. Database
Step 4 "Preparing the database"
npx prisma generate
if ($LASTEXITCODE -ne 0) { Fail "Could not prepare the app code." }
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Fail "Could not reach your database. Open the .env file in this folder and check that the DATABASE_URL line is exactly what Neon gave you (use the DIRECT connection, not the 'pooled' one)." }
if (-not (Test-Path ".seeded")) {
  Write-Host "      Adding demo data..."
  npm run db:seed
  if ($LASTEXITCODE -ne 0) { Fail "Could not add the demo data." }
  Set-Content -Path ".seeded" -Value "done" -Encoding ascii
}

# ---- 5. Start
Step 5 "Starting RiskPilot"
Write-Host ""
Write-Host "      Your browser will open in a few seconds." -ForegroundColor Green
Write-Host "      The FIRST page can take about 30 seconds to appear - that is normal." -ForegroundColor Green
Write-Host "      Log in with:  demo@riskpilot.app   /   Passw0rd!" -ForegroundColor Green
Write-Host "      KEEP THIS WINDOW OPEN while you use the app. Close it to stop RiskPilot." -ForegroundColor Yellow
Write-Host ""
Start-Job -ScriptBlock { Start-Sleep -Seconds 12; Start-Process "http://localhost:3000" } | Out-Null
npm run dev
Read-Host "  RiskPilot stopped. Press Enter to close"
