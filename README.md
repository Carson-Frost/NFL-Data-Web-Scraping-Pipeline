# NFL Data Pipeline

Fetch NFL player statistics and roster data using **nflfastR**: https://www.nflfastr.com/

## Requirements

- **R 4.0+** installed

## Quick Start

### 1. Install R Dependencies

Open **R**:

```r
install.packages(c("nflfastR", "dplyr"))
```

### 2. Fetch Data

Run R scripts*:

```bash
# Season data (default: 2025, REG season)
Rscript fetch_season_data.R

# Weekly data (default: 2025, REG season)
Rscript fetch_weekly_data.R

# Roster data (default: 2025)
Rscript fetch_roster_data.R

# Schedule data (default: 2025)
Rscript fetch_schedule_data.R
```

**Parameters:**
- `--seasons=2025` — Single year
- `--seasons=2022:2025` — Year range  
- `--season-type=REG+POST` — Include playoffs (default: REG)

**Examples:**
```bash
Rscript fetch_season_data.R --seasons=2022:2025 --season-type=REG+POST
Rscript fetch_weekly_data.R --seasons=1999
Rscript fetch_roster_data.R --seasons=2020:2025
Rscript fetch_schedule_data.R --seasons=2010
```


## Scripts

| Script | Purpose |
|--------|---------|
| `fetch_season_data.R` | Fetch player season statistics |
| `fetch_weekly_data.R` | Fetch player weekly statistics |
| `fetch_roster_data.R` | Fetch player roster information |
| `fetch_schedules.R` | Fetch season schedule information |


## Data Output

CSV files are saved to `output/`:
- `output/season_stats/` — Season statistics
- `output/weekly_stats/` — Weekly statistics
- `output/roster_data/` — Roster information
- `output/schedule_data/` — Schedule information


## File Naming

Files are named: `[type]_data_[YEAR]_[SEASON_TYPE].csv`

Examples:
- `season_data_2025_REG.csv`
- `weekly_data_2025_REG+POST.csv`
- `roster_data_2025.csv`
- `schedule_data_2025.csv`

Each year gets its own file. Range requests (e.g., `--seasons=2022:2025`) create separate files for each year.