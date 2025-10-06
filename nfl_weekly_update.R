#!/usr/bin/env Rscript

# ==============================================================================
# SCRIPT 2: WEEKLY UPDATE - Games Schedule & Rosters
# Run this weekly during the season
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
LOG_FILE <- "nfl_weekly_log.txt"

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

log_message("=== WEEKLY UPDATE: Starting ===")

# ==============================================================================
# GAMES/SCHEDULE (with scores)
# ==============================================================================
log_message("Fetching schedule and scores...")

tryCatch({
  schedules <- fast_scraper_schedules(SEASON)

  games_schedule <- schedules %>%
    select(game_id, season, game_type, week, gameday, weekday, gametime,
           away_team, away_score, home_team, home_score, location,
           result, total, overtime, away_rest, home_rest,
           away_moneyline, home_moneyline, spread_line,
           away_spread_odds, home_spread_odds, total_line,
           div_game, roof, surface, temp, wind, stadium, stadium_id)

  write_json(games_schedule, file.path(OUTPUT_DIR, "games_schedule.json"), pretty = TRUE)
  log_message(paste("✓ Games schedule:", nrow(games_schedule), "games"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "games_schedule.json"))) {
    log_message("✅ games_schedule.json created successfully!")
  } else {
    log_message("❌ ERROR: games_schedule.json not created!")
  }

}, error = function(e) {
  log_message(paste("ERROR fetching schedule:", e$message))
})

# ==============================================================================
# ROSTERS
# ==============================================================================
log_message("Fetching rosters...")

tryCatch({
  rosters <- fast_scraper_rosters(SEASON)

  rosters_clean <- rosters %>%
    select(season, team, position, depth_chart_position, jersey_number,
           status, full_name, first_name, last_name, birth_date,
           height, weight, college, gsis_id, espn_id,
           sportradar_id, yahoo_id, headshot_url, years_exp)

  write_json(rosters_clean, file.path(OUTPUT_DIR, "rosters.json"), pretty = TRUE)
  log_message(paste("✓ Rosters:", nrow(rosters_clean), "players"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "rosters.json"))) {
    log_message("✅ rosters.json created successfully!")
  } else {
    log_message("❌ ERROR: rosters.json not created!")
  }

}, error = function(e) {
  log_message(paste("ERROR fetching rosters:", e$message))
})

# ==============================================================================
# STANDINGS
# ==============================================================================
log_message("Calculating standings...")

tryCatch({
  # Get team records from schedules
  standings <- fast_scraper_schedules(SEASON) %>%
    filter(!is.na(result)) %>%
    mutate(
      home_win = ifelse(result > 0, 1, 0),
      away_win = ifelse(result < 0, 1, 0),
      home_loss = ifelse(result < 0, 1, 0),
      away_loss = ifelse(result > 0, 1, 0)
    ) %>%
    select(season, week, home_team, away_team, home_win, away_win, home_loss, away_loss) %>%
    pivot_longer(cols = c(home_team, away_team), names_to = "location", values_to = "team") %>%
    mutate(
      wins = ifelse(location == "home_team", home_win, away_win),
      losses = ifelse(location == "home_team", home_loss, away_loss)
    ) %>%
    group_by(season, team) %>%
    summarise(
      wins = sum(wins, na.rm = TRUE),
      losses = sum(losses, na.rm = TRUE),
      ties = 0,  # NFL doesn't have ties in regular season
      win_pct = wins / (wins + losses),
      .groups = 'drop'
    ) %>%
    filter(!is.na(team), team != "") %>%
    arrange(desc(win_pct))
  
  write_json(standings, file.path(OUTPUT_DIR, "standings.json"), pretty = TRUE)
  log_message(paste("✓ Standings:", nrow(standings), "teams"))
  
  # Verify file was created
  if (file.exists(file.path(OUTPUT_DIR, "standings.json"))) {
    log_message("✅ standings.json created successfully!")
  } else {
    log_message("❌ ERROR: standings.json not created!")
  }

}, error = function(e) {
  log_message(paste("ERROR calculating standings:", e$message))
})

log_message("=== WEEKLY UPDATE: Complete ===")
log_message("Updated files:")
log_message("  - games_schedule.json")
log_message("  - rosters.json")
log_message("  - standings.json")