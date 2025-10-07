#!/bin/bash

# NFL Player Stats Pipeline Runner
# This script runs the complete pipeline: R data fetch + Node.js upload

echo "🚀 Starting NFL Player Stats Pipeline..."
echo "========================================"

# Check if R is available
if ! command -v Rscript &> /dev/null; then
    echo "❌ Error: R is not installed or not in PATH"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed or not in PATH"
    exit 1
fi

# Check Firebase environment variables
if [ -z "$FIREBASE_PROJECT_ID" ] || [ -z "$FIREBASE_PRIVATE_KEY" ] || [ -z "$FIREBASE_CLIENT_EMAIL" ]; then
    echo "❌ Error: Firebase environment variables not set"
    echo "Please set: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Step 1: Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install Node.js dependencies"
    exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Step 2: Run R script to fetch data
echo "📊 Fetching NFL player statistics..."
Rscript nfl_player_stats_fetch.R
if [ $? -ne 0 ]; then
    echo "❌ Error: R script failed"
    exit 1
fi
echo "✅ Data fetch completed"
echo ""

# Step 3: Run Node.js script to upload data
echo "🔥 Uploading data to Firebase..."
node upload_player_stats_to_firebase.js
if [ $? -ne 0 ]; then
    echo "❌ Error: Firebase upload failed"
    exit 1
fi
echo "✅ Upload completed"
echo ""

echo "🎉 Pipeline completed successfully!"
echo "========================================"
echo "Check the following files for details:"
echo "  - nfl_player_stats_log.txt (R script log)"
echo "  - upload_errors.json (if any errors occurred)"
echo "  - nfl_data_output/ (CSV files)"
