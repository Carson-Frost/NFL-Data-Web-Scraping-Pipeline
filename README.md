# NFL Data Pipeline

Fetch NFL player statistics and roster data using nflfastR, then upload to MongoDB Atlas.

## Requirements

- **R 4.0+** installed
- **Node.js 16+** installed
- **.env file** with MongoDB connection details

## Quick Start

### 1. Install R Dependencies

Open **R**:

```r
install.packages(c("nflfastR", "dplyr"))
```

Exit R (`q()`).

### 2. Install Node Dependencies

In **PowerShell** or **terminal**:

```bash
npm install
```

### 3. Configure MongoDB

Create `.env` file in project root:

```bash
MONGODB_URI=
MONGODB_DATABASE=
```

### 4. Fetch Data

Run R scripts from **terminal/PowerShell**:

```bash
# Season data (default: 2025, REG season)
Rscript fetch_season_data.R

# Weekly data (default: 2025, REG season)
Rscript fetch_weekly_data.R

# Roster data (default: 2025)
Rscript fetch_roster_data.R
```

**Parameters:**
- `--seasons=2025` — Single year
- `--seasons=2022:2025` — Year range  
- `--season-type=REG+POST` — Include playoffs (default: REG)

**Examples:**
```bash
Rscript fetch_season_data.R --seasons=2022:2025 --season-type=REG+POST
Rscript fetch_weekly_data.R --seasons=2024
```

### 5. Upload to MongoDB

```bash
npm run upload_data season
npm run upload_data weekly
npm run upload_data roster
```

## Scripts

| Script | Purpose |
|--------|---------|
| `fetch_season_data.R` | Fetch player season statistics |
| `fetch_weekly_data.R` | Fetch player weekly statistics |
| `fetch_roster_data.R` | Fetch player roster information |
| `upload_data.js` | Upload CSV data to MongoDB |
| `delete_collection.js` | Delete MongoDB collections |

## Database Collections

- **season_stats** — Player season statistics
- **weekly_stats** — Player weekly statistics  
- **roster_data** — Player roster information

## Data Output

CSV files are saved to `data_output/`:
- `data_output/season_stats/` — Season statistics
- `data_output/weekly_stats/` — Weekly statistics
- `data_output/roster_data/` — Roster information

**Note:** Old files are automatically deleted when new data is fetched.

## Delete Collections

```bash
# Delete specific collection
npm run delete_collection season_stats

# Delete all collections
npm run delete_collection all
```

**WARNING:** This permanently deletes all documents in a collection.

## File Naming

Files are named: `[type]_data_[YEAR]_[SEASON_TYPE].csv`

Examples:
- `season_data_2025_REG.csv`
- `weekly_data_2025_REG+POST.csv`
- `roster_data_2025.csv`

Each year gets its own file. Range requests (e.g., `--seasons=2022:2025`) create separate files for each year.

## Examples

**Fetch current season and upload:**
```bash
Rscript fetch_season_data.R
npm run upload_data season
```

**Fetch multi-year historical data:**
```bash
Rscript fetch_season_data.R --seasons=2022:2025
Rscript fetch_weekly_data.R --seasons=2022:2025
npm run upload_data season
npm run upload_data weekly
```

**Fresh start (clear and reload):**
```bash
npm run delete_collection season_stats
Rscript fetch_season_data.R
npm run upload_data season
```

## GitHub Actions

Workflows available for automated fetching and uploading:

- **nfl-season-stats.yml** — Fetch and upload season data
- **nfl-weekly-update.yml** — Fetch and upload season + weekly data
- **nfl-weekly-stats.yml** — Fetch and upload weekly data

Set MongoDB secrets in GitHub repo settings:
- `MONGODB_URI`
- `MONGODB_DATABASE`

## Troubleshooting

**R not found:** Ensure R is installed and added to PATH. Restart terminal after installing.

**MongoDB connection error:** 
- Verify `.env` credentials
- Check MongoDB IP whitelist allows your IP
- URL-encode special characters in password

**Missing packages:** In R/RStudio: `install.packages(c("nflfastR", "dplyr"))`

## Data Source

Data from **nflfastR**: https://www.nflfastr.com/