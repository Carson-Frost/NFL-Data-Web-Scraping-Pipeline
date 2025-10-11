#!/usr/bin/env Rscript

# ==============================================================================
# NFL WEEKLY STATS FETCHER
# Fetches comprehensive player weekly statistics using nflfastR
# ==============================================================================

# Load required libraries
suppressPackageStartupMessages({
  library(nflfastR)
  library(dplyr)
})

# Parse command line arguments
args <- commandArgs(trailingOnly = TRUE)

# Default values
SEASONS_STR <- "2024"
SEASON_TYPE <- "REG"
OUTPUT_DIR <- "data_output/weekly_stats"

# Parse command line arguments
for (arg in args) {
  if (grepl("^--seasons=", arg)) {
    SEASONS_STR <- sub("^--seasons=", "", arg)
  } else if (grepl("^--season-type=", arg)) {
    SEASON_TYPE <- sub("^--season-type=", "", arg)
  }
}

# Allow environment variables to override command line args
SEASONS_STR <- Sys.getenv("SEASONS", SEASONS_STR)
SEASON_TYPE <- Sys.getenv("SEASON_TYPE", SEASON_TYPE)

# Parse seasons string (e.g., "1999:2024" or "2024")
if (grepl(":", SEASONS_STR)) {
  parts <- strsplit(SEASONS_STR, ":")[[1]]
  if (length(parts) == 2 && !is.na(as.numeric(parts[1])) && !is.na(as.numeric(parts[2]))) {
    SEASONS <- as.numeric(parts[1]):as.numeric(parts[2])
  } else {
    stop("Invalid seasons format. Use format like '1999:2024'")
  }
} else {
  if (!is.na(as.numeric(SEASONS_STR))) {
    SEASONS <- as.numeric(SEASONS_STR)
  } else {
    stop("Invalid seasons format. Use format like '1999:2024' or single year like '2024'")
  }
}

# Validate season type
if (!SEASON_TYPE %in% c("REG", "POST", "REG+POST")) {
  stop("Invalid season type. Must be 'REG', 'POST', or 'REG+POST'")
}

# Create output directory
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
  cat("Created output directory:", OUTPUT_DIR, "\n")
}

# Clean up old files in the directory
old_files <- list.files(OUTPUT_DIR, pattern = "*.csv", full.names = TRUE)
if (length(old_files) > 0) {
  cat("Cleaning up old files:\n")
  for (file in old_files) {
    cat("  Removing:", basename(file), "\n")
    file.remove(file)
  }
}

# Logging function
log_message <- function(message) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  log_entry <- paste0("[", timestamp, "] ", message)
  cat(log_entry, "\n")
}

log_message("=== NFL WEEKLY STATS FETCH: Starting ===")
log_message(paste("Seasons:", min(SEASONS), "to", max(SEASONS)))
log_message(paste("Season type:", SEASON_TYPE))
log_message(paste("Output directory:", OUTPUT_DIR))

# ==============================================================================
# FETCH WEEK-LEVEL STATS
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
# DATA CLEANING
# ==============================================================================
log_message("Applying data cleaning...")

# Convert NA values to 0 for numeric stat columns
numeric_cols <- sapply(weekly_stats, is.numeric)
stat_cols <- names(weekly_stats)[numeric_cols & !names(weekly_stats) %in% c("season", "week", "games")]

log_message(paste("Converting NAs to 0 for", length(stat_cols), "stat columns"))
weekly_stats[stat_cols][is.na(weekly_stats[stat_cols])] <- 0

log_message("✓ Data cleaning completed")

# ==============================================================================
# EXPORT TO CSV FILE
# ==============================================================================
log_message("Exporting data to CSV file...")

# Create descriptive filename
if (length(SEASONS) == 1) {
  season_str <- as.character(SEASONS)
} else {
  season_str <- paste0(min(SEASONS), "_to_", max(SEASONS))
}
filename <- paste0("weekly_data_", season_str, "_", SEASON_TYPE, ".csv")
filepath <- file.path(OUTPUT_DIR, filename)

write.csv(weekly_stats, filepath, row.names = FALSE)
log_message(paste("✓ Weekly stats exported to:", filepath))

# Check file size
if (file.exists(filepath)) {
  file_size_mb <- round(file.size(filepath) / 1024 / 1024, 2)
  log_message(paste("  - File size:", file_size_mb, "MB"))
} else {
  log_message("❌ ERROR: Weekly stats file not created!")
  quit(status = 1)
}

# ==============================================================================
# FINAL SUMMARY
# ==============================================================================
log_message("=== FINAL SUMMARY ===")
log_message(paste("Weekly stats:"))
log_message(paste("  - Total records:", nrow(weekly_stats)))
log_message(paste("  - Unique players:", length(unique(weekly_stats$player_id))))
log_message(paste("  - Seasons:", min(weekly_stats$season), "to", max(weekly_stats$season)))
log_message(paste("  - Weeks per season:", length(unique(weekly_stats$week))))
log_message(paste("  - Columns:", ncol(weekly_stats)))

# Sample data inspection
log_message("Sample weekly record:")
sample_weekly <- weekly_stats[1, ]
log_message(paste("  - Player:", sample_weekly$player_name, "(", sample_weekly$player_id, ")"))
log_message(paste("  - Season:", sample_weekly$season, "Week:", sample_weekly$week, "Team:", sample_weekly$recent_team))
log_message(paste("  - Position:", sample_weekly$position, "Games:", sample_weekly$games))

log_message("=== NFL WEEKLY STATS FETCH: Complete ===")
log_message(paste("File created:", filename))
log_message("")
log_message("Ready for Node.js upload script!")
