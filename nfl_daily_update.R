#!/usr/bin/env Rscript

# ==============================================================================
# SCRIPT 1: DAILY UPDATE - Player & Team Stats
# Run this every day during the season (or multiple times on game days)
# ==============================================================================

library(nflfastR)
library(dplyr)
library(jsonlite)

# Configuration
SEASON <- 2024
OUTPUT_DIR <- "nfl_data_output"
LOG_FILE <- "nfl_daily_log.txt"

# Create output directory
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR)
}

# Logging
log_message <- function(message) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  log_entry <- paste0("[", timestamp, "] ", message, "\n")
  cat(log_entry)
  cat(log_entry, file = LOG_FILE, append = TRUE)
}

log_message("=== DAILY UPDATE: Starting ===")

# Load play-by-play data (cached after first run)
log_message("Loading play-by-play data...")
pbp_data <- load_pbp(SEASON)
log_message(paste("Loaded", nrow(pbp_data), "plays"))
