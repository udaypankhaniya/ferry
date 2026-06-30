package history

import (
	"database/sql"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// DB holds the open SQLite database.
type DB struct {
	db *sql.DB
}

// Open opens (or creates) the history database at the default path.
func Open() (*DB, error) {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".ferry")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dir, "history.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	if err := migrate(db); err != nil {
		return nil, err
	}
	return &DB{db: db}, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS command_history (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id   TEXT NOT NULL,
			host      TEXT NOT NULL,
			command   TEXT NOT NULL,
			exit_code INTEGER NOT NULL DEFAULT 0,
			stdout    TEXT,
			stderr    TEXT,
			ran_at    DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_ch_site ON command_history(site_id, ran_at DESC);

		CREATE TABLE IF NOT EXISTS transfer_history (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id   TEXT NOT NULL,
			direction TEXT NOT NULL,
			local_path  TEXT NOT NULL,
			remote_path TEXT NOT NULL,
			bytes     INTEGER NOT NULL DEFAULT 0,
			status    TEXT NOT NULL DEFAULT 'done',
			started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			finished_at DATETIME
		);
		CREATE INDEX IF NOT EXISTS idx_th_site ON transfer_history(site_id, started_at DESC);
	`)
	return err
}

type CommandRecord struct {
	SiteID   string
	Host     string
	Command  string
	ExitCode int
	Stdout   string
	Stderr   string
}

func (d *DB) RecordCommand(r CommandRecord) error {
	_, err := d.db.Exec(
		`INSERT INTO command_history (site_id, host, command, exit_code, stdout, stderr) VALUES (?,?,?,?,?,?)`,
		r.SiteID, r.Host, r.Command, r.ExitCode, r.Stdout, r.Stderr,
	)
	return err
}

func (d *DB) RecentCommands(siteID string, limit int) ([]string, error) {
	rows, err := d.db.Query(
		`SELECT DISTINCT command FROM command_history WHERE site_id=? ORDER BY ran_at DESC LIMIT ?`,
		siteID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var cmd string
		if err := rows.Scan(&cmd); err == nil {
			out = append(out, cmd)
		}
	}
	return out, rows.Err()
}

type TransferRecord struct {
	SiteID     string
	Direction  string
	LocalPath  string
	RemotePath string
	Bytes      int64
	Status     string
	StartedAt  time.Time
	FinishedAt *time.Time
}

func (d *DB) RecordTransfer(r TransferRecord) (int64, error) {
	res, err := d.db.Exec(
		`INSERT INTO transfer_history (site_id, direction, local_path, remote_path, bytes, status, started_at, finished_at) VALUES (?,?,?,?,?,?,?,?)`,
		r.SiteID, r.Direction, r.LocalPath, r.RemotePath, r.Bytes, r.Status, r.StartedAt, r.FinishedAt,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (d *DB) Close() error {
	return d.db.Close()
}
