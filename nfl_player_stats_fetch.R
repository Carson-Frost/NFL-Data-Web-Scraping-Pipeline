#!/usr/bin/env Rscript

# ==============================================================================
# NFL PLAYER STATS FETCH - Comprehensive Player Statistics
# Fetches all player stats since 1999 using nflfastR calculate_stats()
# ==============================================================================

# Load required libraries
suppressPackageStartupMessages({
  library(nflfastR)
  library(dplyr)
})

# Configuration
# Allow environment variables to override defaults
SEASONS_STR <- Sys.getenv("SEASONS", "1999:2024")
SEASON_TYPE <- Sys.getenv("SEASON_TYPE", "REG")

# Parse seasons string (e.g., "1999:2024" or "2020:2024")
if (grepl(":", SEASONS_STR)) {
  parts <- strsplit(SEASONS_STR, ":")[[1]]
  SEASONS <- as.numeric(parts[1]):as.numeric(parts[2])
} else {
  SEASONS <- as.numeric(SEASONS_STR)
}
OUTPUT_DIR <- "nfl_data_output"
LOG_FILE <- "nfl_player_stats_log.txt"

# Create output directory
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
  cat("Created output directory:", OUTPUT_DIR, "\n")
}

# Logging function
log_message <- function(message) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  log_entry <- paste0("[", timestamp, "] ", message)
  cat(log_entry, "\n")
  cat(log_entry, "\n", file = LOG_FILE, append = TRUE)
}

log_message("=== NFL PLAYER STATS FETCH: Starting ===")
log_message(paste("Seasons:", min(SEASONS), "to", max(SEASONS)))
log_message(paste("Season type:", SEASON_TYPE))

# ==============================================================================
# STEP 1: FETCH SEASON-LEVEL STATS
# ==============================================================================
log_message("Fetching season-level player statistics...")

tryCatch({
  season_stats <- calculate_stats(
    seasons = SEASONS,
    summary_level = "season",
    stat_type = "player",
    season_type = SEASON_TYPE
  )
  
  log_message(paste("✓ Season stats fetched:", nrow(season_stats), "rows"))
  log_message(paste("✓ Columns:", ncol(season_stats)))
  
  # Inspect data structure
  log_message("Season stats structure:")
  log_message(paste("  - Unique players:", length(unique(season_stats$player_id))))
  log_message(paste("  - Seasons covered:", min(season_stats$season), "to", max(season_stats$season)))
  log_message(paste("  - Sample player_id:", head(unique(season_stats$player_id), 3)))
  
  # Check for missing data
  na_counts <- colSums(is.na(season_stats))
  log_message(paste("  - Columns with NAs:", sum(na_counts > 0)))
  
}, error = function(e) {
  log_message(paste("ERROR fetching season stats:", e$message))
  quit(status = 1)
})

# ==============================================================================
# STEP 2: FETCH WEEK-LEVEL STATS
# ==============================================================================
log_message("Fetching week-level player statistics...")

tryCatch({
  weekly_stats <- calculate_stats(
    seasons = SEASONS,
    summary_level = "week",
    stat_type = "player",
    season_type = SEASON_TYPE
  )
  
  log_message(paste("✓ Weekly stats fetched:", nrow(weekly_stats), "rows"))
  log_message(paste("✓ Columns:", ncol(weekly_stats)))
  
  # Inspect data structure
  log_message("Weekly stats structure:")
  log_message(paste("  - Unique players:", length(unique(weekly_stats$player_id))))
  log_message(paste("  - Seasons covered:", min(weekly_stats$season), "to", max(weekly_stats$season)))
  log_message(paste("  - Weeks per season:", length(unique(weekly_stats$week))))
  log_message(paste("  - Sample player_id:", head(unique(weekly_stats$player_id), 3)))
  
  # Check for missing data
  na_counts <- colSums(is.na(weekly_stats))
  log_message(paste("  - Columns with NAs:", sum(na_counts > 0)))
  
}, error = function(e) {
  log_message(paste("ERROR fetching weekly stats:", e$message))
  quit(status = 1)
})

# ==============================================================================
# STEP 3: DATA VALIDATION
# ==============================================================================
log_message("Validating data quality...")

# Check if both datasets have same columns
if (!identical(names(season_stats), names(weekly_stats))) {
  log_message("WARNING: Season and weekly stats have different columns!")
  log_message(paste("Season columns:", length(names(season_stats))))
  log_message(paste("Weekly columns:", length(names(weekly_stats))))
}

# Check for duplicate player-season combinations
season_dupes <- season_stats %>%
  group_by(player_id, season) %>%
  summarise(count = n(), .groups = 'drop') %>%
  filter(count > 1)

if (nrow(season_dupes) > 0) {
  log_message(paste("WARNING: Found", nrow(season_dupes), "duplicate player-season combinations"))
} else {
  log_message("✓ No duplicate player-season combinations found")
}

# Check for duplicate player-week combinations
weekly_dupes <- weekly_stats %>%
  group_by(player_id, season, week) %>%
  summarise(count = n(), .groups = 'drop') %>%
  filter(count > 1)

if (nrow(weekly_dupes) > 0) {
  log_message(paste("WARNING: Found", nrow(weekly_dupes), "duplicate player-week combinations"))
} else {
  log_message("✓ No duplicate player-week combinations found")
}

# ==============================================================================
# STEP 4: DATA CLEANING (Optional)
# ==============================================================================
log_message("Applying data cleaning...")

# Convert NA values to 0 for numeric stat columns (optional)
# This is a design decision - you might want to keep NAs instead
numeric_cols <- sapply(season_stats, is.numeric)
stat_cols <- names(season_stats)[numeric_cols & !names(season_stats) %in% c("season", "week", "games")]

log_message(paste("Converting NAs to 0 for", length(stat_cols), "stat columns"))

season_stats[stat_cols][is.na(season_stats[stat_cols])] <- 0
weekly_stats[stat_cols][is.na(weekly_stats[stat_cols])] <- 0

log_message("✓ Data cleaning completed")

# ==============================================================================
# STEP 5: EXPORT TO CSV FILES
# ==============================================================================
log_message("Exporting data to CSV files...")

# Export season stats
season_file <- file.path(OUTPUT_DIR, "season_stats.csv")
write.csv(season_stats, season_file, row.names = FALSE)
log_message(paste("✓ Season stats exported to:", season_file))

# Check file size
if (file.exists(season_file)) {
  file_size_mb <- round(file.size(season_file) / 1024 / 1024, 2)
  log_message(paste("  - File size:", file_size_mb, "MB"))
} else {
  log_message("❌ ERROR: Season stats file not created!")
  quit(status = 1)
}

# Export weekly stats
weekly_file <- file.path(OUTPUT_DIR, "weekly_stats.csv")
write.csv(weekly_stats, weekly_file, row.names = FALSE)
log_message(paste("✓ Weekly stats exported to:", weekly_file))

# Check file size
if (file.exists(weekly_file)) {
  file_size_mb <- round(file.size(weekly_file) / 1024 / 1024, 2)
  log_message(paste("  - File size:", file_size_mb, "MB"))
} else {
  log_message("❌ ERROR: Weekly stats file not created!")
  quit(status = 1)
}

# ==============================================================================
# STEP 6: FINAL VERIFICATION
# ==============================================================================
log_message("Final verification...")

# Summary statistics
log_message("=== FINAL SUMMARY ===")
log_message(paste("Season stats:"))
log_message(paste("  - Total records:", nrow(season_stats)))
log_message(paste("  - Unique players:", length(unique(season_stats$player_id))))
log_message(paste("  - Seasons:", min(season_stats$season), "to", max(season_stats$season)))
log_message(paste("  - Columns:", ncol(season_stats)))

log_message(paste("Weekly stats:"))
log_message(paste("  - Total records:", nrow(weekly_stats)))
log_message(paste("  - Unique players:", length(unique(weekly_stats$player_id))))
log_message(paste("  - Seasons:", min(weekly_stats$season), "to", max(weekly_stats$season)))
log_message(paste("  - Weeks per season:", length(unique(weekly_stats$week))))
log_message(paste("  - Columns:", ncol(weekly_stats)))

# Sample data inspection
log_message("Sample season record:")
sample_season <- season_stats[1, ]
log_message(paste("  - Player:", sample_season$player_name, "(", sample_season$player_id, ")"))
log_message(paste("  - Season:", sample_season$season, "Team:", sample_season$recent_team))
log_message(paste("  - Position:", sample_season$position, "Games:", sample_season$games))

log_message("Sample weekly record:")
sample_weekly <- weekly_stats[1, ]
log_message(paste("  - Player:", sample_weekly$player_name, "(", sample_weekly$player_id, ")"))
log_message(paste("  - Season:", sample_weekly$season, "Week:", sample_weekly$week, "Team:", sample_weekly$recent_team))
log_message(paste("  - Position:", sample_weekly$position, "Games:", sample_weekly$games))

log_message("=== NFL PLAYER STATS FETCH: Complete ===")
log_message("Files created:")
log_message("  - season_stats.csv")
log_message("  - weekly_stats.csv")
log_message("")
log_message("Ready for Node.js upload script!")
