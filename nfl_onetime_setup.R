#!/usr/bin/env Rscript

# ==============================================================================
# SCRIPT 3: ONE-TIME SETUP - Team Info
# Run this once at the start of the season (or when teams change)
# This data rarely changes
# ==============================================================================

library(nflfastR)
library(dplyr)
library(jsonlite)

# Configuration
OUTPUT_DIR <- "nfl_data_output"
LOG_FILE <- "nfl_setup_log.txt"

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

log_message("=== ONE-TIME SETUP: Starting ===")

# ==============================================================================
# TEAMS INFO
# ==============================================================================
log_message("Fetching team information...")

tryCatch({
  teams <- load_teams()

  teams_info <- teams %>%
    select(team_abbr, team_name, team_id, team_nick, team_conf, team_division,
           team_color, team_color2, team_color3, team_color4,
           team_logo_wikipedia, team_logo_espn, team_wordmark,
           team_conference_logo, team_division_logo, team_logo_squared)

  write_json(teams_info, paste0(OUTPUT_DIR, "/teams_info.json"))
  log_message(paste("✓ Team info:", nrow(teams_info), "teams"))

}, error = function(e) {
  log_message(paste("ERROR fetching team info:", e$message))
})

log_message("=== ONE-TIME SETUP: Complete ===")
log_message("Created file:")
log_message("  - teams_info.json")
log_message("")
log_message("This file contains:")
log_message("  - Team names, abbreviations, and nicknames")
log_message("  - Conference and division info")
log_message("  - Team colors (primary, secondary, etc.)")
log_message("  - Logo URLs (Wikipedia, ESPN, wordmark, etc.)")
log_message("")
log_message("You typically only need to run this script once per season")
log_message("or when there are major team changes (relocations, rebrands).")