# NFL Player Statistics Data Pipeline

A comprehensive data pipeline that fetches all NFL player statistics since 1999 and uploads them to Firebase Firestore.

## Overview

This pipeline consists of two main components:

1. **R Script** (`nfl_player_stats_fetch.R`) - Fetches comprehensive player statistics using the `nflfastR` package
2. **Node.js Script** (`upload_player_stats_to_firebase.js`) - Uploads the data to Firebase Firestore with batch processing and error handling

## Features

- **Comprehensive Data**: All player statistics from 1999-2024 (25+ years of data)
- **Two Granularities**: Season-level and week-level statistics
- **Batch Processing**: Efficient Firebase uploads with 500-document batches
- **Checkpoint Recovery**: Resume uploads if the process crashes
- **Error Handling**: Detailed error logging and graceful failure handling
- **Progress Tracking**: Real-time progress updates during upload

## Database Schema

### Collection 1: `/season_stats/{year_playerId}`
Document ID format: `"2023_00-0036389"`

Contains player statistics aggregated by season with all 113 stat columns.

### Collection 2: `/weekly_stats/{year_week_playerId}`
Document ID format: `"2023_05_00-0036389"`

Contains player statistics for individual weeks with all 113 stat columns.

## Setup

### Prerequisites

- R with `nflfastR` package installed
- Node.js 16+ with npm
- Firebase project with Firestore enabled
- Firebase service account credentials

### Installation

1. Install R dependencies:
```r
install.packages(c("nflfastR", "dplyr"))
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Set up Firebase environment variables:
```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_PRIVATE_KEY="your-private-key"
export FIREBASE_CLIENT_EMAIL="your-client-email"
```

## Usage

### Step 1: Fetch Player Statistics

Run the R script to fetch and export player statistics:

```bash
Rscript nfl_player_stats_fetch.R
```

This will create:
- `nfl_data_output/season_stats.csv` (~50,000 records)
- `nfl_data_output/weekly_stats.csv` (~850,000 records)

### Step 2: Upload to Firebase

Run the Node.js script to upload the data:

```bash
npm run upload
```

Or directly:
```bash
node upload_player_stats_to_firebase.js
```

## Expected Data Volume

- **Season Stats**: ~50,000 documents (2,000 players × 25 seasons)
- **Weekly Stats**: ~850,000 documents (2,000 players × 25 seasons × 17 weeks)
- **Total Upload**: ~1.8 million write operations

## File Structure

```
├── nfl_player_stats_fetch.R          # R script to fetch player stats
├── upload_player_stats_to_firebase.js # Node.js upload script
├── package.json                      # Node.js dependencies
├── nfl_data_output/                  # Output directory
│   ├── season_stats.csv             # Season-level statistics
│   └── weekly_stats.csv             # Week-level statistics
├── upload_checkpoint.json           # Checkpoint file (auto-generated)
├── upload_errors.json               # Error log (auto-generated)
└── README.md                        # This file
```

## Configuration

### R Script Configuration

Edit `nfl_player_stats_fetch.R` to modify:
- `SEASONS`: Year range (default: 1999:2024)
- `SEASON_TYPE`: "REG" for regular season, "REG+POST" for playoffs
- `OUTPUT_DIR`: Output directory for CSV files

### Node.js Script Configuration

Edit `upload_player_stats_to_firebase.js` to modify:
- `BATCH_SIZE`: Documents per batch (default: 500)
- `BATCH_DELAY`: Delay between batches in ms (default: 750)
- File paths for CSV files and checkpoint

## Error Handling

The pipeline includes comprehensive error handling:

- **Checkpoint Recovery**: If the upload crashes, it can resume from where it left off
- **Batch Error Handling**: Individual batch failures don't stop the entire process
- **Error Logging**: All errors are logged to `upload_errors.json`
- **Data Validation**: Verifies data integrity before and after upload

## Monitoring Progress

The upload script provides detailed progress information:

- Current batch number and total batches
- Percentage complete
- Records uploaded so far
- Estimated time remaining
- Error counts and details

## Troubleshooting

### Common Issues

1. **Firebase Authentication**: Ensure environment variables are set correctly
2. **Memory Issues**: The R script loads large datasets into memory
3. **Rate Limiting**: Adjust `BATCH_DELAY` if you hit Firebase rate limits
4. **Disk Space**: Ensure sufficient space for CSV files (~500MB total)

### Resume Failed Uploads

If the upload fails, simply run the Node.js script again. It will automatically resume from the last checkpoint.

### Check Error Logs

Review `upload_errors.json` for detailed error information if uploads fail.

## Performance

- **R Script**: ~5-10 minutes to fetch all data
- **Upload Script**: ~2-4 hours for complete upload (depending on network and Firebase performance)
- **Memory Usage**: ~2-4GB RAM during R processing
- **Disk Usage**: ~500MB for CSV files

## GitHub Actions Workflows

This project includes two GitHub Actions workflows for automated execution:

### 1. Full Historical Pipeline (`nfl-player-stats-pipeline.yml`)
- **Purpose**: Fetch ALL player stats since 1999
- **Trigger**: Manual via GitHub Actions UI
- **Data Volume**: ~1.8 million documents
- **Runtime**: ~2-4 hours

### 2. Weekly Updates (`nfl-weekly-update.yml`)
- **Purpose**: Update current season data
- **Trigger**: Every Monday at 2 AM UTC (automatic)
- **Data Volume**: ~50,000 documents (current season)
- **Runtime**: ~30-60 minutes

### Setup Instructions:
1. Set up Firebase service account
2. Add secrets to GitHub repository:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
3. Run workflows from GitHub Actions tab

See [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) for detailed setup instructions.

## Future Enhancements

- Incremental updates for new seasons
- Data validation and quality checks
- Performance optimizations for larger datasets
- Advanced error recovery and retry logic
