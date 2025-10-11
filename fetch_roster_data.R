#!/usr/bin/env Rscript

# ==============================================================================
# NFL ROSTER DATA FETCHER
# Fetches comprehensive player roster data using nflfastR
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
OUTPUT_DIR <- "data_output/roster_data"

# Parse command line arguments
for (arg in args) {
  if (grepl("^--seasons=", arg)) {
    SEASONS_STR <- sub("^--seasons=", "", arg)
  }
}

# Allow environment variables to override command line args
SEASONS_STR <- Sys.getenv("SEASONS", SEASONS_STR)

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

log_message("=== NFL ROSTER DATA FETCH: Starting ===")
log_message(paste("Seasons:", min(SEASONS), "to", max(SEASONS)))
log_message(paste("Output directory:", OUTPUT_DIR))

# ==============================================================================
# FETCH ROSTER DATA
# ==============================================================================
log_message("Fetching roster data...")

tryCatch({
  roster_data <- fast_scraper_roster(seasons = SEASONS)
  
  log_message(paste("✓ Roster data fetched:", nrow(roster_data), "rows"))
  log_message(paste("✓ Columns:", ncol(roster_data)))
  
  # Inspect data structure
  log_message("Roster data structure:")
  log_message(paste("  - Unique players:", length(unique(roster_data$gsis_id))))
  log_message(paste("  - Seasons covered:", min(roster_data$season), "to", max(roster_data$season)))
  log_message(paste("  - Teams:", length(unique(roster_data$team))))
  log_message(paste("  - Positions:", paste(unique(roster_data$position), collapse = ", ")))
  
  # Check for missing data
  na_counts <- colSums(is.na(roster_data))
  log_message(paste("  - Columns with NAs:", sum(na_counts > 0)))
  
}, error = function(e) {
  log_message(paste("ERROR fetching roster data:", e$message))
  quit(status = 1)
})

# ==============================================================================
# DATA CLEANING
# ==============================================================================
log_message("Applying data cleaning...")

# Select relevant columns for consistency
roster_clean <- roster_data %>%
  select(
    season, team, position, depth_chart_position, jersey_number, 
    status, full_name, first_name, last_name, birth_date, 
    height, weight, college, gsis_id, espn_id, sportradar_id, 
    yahoo_id, rotowire_id, pff_id, pfr_id, fantasy_data_id, 
    sleeper_id, years_exp, headshot_url, ngs_position, 
    week, game_type, status_description_abbr, football_name, esb_id
  )

log_message(paste("Selected", ncol(roster_clean), "relevant columns"))
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
filename <- paste0("roster_data_", season_str, ".csv")
filepath <- file.path(OUTPUT_DIR, filename)

write.csv(roster_clean, filepath, row.names = FALSE)
log_message(paste("✓ Roster data exported to:", filepath))

# Check file size
if (file.exists(filepath)) {
  file_size_mb <- round(file.size(filepath) / 1024 / 1024, 2)
  log_message(paste("  - File size:", file_size_mb, "MB"))
} else {
  log_message("❌ ERROR: Roster data file not created!")
  quit(status = 1)
}

# ==============================================================================
# FINAL SUMMARY
# ==============================================================================
log_message("=== FINAL SUMMARY ===")
log_message(paste("Roster data:"))
log_message(paste("  - Total records:", nrow(roster_clean)))
log_message(paste("  - Unique players:", length(unique(roster_clean$gsis_id))))
log_message(paste("  - Seasons:", min(roster_clean$season), "to", max(roster_clean$season)))
log_message(paste("  - Teams:", length(unique(roster_clean$team))))
log_message(paste("  - Columns:", ncol(roster_clean)))

# Sample data inspection
log_message("Sample roster record:")
sample_roster <- roster_clean[1, ]
log_message(paste("  - Player:", sample_roster$full_name, "(", sample_roster$gsis_id, ")"))
log_message(paste("  - Season:", sample_roster$season, "Team:", sample_roster$team))
log_message(paste("  - Position:", sample_roster$position, "Jersey:", sample_roster$jersey_number))

log_message("=== NFL ROSTER DATA FETCH: Complete ===")
log_message(paste("File created:", filename))
log_message("")
log_message("Ready for Node.js upload script!")
