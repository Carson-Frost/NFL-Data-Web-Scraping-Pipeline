# NFL Player Stats Pipeline Runner (PowerShell)
# This script runs the complete pipeline: R data fetch + Node.js upload

Write-Host "Starting NFL Player Stats Pipeline..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Check if R is available
try {
    $rVersion = Rscript --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "R not found"
    }
    Write-Host "R is available" -ForegroundColor Green
} catch {
    Write-Host "Error: R is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if Node.js is available
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    Write-Host "Node.js is available" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "npm not found"
    }
    Write-Host "npm is available" -ForegroundColor Green
} catch {
    Write-Host "Error: npm is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check Firebase environment variables
if (-not $env:FIREBASE_PROJECT_ID -or -not $env:FIREBASE_PRIVATE_KEY -or -not $env:FIREBASE_CLIENT_EMAIL) {
    Write-Host "Error: Firebase environment variables not set" -ForegroundColor Red
    Write-Host "Please set: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL" -ForegroundColor Yellow
    exit 1
}

Write-Host "Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# Step 1: Install Node.js dependencies
Write-Host "Installing Node.js dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install Node.js dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 2: Run R script to fetch data
Write-Host "Fetching NFL player statistics..." -ForegroundColor Cyan
Rscript nfl_player_stats_fetch.R
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: R script failed" -ForegroundColor Red
    exit 1
}
Write-Host "Data fetch completed" -ForegroundColor Green
Write-Host ""

# Step 3: Run Node.js script to upload data
Write-Host "Uploading data to Firebase..." -ForegroundColor Cyan
node upload_player_stats_to_firebase.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Firebase upload failed" -ForegroundColor Red
    exit 1
}
Write-Host "Upload completed" -ForegroundColor Green
Write-Host ""

Write-Host "Pipeline completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Check the following files for details:" -ForegroundColor Yellow
Write-Host "  - nfl_player_stats_log.txt (R script log)" -ForegroundColor White
Write-Host "  - upload_errors.json (if any errors occurred)" -ForegroundColor White
Write-Host "  - nfl_data_output/ (CSV files)" -ForegroundColor White
