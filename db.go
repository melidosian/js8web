package main

import (
	"database/sql"
	"errors"
	"os"
	"strings"

	"github.com/PiotrTopa/js8web/model"
	_ "modernc.org/sqlite"
)

// Initializes DB for the first time
func initDb(db *sql.DB) {
	logger.Sugar().Infow(
		"Initializing empty database",
		"file", DB_FILE_PATH,
	)

	_, err := db.Exec(RESOURCE_INIT_DB_SQL)
	if err != nil {
		logger.Sugar().Fatalw(
			"Could not initialize database",
			"file", DB_FILE_PATH,
			"error", err,
		)
	}

	err = model.DefaultAdminUser.Insert(db)
	if err != nil {
		logger.Sugar().Fatal(
			"Could not setup default admin user",
			"error", err,
		)
	}
	logger.Sugar().Info("Empty database initialized")
}

func initDbConnection() *sql.DB {
	var recreate bool = false

	if _, err := os.Stat(DB_FILE_PATH); errors.Is(err, os.ErrNotExist) {
		logger.Sugar().Warnw(
			"Database file not found",
			"file", DB_FILE_PATH,
		)
		recreate = true
	}

	db, err := sql.Open("sqlite", DB_FILE_PATH)
	if err != nil {
		logger.Sugar().Fatalw("Could not open or create database file",
			"file", DB_FILE_PATH,
			"error", err,
		)
	}

	if recreate {
		initDb(db)
	}

	runMigrations(db)

	return db
}

func runMigrations(db *sql.DB) {
	// Add TEXT column to TX_FRAME (idempotent)
	_, err := db.Exec("ALTER TABLE `TX_FRAME` ADD COLUMN `TEXT` TEXT DEFAULT ''")
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		logger.Sugar().Warnw("DB migration warning", "error", err)
	}

	// Create INBOX_MESSAGE table if it doesn't exist
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS INBOX_MESSAGE (
		ID INTEGER PRIMARY KEY AUTOINCREMENT,
		TIMESTAMP TEXT NOT NULL,
		CALLSIGN TEXT NOT NULL,
		MESSAGE TEXT NOT NULL,
		UTC_MS INTEGER NOT NULL DEFAULT 0,
		UNIQUE(CALLSIGN, UTC_MS, MESSAGE)
	)`)
	if err != nil {
		logger.Sugar().Warnw("DB migration warning (INBOX_MESSAGE)", "error", err)
	}
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS INBOX_MESSAGE_TIMESTAMP_IDX ON INBOX_MESSAGE(TIMESTAMP)`)
}
