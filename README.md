# NFL Data Pipeline - Web Scraping with nflfastr
(https://www.nflfastr.com/)

A modular NFL data pipeline that fetches player statistics and roster data using nflfastR. Optionally uploads data to Firebase Firestore using a custom nodejs script. Each data type can be fetched independently.

## Overview

This pipeline consists of separate R scripts for each data type:

1. **`fetch_season_data.R`** - Fetches player season statistics
2. **`fetch_weekly_data.R`** - Fetches player weekly statistics  
3. **`fetch_roster_data.R`** - Fetches player roster information
4. **`upload_nfl_data_to_firebase.js`** - Optional: Uploads data to Firebase Firestore (for my personal use case)

## Features

- **Modular Design**: Run only the data types you need
- **Automatic File Management**: Old files are automatically removed to prevent project bloat
- **Descriptive File Names**: Files are named based on seasons and data type
- **Comprehensive Data**: All player statistics from 1999 to present are possible with nflfastr
- **Optional Firebase Upload**: Upload to Firebase Firestore if needed
- **Progress Tracking**: Real-time progress updates during data fetching
- **Optimized Performance**: Separate files per year for faster processing

## File Management Strategy

### Automatic Cleanup

**Why files are deleted**: This pipeline automatically removes old data files before creating new ones to prevent your project from growing significantly in size over time.

**What happens**: When you run any R script, it will:
1. **Delete old files** of the same type (e.g., old season data files)
2. **Create new files** with the data you requested
3. **Show you exactly** which files were removed

**Your responsibility**: After running the scripts, you should:
- **Copy files elsewhere** if you want to keep them
- **Upload to a database** using the Node.js script
- **Process the data** in your own applications
- **Archive files** to external storage

**Example workflow**:
```bash
# Run script (deletes old files, creates new ones)
Rscript fetch_season_data.R --seasons=2024

# Immediately after, do something with the files:
# Option 1: Upload to Firebase
node upload_nfl_data_to_firebase.js season

# Option 2: Copy to backup location
copy data_output\season_stats\*.csv C:\backup\nfl_data\

# Option 3: Process with your own tools
python my_data_processor.py
```

This approach keeps your project directory clean while ensuring you always have the most recent data available.

## Part 1: R Setup and Data Fetching

### Install R Dependencies

**Step 1**: Open **R** or **RStudio** and run:

```r
install.packages(c("nflfastR", "dplyr"))
```

**Step 2**: Exit R (type `q()` and press Enter)

### Fetch NFL Data

**Step 3**: Open **PowerShell** or **terminal** and run the appropriate script:

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

## Part 2: Optional Firebase Upload

### Prerequisites for Firebase Upload

- **Node.js Environment**: Node.js 16+ with npm
- **Firebase Setup**: Firebase project with Firestore enabled
- **Firebase Credentials**: Firebase service account credentials

### Install Node.js Dependencies

Run in **PowerShell** or **terminal**:

```bash
npm install
```

### Set up Firebase Environment Variables

Create a `.env` file in the project root with your Firebase credentials:

```bash
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL="your-client-email"
```

### Upload Data to Firebase

After fetching data with R scripts, upload to Firebase. **You must specify which data type to upload:**

```bash
# Upload season statistics
node upload_nfl_data_to_firebase.js season

# Upload weekly statistics  
node upload_nfl_data_to_firebase.js weekly

# Upload roster data
node upload_nfl_data_to_firebase.js roster
```

**Valid data types:**
- `season` - Upload season statistics data
- `weekly` - Upload weekly statistics data  
- `roster` - Upload roster data

The upload script will automatically:
- Find the most recent files for the specified data type
- Upload them to the appropriate Firebase collection
- Handle batch processing and error recovery
- Provide progress updates

### Delete Firebase Collections

**⚠️ WARNING: This permanently deletes all documents in a Firestore collection!**

To safely delete a Firebase collection before uploading new data:

```bash
# Delete a specific collection
node delete_firestore_collection.js season_stats

# Or use npm script
npm run delete-collection season_stats

# Interactive mode (shows available collections)
node delete_firestore_collection.js
```

**Safety Features:**
- **User Confirmation**: Must type "DELETE" to confirm
- **Batch Processing**: Deletes in batches of 500 to avoid limits
- **Progress Tracking**: Shows deletion progress and statistics
- **Error Handling**: Safe error recovery and logging

**Example Usage:**
```bash
# Clean slate before uploading new season data
node delete_firestore_collection.js season_stats
# Type "DELETE" when prompted
# Then upload new data
node upload_nfl_data_to_firebase.js
```

## File Structure

```
├── fetch_season_data.R              # Season statistics fetcher
├── fetch_weekly_data.R              # Weekly statistics fetcher
├── fetch_roster_data.R              # Roster data fetcher
├── upload_nfl_data_to_firebase.js   # Firebase upload script
├── delete_firestore_collection.js   # Firebase collection deletion script
├── data_output/                     # Output directory
│   ├── season_stats/                # Season statistics files
│   │   ├── season_data_2024_REG.csv
│   │   ├── season_data_2023_REG.csv
│   │   └── season_data_2022_REG.csv
│   ├── weekly_stats/                # Weekly statistics files
│   │   ├── weekly_data_2024_REG.csv
│   │   ├── weekly_data_2023_REG.csv
│   │   └── weekly_data_2022_REG.csv
│   └── roster_data/                 # Roster data files
│       ├── roster_data_2024.csv
│       ├── roster_data_2023.csv
│       └── roster_data_2022.csv
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

- **Season Data**: `season_data_[YEAR]_[SEASON_TYPE].csv`
  - Example: `season_data_2024_REG.csv`
  - Example: `season_data_2020_REG+POST.csv`
  - **Multiple files**: Each year gets its own file for better performance
  - **Range requests**: `--seasons=2020:2024` creates separate files for 2020, 2021, 2022, 2023, 2024

- **Weekly Data**: `weekly_data_[YEAR]_[SEASON_TYPE].csv`
  - Example: `weekly_data_2024_REG.csv`
  - Example: `weekly_data_2020_REG+POST.csv`
  - **Multiple files**: Each year gets its own file for better performance
  - **Range requests**: `--seasons=2020:2024` creates separate files for 2020, 2021, 2022, 2023, 2024

- **Roster Data**: `roster_data_[YEAR].csv`
  - Example: `roster_data_2024.csv`
  - Example: `roster_data_2020.csv`
  - **Multiple files**: Each year gets its own file for better performance
  - **Range requests**: `--seasons=2020:2024` creates separate files for 2020, 2021, 2022, 2023, 2024

Where:
- `[YEAR]` is a single year (e.g., `2024`)
- `[SEASONS]` is either a single year (e.g., `2024`) or a range (e.g., `2020_to_2024`)
- `[SEASON_TYPE]` is `REG`, `POST`, or `REG+POST`

## Examples

### Example 1: Fetch Current Season Data Only
```bash
# Creates: season_data_2024_REG.csv
Rscript fetch_season_data.R
```

### Example 2: Fetch Historical Data (Multiple Files)
```bash
# Creates: season_data_2020_REG.csv, season_data_2021_REG.csv, 
#          season_data_2022_REG.csv, season_data_2023_REG.csv, season_data_2024_REG.csv
Rscript fetch_season_data.R --seasons=2020:2024

# Creates: weekly_data_2020_REG.csv, weekly_data_2021_REG.csv,
#          weekly_data_2022_REG.csv, weekly_data_2023_REG.csv, weekly_data_2024_REG.csv
Rscript fetch_weekly_data.R --seasons=2020:2024

# Creates: roster_data_2020.csv, roster_data_2021.csv,
#          roster_data_2022.csv, roster_data_2023.csv, roster_data_2024.csv
Rscript fetch_roster_data.R --seasons=2020:2024
```

### Example 3: Fetch Playoff Data (Multiple Files)
```bash
# Creates: season_data_2024_REG+POST.csv
Rscript fetch_season_data.R --seasons=2024 --season-type=REG+POST

# Creates: weekly_data_2024_REG+POST.csv
Rscript fetch_weekly_data.R --seasons=2024 --season-type=REG+POST

# Creates: roster_data_2024.csv (roster data doesn't have season type)
Rscript fetch_roster_data.R --seasons=2024
```

### Example 4: Complete Pipeline (R + Firebase)
```bash
# Step 1: Fetch data with R (creates multiple files for each data type)
Rscript fetch_season_data.R --seasons=2020:2024
Rscript fetch_weekly_data.R --seasons=2020:2024
Rscript fetch_roster_data.R --seasons=2020:2024

# Step 2: Upload all files to Firebase
node upload_nfl_data_to_firebase.js season
node upload_nfl_data_to_firebase.js weekly
node upload_nfl_data_to_firebase.js roster
```

### Example 5: Clean Slate Firebase Workflow
```bash
# Step 1: Delete existing Firebase collection (with confirmation)
node delete_firestore_collection.js season_stats
# Type "DELETE" when prompted

# Step 2: Fetch fresh data
Rscript fetch_season_data.R --seasons=2024

# Step 3: Upload to Firebase
node upload_nfl_data_to_firebase.js season
```

### Example 6: File Management Workflow
```bash
# Step 1: Fetch new data (old files are automatically deleted)
Rscript fetch_season_data.R --seasons=2024

# Step 2: Immediately process the files (before next run deletes them)
# Option A: Upload to Firebase
node upload_nfl_data_to_firebase.js season

# Option B: Copy to backup
copy data_output\season_stats\*.csv C:\backup\nfl_data\

# Option C: Process with your tools
python my_analysis.py data_output/season_stats/
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

### NPM Scripts

You can use npm scripts for convenience:

```bash
# R Scripts
npm run fetch-season
npm run fetch-weekly  
npm run fetch-roster

# Node.js Scripts
npm run upload-season
npm run upload-weekly
npm run upload-roster
npm run delete-collection season_stats
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

2. **"Error: unexpected symbol in 'Rscript'" Error**:
   - **Problem**: You're trying to run `Rscript` commands in R console
   - **Solution**: `Rscript` commands must be run in PowerShell/terminal, not in R
   - **Correct**: PowerShell → `Rscript fetch_season_data.R`
   - **Wrong**: R Console → `Rscript fetch_season_data.R`
   - **Fix**: Exit R (`q()`) → Open PowerShell → Run `Rscript` command

3. **R Script Errors**: 
   - **Problem**: R scripts fail to run
   - **Solution**: Make sure you've installed the required packages in R/RStudio first
   - **Check**: Ensure `nflfastR` and `dplyr` packages are installed

4. **Firebase Authentication** (if using Firebase): Ensure `.env` file exists with correct credentials
5. **Memory Issues**: R scripts load large datasets into memory
6. **Rate Limiting** (if using Firebase): Adjust `BATCH_DELAY_SECONDS` if you hit Firebase rate limits
7. **Disk Space**: Ensure sufficient space for CSV files

### Resume Failed Uploads

If the upload fails, simply run the Node.js script again with the same data type:
```bash
node upload_nfl_data_to_firebase.js season
```

The script will resume from where it left off and attempt to upload the remaining data files.

### Check Error Logs

All errors are displayed in the console during execution. Review the console output for detailed error information if uploads fail.

## Performance

### R Scripts Performance
- **Single year**: ~30-60 seconds per year
- **Multiple years**: ~2-5 minutes for 5 years (with progress updates)
- **Memory usage**: ~500MB-1GB RAM during processing
- **Progress tracking**: Real-time updates showing current year and percentage complete

### File Management Benefits
- **Separate files per year**: Faster processing and uploads
- **Automatic cleanup**: Prevents project directory from growing large
- **Smaller file sizes**: ~680KB per year vs 18MB for all years
- **Better error recovery**: If one year fails, others still succeed

### Firebase Upload Performance
- **Multiple files**: Node.js automatically combines all year files
- **Batch processing**: Efficient uploads with progress tracking
- **Memory efficient**: Processes smaller files individually
- **Upload time**: ~30-60 minutes for 5 years of data

## Data Volume Estimates

### Per Year (Season Data):
- **Season Stats**: ~1,800 players × 1 year = ~1,800 records
- **File Size**: ~680KB per year
- **Processing Time**: ~30-60 seconds per year

### Per Season (Weekly/Roster Data):
- **Weekly Stats**: ~2,000 players × 17 weeks = ~34,000 records  
- **Roster Data**: ~2,000 players × 1 season = ~2,000 records

### Historical Data (1999-2025):
- **Season Stats**: ~49,000 records across 27 separate files
- **Weekly Stats**: ~850,000 records in single files
- **Roster Data**: ~50,000 records in single files

## Future Enhancements

- Incremental updates for new seasons
- Data validation and quality checks
- Performance optimizations for larger datasets
- Advanced error recovery and retry logic
- Command-line interface for easier parameter management