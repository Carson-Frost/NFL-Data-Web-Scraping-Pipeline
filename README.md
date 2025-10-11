# NFL Data Pipeline - Web Scraping with nflfastr (https://www.nflfastr.com/)

A modular NFL data pipeline that fetches player statistics and roster data using nflfastR and uploads them to Firebase Firestore. Each data type can be fetched independently.

## Overview

This pipeline consists of separate R scripts for each data type and a Node.js upload script:

1. **`fetch_season_data.R`** - Fetches player season statistics
2. **`fetch_weekly_data.R`** - Fetches player weekly statistics  
3. **`fetch_roster_data.R`** - Fetches player roster information
4. **`upload_nfl_data_to_firebase.js`** - Uploads data to Firebase Firestore (what I'm using for this particular project)

## Features

- **Modular Design**: Run only the data types you need
- **Automatic Cleanup**: Old files are automatically removed when running new fetches
- **Descriptive File Names**: Files are named based on seasons and data type
- **Comprehensive Data**: All player statistics from 1999 to present are possible with nflfastr
- **Batch Processing**: Efficient Firebase uploads with error handling
- **Checkpoint Recovery**: Resume uploads if the process crashes

## Setup

### Prerequisites

- **R Environment**: R with `nflfastR` package installed (install via R or RStudio)
- **Node.js Environment**: Node.js 16+ with npm (install via PowerShell/terminal)
- **Firebase Setup**: Firebase project with Firestore enabled
- **Firebase Credentials**: Firebase service account credentials

### Installation

1. **Install R dependencies** (run these commands in R or RStudio):
```r
install.packages(c("nflfastR", "dplyr"))
```

2. **Install Node.js dependencies** (run in PowerShell/terminal):
```bash
npm install
```

3. **Set up Firebase environment variables** in `.env` file:
```bash
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL="your-client-email"
```

## Usage

### Important: Two Different Environments

This pipeline uses **two different programming environments**:

1. **R Environment** (for data fetching):
   - Open **R** or **RStudio**
   - Run the R scripts to fetch NFL data
   - Commands start with `Rscript` and run in PowerShell/terminal

2. **Node.js Environment** (for Firebase upload):
   - Run in **PowerShell** or **terminal**
   - Uploads the CSV files to Firebase
   - Commands start with `node` and run in PowerShell/terminal

### Step 1: Fetch Data (Choose One or More)

#### Fetch Season Statistics
```bash
# Fetch current season (2024)
Rscript fetch_season_data.R

# Fetch specific season
Rscript fetch_season_data.R --seasons=2023

# Fetch range of seasons
Rscript fetch_season_data.R --seasons=2020:2024

# Fetch with different season type
Rscript fetch_season_data.R --seasons=2024 --season-type=REG+POST
```

**Parameters:**
- `--seasons=X` or `--seasons=X:Y` - Season(s) to fetch (default: 2024)
- `--season-type=TYPE` - Season type: REG, POST, or REG+POST (default: REG)

#### Fetch Weekly Statistics
```bash
# Fetch current season weekly stats
Rscript fetch_weekly_data.R

# Fetch specific season weekly stats
Rscript fetch_weekly_data.R --seasons=2023

# Fetch range of seasons weekly stats
Rscript fetch_weekly_data.R --seasons=2020:2024

# Fetch with different season type
Rscript fetch_weekly_data.R --seasons=2024 --season-type=REG+POST
```

**Parameters:**
- `--seasons=X` or `--seasons=X:Y` - Season(s) to fetch (default: 2024)
- `--season-type=TYPE` - Season type: REG, POST, or REG+POST (default: REG)

#### Fetch Roster Data
```bash
# Fetch current season roster
Rscript fetch_roster_data.R

# Fetch specific season roster
Rscript fetch_roster_data.R --seasons=2023

# Fetch range of seasons roster
Rscript fetch_roster_data.R --seasons=2020:2024
```

**Parameters:**
- `--seasons=X` or `--seasons=X:Y` - Season(s) to fetch (default: 2024)

### Step 2: Upload to Firebase

After running one or more R scripts, upload the data to Firebase:

```bash
node upload_nfl_data_to_firebase.js
```

The upload script will automatically:
- Find the most recent files in each data directory
- Upload them to the appropriate Firebase collections
- Handle batch processing and error recovery
- Provide progress updates

## File Structure

```
├── fetch_season_data.R              # Season statistics fetcher
├── fetch_weekly_data.R              # Weekly statistics fetcher
├── fetch_roster_data.R              # Roster data fetcher
├── upload_nfl_data_to_firebase.js   # Firebase upload script
├── data_output/                     # Output directory
│   ├── season_stats/                # Season statistics files
│   │   └── season_data_2024_REG.csv
│   ├── weekly_stats/                # Weekly statistics files
│   │   └── weekly_data_2024_REG.csv
│   └── roster_data/                 # Roster data files
│       └── roster_data_2024.csv
├── firebase-env-example.txt         # Firebase environment template
├── GITHUB_ACTIONS_SETUP.md          # GitHub Actions setup guide
├── package.json                     # Node.js dependencies
└── README.md                        # This file
```

## Database Schema

### Collection 1: `/season_stats/{year_playerId}`
Document ID format: `"2024_00-0036389"`

Contains player statistics aggregated by season with all stat columns.

### Collection 2: `/weekly_stats/{year_week_playerId}`
Document ID format: `"2024_05_00-0036389"`

Contains player statistics for individual weeks with all stat columns.

### Collection 3: `/roster_data/{year_playerId}`
Document ID format: `"2024_00-0036389"`

Contains player roster information including position, team, jersey number, etc.

## File Naming Convention

Files are automatically named based on the data they contain:

- **Season Data**: `season_data_[SEASONS]_[SEASON_TYPE].csv`
  - Example: `season_data_2024_REG.csv`
  - Example: `season_data_2020_to_2024_REG+POST.csv`

- **Weekly Data**: `weekly_data_[SEASONS]_[SEASON_TYPE].csv`
  - Example: `weekly_data_2024_REG.csv`
  - Example: `weekly_data_2020_to_2024_REG+POST.csv`

- **Roster Data**: `roster_data_[SEASONS].csv`
  - Example: `roster_data_2024.csv`
  - Example: `roster_data_2020_to_2024.csv`

Where:
- `[SEASONS]` is either a single year (e.g., `2024`) or a range (e.g., `2020_to_2024`)
- `[SEASON_TYPE]` is `REG`, `POST`, or `REG+POST`

## Examples

### Example 1: Fetch Current Season Data
```bash
# Fetch all current season data
Rscript fetch_season_data.R
Rscript fetch_weekly_data.R
Rscript fetch_roster_data.R

# Upload to Firebase
node upload_nfl_data_to_firebase.js
```

### Example 2: Fetch Historical Data
```bash
# Fetch 5 years of season stats
Rscript fetch_season_data.R --seasons=2020:2024

# Upload to Firebase
node upload_nfl_data_to_firebase.js
```

### Example 3: Fetch Playoff Data
```bash
# Fetch current season including playoffs
Rscript fetch_season_data.R --seasons=2024 --season-type=REG+POST
Rscript fetch_weekly_data.R --seasons=2024 --season-type=REG+POST

# Upload to Firebase
node upload_nfl_data_to_firebase.js
```

## Configuration

### Environment Variables

You can override script parameters using environment variables in **PowerShell**:

```powershell
# Set seasons
$env:SEASONS="2020:2024"

# Set season type  
$env:SEASON_TYPE="REG+POST"

# Run script
Rscript fetch_season_data.R
```

### Firebase Upload Configuration

Configure upload behavior in `.env`:

```bash
# Batch delay in seconds (default: 2)
BATCH_DELAY_SECONDS=2

# Maximum retry attempts (default: 3)
MAX_RETRIES=3
```

## Error Handling

The pipeline includes comprehensive error handling:

- **Automatic Cleanup**: Old files are removed before new fetches
- **Batch Error Handling**: Individual batch failures don't stop the entire process
- **Data Validation**: Verifies data integrity before and after upload
- **Console Logging**: All errors are logged to the console during execution

## Monitoring Progress

The upload script provides detailed progress information:

- Current batch number and total batches
- Percentage complete
- Records uploaded so far
- Error counts and details
- File sizes and processing times

## Troubleshooting

### Common Issues

1. **"The term 'c' is not recognized" Error**: 
   - **Problem**: You're trying to run R commands in PowerShell
   - **Solution**: R package installation commands must be run in R or RStudio, not PowerShell
   - **Correct**: Open R/RStudio → `install.packages(c("nflfastR", "dplyr"))`
   - **Wrong**: PowerShell → `install.packages(c("nflfastR", "dplyr"))`

2. **Firebase Authentication**: Ensure `.env` file exists with correct credentials
3. **Memory Issues**: R scripts load large datasets into memory
4. **Rate Limiting**: Adjust `BATCH_DELAY_SECONDS` if you hit Firebase rate limits
5. **Disk Space**: Ensure sufficient space for CSV files

### Resume Failed Uploads

If the upload fails, simply run the Node.js script again:
```bash
node upload_nfl_data_to_firebase.js
```

The script will start fresh and attempt to upload all available data files.

### Check Error Logs

All errors are displayed in the console during execution. Review the console output for detailed error information if uploads fail.

## Performance

- **R Scripts**: ~2-5 minutes per season depending on data type
- **Upload Script**: ~30-60 minutes for a full season (depending on network and Firebase performance)
- **Memory Usage**: ~1-2GB RAM during R processing
- **Disk Usage**: ~50-200MB per season depending on data type

## Data Volume Estimates

### Per Season:
- **Season Stats**: ~2,000 players × 1 season = ~2,000 records
- **Weekly Stats**: ~2,000 players × 17 weeks = ~34,000 records  
- **Roster Data**: ~2,000 players × 1 season = ~2,000 records

### Historical Data (1999-2024):
- **Season Stats**: ~50,000 records
- **Weekly Stats**: ~850,000 records
- **Roster Data**: ~50,000 records

## Future Enhancements

- Incremental updates for new seasons
- Data validation and quality checks
- Performance optimizations for larger datasets
- Advanced error recovery and retry logic
- Command-line interface for easier parameter management