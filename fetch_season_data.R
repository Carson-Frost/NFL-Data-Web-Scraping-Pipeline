#!/usr/bin/env Rscript

# ==============================================================================
# NFL SEASON STATS FETCHER
# Fetches comprehensive player season statistics using nflfastR
# Creates separate files for each year for better performance
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
OUTPUT_DIR <- "data_output/season_stats"

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

# Logging function
log_message <- function(message) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  log_entry <- paste0("[", timestamp, "] ", message)
  cat(log_entry, "\n")
}

log_message("=== NFL SEASON STATS FETCH: Starting ===")
log_message(paste("Seasons:", min(SEASONS), "to", max(SEASONS)))
log_message(paste("Season type:", SEASON_TYPE))
log_message(paste("Output directory:", OUTPUT_DIR))

# Clean up old files in the directory
old_files <- list.files(OUTPUT_DIR, pattern = "*.csv", full.names = TRUE)
if (length(old_files) > 0) {
  log_message("Cleaning up old files:")
  for (file in old_files) {
    log_message(paste("  Removing:", basename(file)))
    file.remove(file)
  }
  log_message(paste("Removed", length(old_files), "old files"))
} else {
  log_message("No old files to clean up")
}

# ==============================================================================
# FETCH SEASON-LEVEL STATS BY YEAR
# ==============================================================================
log_message("Fetching season-level player statistics...")

total_seasons <- length(SEASONS)
files_created <- 0
total_records <- 0

for (i in 1:total_seasons) {
  season <- SEASONS[i]
  log_message(paste("Processing season", season, "(", i, "of", total_seasons, ")..."))
  
  tryCatch({
    # Fetch data for this season
    season_data <- calculate_stats(
      seasons = season,
      summary_level = "season",
      stat_type = "player",
      season_type = SEASON_TYPE
    )
    
    if (nrow(season_data) > 0) {
      # Data cleaning
      numeric_cols <- sapply(season_data, is.numeric)
      stat_cols <- names(season_data)[numeric_cols & !names(season_data) %in% c("season", "week", "games")]
      season_data[stat_cols][is.na(season_data[stat_cols])] <- 0
      
      # Create filename
      filename <- paste0("season_data_", season, "_", SEASON_TYPE, ".csv")
      filepath <- file.path(OUTPUT_DIR, filename)
      
      # Export to CSV
      write.csv(season_data, filepath, row.names = FALSE)
      
      # Log progress
      file_size_mb <- round(file.size(filepath) / 1024 / 1024, 2)
      log_message(paste("Season", season, "-", nrow(season_data), "records,", file_size_mb, "MB"))
      
      files_created <- files_created + 1
      total_records <- total_records + nrow(season_data)
    } else {
      log_message(paste("Season", season, "- No data found"))
    }
    
  }, error = function(e) {
    log_message(paste("Error processing season", season, ":", e$message))
  })
  
  # Progress update
  progress <- round((i / total_seasons) * 100, 1)
  log_message(paste("Progress:", progress, "%"))
}

# ==============================================================================
# FINAL SUMMARY
# ==============================================================================
log_message("=== FINAL SUMMARY ===")
log_message(paste("Total seasons processed:", total_seasons))
log_message(paste("Files created:", files_created))
log_message(paste("Total records:", total_records))

if (files_created > 0) {
  log_message("Files created:")
  created_files <- list.files(OUTPUT_DIR, pattern = "*.csv", full.names = FALSE)
  for (file in created_files) {
    file_size_mb <- round(file.size(file.path(OUTPUT_DIR, file)) / 1024 / 1024, 2)
    log_message(paste("  -", file, "(", file_size_mb, "MB)"))
  }
}

log_message("=== NFL SEASON STATS FETCH: Complete ===")
log_message("Ready for Node.js upload script!")