#!/usr/bin/env Rscript

# ==================================================================================================
# NFL SCHEDULES FETCHER
# Fetches NFL season schedule information using nflfastR::fast_scraper_schedules
# Produces one CSV file per season in output/schedule_data
# ==================================================================================================

# Load required libraries
suppressPackageStartupMessages({
  library(nflfastR)
  library(dplyr)
})

# Parse command line arguments
args <- commandArgs(trailingOnly = TRUE)

# Default values
SEASONS_STR <- "2025"
OUTPUT_DIR <- "output/schedule_data"

for (arg in args) {
  if (grepl("^--seasons=", arg)) {
    SEASONS_STR <- sub("^--seasons=", "", arg)
  }
}

# Allow environment override
SEASONS_STR <- Sys.getenv("SEASONS", SEASONS_STR)

# Parse seasons string (e.g., "1999:2025" or "2025")
if (grepl(":", SEASONS_STR)) {
  parts <- strsplit(SEASONS_STR, ":")[[1]]
  if (length(parts) == 2 && !is.na(as.numeric(parts[1])) && !is.na(as.numeric(parts[2]))) {
    SEASONS <- as.numeric(parts[1]):as.numeric(parts[2])
  } else {
    stop("Invalid seasons format. Use format like '1999:2025'")
  }
} else {
  if (!is.na(as.numeric(SEASONS_STR))) {
    SEASONS <- as.numeric(SEASONS_STR)
  } else {
    stop("Invalid seasons format. Use format like '1999:2025' or single year like '2025'")
  }
}

# Create output directory
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
  cat("Created output directory:", OUTPUT_DIR, "\n")
}

# Simple logger
log_message <- function(message) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  cat(paste0("[", timestamp, "] ", message, "\n"))
}

log_message("=== NFL SCHEDULES FETCH: Starting ===")
log_message(paste("Seasons:", min(SEASONS), "to", max(SEASONS)))
log_message(paste("Output directory:", OUTPUT_DIR))

# Fetch schedules per season and save
files_created <- 0
total_rows <- 0
for (season in SEASONS) {
  log_message(paste("Fetching schedules for season", season, "..."))
  tryCatch({
    sched <- fast_scraper_schedules(season)
    if (nrow(sched) > 0) {
      filename <- paste0("schedule_data_", season, ".csv")
      filepath <- file.path(OUTPUT_DIR, filename)
      write.csv(sched, filepath, row.names = FALSE)
      file_size_mb <- round(file.size(filepath) / 1024 / 1024, 2)
      log_message(paste("Season", season, "-", nrow(sched), "rows,", file_size_mb, "MB"))
      files_created <- files_created + 1
      total_rows <- total_rows + nrow(sched)
    } else {
      log_message(paste("Season", season, "- no schedule data returned"))
    }
  }, error = function(e) {
    log_message(paste("Error fetching season", season, ":", e$message))
  })
}

log_message("=== FINAL SUMMARY ===")
log_message(paste("Seasons processed:", length(SEASONS)))
log_message(paste("Files created:", files_created))
log_message(paste("Total rows:", total_rows))
log_message("=== NFL SCHEDULES FETCH: Complete ===")
