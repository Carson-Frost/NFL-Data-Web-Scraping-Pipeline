#!/usr/bin/env Rscript

# ==============================================================================
# SCRIPT 3: ONE-TIME SETUP - Team Info
# Run this once at the start of the season (or when teams change)
# This data rarely changes
# ==============================================================================

# Load required libraries
suppressPackageStartupMessages({
  library(nflfastR)
  library(dplyr)
  library(jsonlite)
})

# Configuration
OUTPUT_DIR <- "nfl_data_output"
LOG_FILE <- "nfl_setup_log.txt"

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

log_message("=== ONE-TIME SETUP: Starting ===")

# ==============================================================================
# TEAMS INFO
# ==============================================================================
log_message("Fetching team information...")

# Load teams data from nflfastR
log_message("Loading teams data from nflfastR...")

tryCatch({
  # Access the teams_colors_logos dataset from nflfastR
  teams <- nflfastR::teams_colors_logos
  log_message(paste("Successfully loaded", nrow(teams), "teams from nflfastR teams_colors_logos dataset"))
}, error = function(e) {
  log_message(paste("ERROR loading teams from nflfastR:", e$message))
  log_message("Using fallback team data...")
  
  # Fallback: create basic team data manually
  teams <- data.frame(
    team_abbr = c("ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", 
                  "DET", "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", 
                  "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SF", "SEA", "TB", 
                  "TEN", "WAS"),
    team_name = c("Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills", 
                  "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns", 
                  "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers", 
                  "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs", 
                  "Las Vegas Raiders", "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins", 
                  "Minnesota Vikings", "New England Patriots", "New Orleans Saints", "New York Giants", 
                  "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers", "San Francisco 49ers", 
                  "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders"),
    team_id = c("ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", 
                "DET", "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", 
                "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SF", "SEA", "TB", 
                "TEN", "WAS"),
    team_nick = c("Cardinals", "Falcons", "Ravens", "Bills", "Panthers", "Bears", "Bengals", 
                  "Browns", "Cowboys", "Broncos", "Lions", "Packers", "Texans", "Colts", 
                  "Jaguars", "Chiefs", "Raiders", "Chargers", "Rams", "Dolphins", "Vikings", 
                  "Patriots", "Saints", "Giants", "Jets", "Eagles", "Steelers", "49ers", 
                  "Seahawks", "Buccaneers", "Titans", "Commanders"),
    team_conf = c("NFC", "NFC", "AFC", "AFC", "NFC", "NFC", "AFC", "AFC", "NFC", "AFC", 
                  "NFC", "NFC", "AFC", "AFC", "AFC", "AFC", "AFC", "AFC", "NFC", "AFC", 
                  "NFC", "AFC", "NFC", "NFC", "AFC", "NFC", "AFC", "NFC", "NFC", "NFC", 
                  "AFC", "NFC"),
    team_division = c("West", "South", "North", "East", "South", "North", "North", "North", 
                      "East", "West", "North", "North", "South", "South", "South", "West", 
                      "West", "West", "West", "East", "North", "East", "South", "East", 
                      "East", "East", "North", "West", "West", "South", "South", "East"),
    stringsAsFactors = FALSE
  )
  log_message(paste("Created fallback team data with", nrow(teams), "teams"))
})

# Process team data
if (!is.null(teams) && nrow(teams) > 0) {
  log_message("Processing team data...")
  
  # Select available columns (handle missing columns gracefully)
  available_cols <- names(teams)
  desired_cols <- c("team_abbr", "team_name", "team_id", "team_nick", "team_conf", "team_division",
                    "team_color", "team_color2", "team_color3", "team_color4",
                    "team_logo_wikipedia", "team_logo_espn", "team_wordmark",
                    "team_conference_logo", "team_division_logo", "team_logo_squared")
  
  # Only select columns that exist
  cols_to_select <- intersect(desired_cols, available_cols)
  teams_info <- teams[, cols_to_select, drop = FALSE]
  
  # Add missing columns with default values if needed
  for (col in desired_cols) {
    if (!col %in% names(teams_info)) {
      teams_info[[col]] <- NA
    }
  }
  
  # Reorder columns
  teams_info <- teams_info[, desired_cols]
  
  # Write to JSON file
  output_file <- file.path(OUTPUT_DIR, "teams_info.json")
  log_message(paste("Writing to file:", output_file))
  
  write_json(teams_info, output_file, pretty = TRUE)
  
  # Verify file was created
  if (file.exists(output_file)) {
    file_size <- file.size(output_file)
    log_message(paste("✅ SUCCESS: teams_info.json created successfully!"))
    log_message(paste("   File size:", file_size, "bytes"))
    log_message(paste("   Teams:", nrow(teams_info)))
  } else {
    log_message("❌ ERROR: File was not created!")
    quit(status = 1)
  }
  
} else {
  log_message("❌ ERROR: No team data available!")
  quit(status = 1)
}

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