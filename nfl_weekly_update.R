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

log_message("=== WEEKLY UPDATE: Starting ===")

# ==============================================================================
# GAMES/SCHEDULE (with scores)
# ==============================================================================
log_message("Fetching schedule and scores...")

tryCatch({
  schedules <- load_schedules(SEASON)

  games_schedule <- schedules %>%
    select(game_id, season, game_type, week, gameday, weekday, gametime,
           away_team, away_score, home_team, home_score, location,
           result, total, overtime, away_rest, home_rest,
           away_moneyline, home_moneyline, spread_line,
           away_spread_odds, home_spread_odds, total_line,
           div_game, roof, surface, temp, wind, stadium, stadium_id)

  write_json(games_schedule, paste0(OUTPUT_DIR, "/games_schedule.json"))
  log_message(paste("✓ Games schedule:", nrow(games_schedule), "games"))

}, error = function(e) {
  log_message(paste("ERROR fetching schedule:", e$message))
})

# ==============================================================================
# ROSTERS
# ==============================================================================
log_message("Fetching rosters...")

tryCatch({
  rosters <- load_rosters(SEASON)

  rosters_clean <- rosters %>%
    select(season, team, position, depth_chart_position, jersey_number,
           status, full_name, first_name, last_name, birth_date,
           height, weight, college, gsis_id, espn_id,
           sportradar_id, yahoo_id, headshot_url, years_exp)

  write_json(rosters_clean, paste0(OUTPUT_DIR, "/rosters.json"))
  log_message(paste("✓ Rosters:", nrow(rosters_clean), "players"))

}, error = function(e) {
  log_message(paste("ERROR fetching rosters:", e$message))
})

log_message("=== WEEKLY UPDATE: Complete ===")
log_message("Updated files:")
log_message("  - games_schedule.json")
log_message("  - rosters.json")