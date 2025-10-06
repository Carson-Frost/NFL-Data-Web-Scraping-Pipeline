#!/usr/bin/env Rscript

# ==============================================================================
# SCRIPT 1: DAILY UPDATE - Player & Team Stats
# Run this every day during the season (or multiple times on game days)
# ==============================================================================

# Load required libraries
suppressPackageStartupMessages({
  library(nflfastR)
  library(dplyr)
  library(jsonlite)
  library(tidyr)
})

# Configuration
SEASON <- 2024
OUTPUT_DIR <- "nfl_data_output"
LOG_FILE <- "nfl_daily_log.txt"

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

log_message("=== DAILY UPDATE: Starting ===")

# Load play-by-play data (cached after first run)
log_message("Loading play-by-play data...")

tryCatch({
  pbp_data <- load_pbp(SEASON)
  log_message(paste("Successfully loaded", nrow(pbp_data), "plays"))
}, error = function(e) {
  log_message(paste("ERROR loading play-by-play data:", e$message))
  log_message("Cannot proceed without play-by-play data. Exiting.")
  quit(status = 1)
})

# ==============================================================================
# PLAYER PASSING STATS - WEEKLY
# ==============================================================================
log_message("Calculating weekly passing stats...")

tryCatch({
  passing_weekly <- pbp_data %>%
    filter(pass == 1, !is.na(passer_player_name)) %>%
    group_by(season, week, passer_player_name, posteam) %>%
    summarise(
      attempts = n(),
      completions = sum(complete_pass, na.rm = TRUE),
      passing_yards = sum(passing_yards, na.rm = TRUE),
      passing_tds = sum(pass_touchdown, na.rm = TRUE),
      interceptions = sum(interception, na.rm = TRUE),
      sacks = sum(sack, na.rm = TRUE),
      sack_yards = sum(sack_yards, na.rm = TRUE),
      .groups = 'drop'
    ) %>%
    filter(attempts >= 5)  # Minimum 5 attempts
  
  write_json(passing_weekly, file.path(OUTPUT_DIR, "player_passing_weekly.json"), pretty = TRUE)
  log_message(paste("✓ Weekly passing stats:", nrow(passing_weekly), "player-weeks"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "player_passing_weekly.json"))) {
    log_message("✅ player_passing_weekly.json created successfully!")
  } else {
    log_message("❌ ERROR: player_passing_weekly.json not created!")
  }
  
}, error = function(e) {
  log_message(paste("ERROR calculating weekly passing stats:", e$message))
})

# ==============================================================================
# PLAYER PASSING STATS - SEASON
# ==============================================================================
log_message("Calculating season passing stats...")

tryCatch({
  passing_season <- pbp_data %>%
    filter(pass == 1, !is.na(passer_player_name)) %>%
    group_by(season, passer_player_name, posteam) %>%
    summarise(
      attempts = n(),
      completions = sum(complete_pass, na.rm = TRUE),
      passing_yards = sum(passing_yards, na.rm = TRUE),
      passing_tds = sum(pass_touchdown, na.rm = TRUE),
      interceptions = sum(interception, na.rm = TRUE),
      sacks = sum(sack, na.rm = TRUE),
      sack_yards = sum(sack_yards, na.rm = TRUE),
      .groups = 'drop'
    ) %>%
    filter(attempts >= 20)  # Minimum 20 attempts for season stats
  
  write_json(passing_season, file.path(OUTPUT_DIR, "player_passing_season.json"), pretty = TRUE)
  log_message(paste("✓ Season passing stats:", nrow(passing_season), "players"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "player_passing_season.json"))) {
    log_message("✅ player_passing_season.json created successfully!")
  } else {
    log_message("❌ ERROR: player_passing_season.json not created!")
  }
  
}, error = function(e) {
  log_message(paste("ERROR calculating season passing stats:", e$message))
})

# ==============================================================================
# PLAYER RUSHING STATS - WEEKLY
# ==============================================================================
log_message("Calculating weekly rushing stats...")

tryCatch({
  rushing_weekly <- pbp_data %>%
    filter(rush == 1, !is.na(rusher_player_name)) %>%
    group_by(season, week, rusher_player_name, posteam) %>%
    summarise(
      attempts = n(),
      rushing_yards = sum(rushing_yards, na.rm = TRUE),
      rushing_tds = sum(rush_touchdown, na.rm = TRUE),
      fumbles = sum(fumble, na.rm = TRUE),
      .groups = 'drop'
    ) %>%
    filter(attempts >= 3)  # Minimum 3 attempts
  
  write_json(rushing_weekly, file.path(OUTPUT_DIR, "player_rushing_weekly.json"), pretty = TRUE)
  log_message(paste("✓ Weekly rushing stats:", nrow(rushing_weekly), "player-weeks"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "player_rushing_weekly.json"))) {
    log_message("✅ player_rushing_weekly.json created successfully!")
  } else {
    log_message("❌ ERROR: player_rushing_weekly.json not created!")
  }
  
}, error = function(e) {
  log_message(paste("ERROR calculating weekly rushing stats:", e$message))
})

# ==============================================================================
# PLAYER RUSHING STATS - SEASON
# ==============================================================================
log_message("Calculating season rushing stats...")

tryCatch({
  rushing_season <- pbp_data %>%
    filter(rush == 1, !is.na(rusher_player_name)) %>%
    group_by(season, rusher_player_name, posteam) %>%
    summarise(
      attempts = n(),
      rushing_yards = sum(rushing_yards, na.rm = TRUE),
      rushing_tds = sum(rush_touchdown, na.rm = TRUE),
      fumbles = sum(fumble, na.rm = TRUE),
      .groups = 'drop'
    ) %>%
    filter(attempts >= 10)  # Minimum 10 attempts for season stats
  
  write_json(rushing_season, file.path(OUTPUT_DIR, "player_rushing_season.json"), pretty = TRUE)
  log_message(paste("✓ Season rushing stats:", nrow(rushing_season), "players"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "player_rushing_season.json"))) {
    log_message("✅ player_rushing_season.json created successfully!")
  } else {
    log_message("❌ ERROR: player_rushing_season.json not created!")
  }
  
}, error = function(e) {
  log_message(paste("ERROR calculating season rushing stats:", e$message))
})

# ==============================================================================
# PLAYER RECEIVING STATS - WEEKLY
# ==============================================================================
log_message("Calculating weekly receiving stats...")

tryCatch({
  receiving_weekly <- pbp_data %>%
    filter(pass == 1, !is.na(receiver_player_name)) %>%
    group_by(season, week, receiver_player_name, posteam) %>%
    summarise(
      targets = n(),
      receptions = sum(complete_pass, na.rm = TRUE),
      receiving_yards = sum(receiving_yards, na.rm = TRUE),
      receiving_tds = sum(pass_touchdown, na.rm = TRUE),
      .groups = 'drop'
    ) %>%
    filter(targets >= 2)  # Minimum 2 targets
  
  write_json(receiving_weekly, file.path(OUTPUT_DIR, "player_receiving_weekly.json"), pretty = TRUE)
  log_message(paste("✓ Weekly receiving stats:", nrow(receiving_weekly), "player-weeks"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "player_receiving_weekly.json"))) {
    log_message("✅ player_receiving_weekly.json created successfully!")
  } else {
    log_message("❌ ERROR: player_receiving_weekly.json not created!")
  }
  
}, error = function(e) {
  log_message(paste("ERROR calculating weekly receiving stats:", e$message))
})

# ==============================================================================
# PLAYER RECEIVING STATS - SEASON
# ==============================================================================
log_message("Calculating season receiving stats...")

tryCatch({
  receiving_season <- pbp_data %>%
    filter(pass == 1, !is.na(receiver_player_name)) %>%
    group_by(season, receiver_player_name, posteam) %>%
    summarise(
      targets = n(),
      receptions = sum(complete_pass, na.rm = TRUE),
      receiving_yards = sum(receiving_yards, na.rm = TRUE),
      receiving_tds = sum(pass_touchdown, na.rm = TRUE),
      .groups = 'drop'
    ) %>%
    filter(targets >= 5)  # Minimum 5 targets for season stats
  
  write_json(receiving_season, file.path(OUTPUT_DIR, "player_receiving_season.json"), pretty = TRUE)
  log_message(paste("✓ Season receiving stats:", nrow(receiving_season), "players"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "player_receiving_season.json"))) {
    log_message("✅ player_receiving_season.json created successfully!")
  } else {
    log_message("❌ ERROR: player_receiving_season.json not created!")
  }
  
}, error = function(e) {
  log_message(paste("ERROR calculating season receiving stats:", e$message))
})

# ==============================================================================
# TEAM STATS - SEASON
# ==============================================================================
log_message("Calculating team season stats...")

tryCatch({
  team_stats <- pbp_data %>%
    group_by(season, posteam) %>%
    summarise(
      games = n_distinct(game_id),
      total_plays = n(),
      passing_plays = sum(pass, na.rm = TRUE),
      rushing_plays = sum(rush, na.rm = TRUE),
      total_yards = sum(yards_gained, na.rm = TRUE),
      passing_yards = sum(passing_yards, na.rm = TRUE),
      rushing_yards = sum(rushing_yards, na.rm = TRUE),
      total_tds = sum(touchdown, na.rm = TRUE),
      passing_tds = sum(pass_touchdown, na.rm = TRUE),
      rushing_tds = sum(rush_touchdown, na.rm = TRUE),
      turnovers = sum(interception, na.rm = TRUE) + sum(fumble, na.rm = TRUE),
      .groups = 'drop'
    ) %>%
    filter(!is.na(posteam), posteam != "")
  
  write_json(team_stats, file.path(OUTPUT_DIR, "team_stats_season.json"), pretty = TRUE)
  log_message(paste("✓ Team season stats:", nrow(team_stats), "teams"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "team_stats_season.json"))) {
    log_message("✅ team_stats_season.json created successfully!")
  } else {
    log_message("❌ ERROR: team_stats_season.json not created!")
  }
  
}, error = function(e) {
  log_message(paste("ERROR calculating team season stats:", e$message))
})

log_message("=== DAILY UPDATE: Complete ===")
log_message("Created files:")
log_message("  - player_passing_weekly.json")
log_message("  - player_passing_season.json")
log_message("  - player_rushing_weekly.json")
log_message("  - player_rushing_season.json")
log_message("  - player_receiving_weekly.json")
log_message("  - player_receiving_season.json")
log_message("  - team_stats_season.json")
