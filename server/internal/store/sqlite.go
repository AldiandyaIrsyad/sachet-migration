package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite" // pure-Go driver, so the binary needs no cgo
)

const schema = `
CREATE TABLE IF NOT EXISTS sessions (
	id         TEXT PRIMARY KEY,
	created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS migrations (
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	base       TEXT NOT NULL,
	to_id      TEXT,
	buys       INTEGER NOT NULL DEFAULT 0,
	since      TEXT NOT NULL,
	seq        INTEGER NOT NULL,
	PRIMARY KEY (session_id, base)
);
CREATE TABLE IF NOT EXISTS wants (
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	product_id TEXT NOT NULL,
	PRIMARY KEY (session_id, product_id)
);`

// SQLite is a Store backed by a single SQLite file.
type SQLite struct{ db *sql.DB }

// OpenSQLite opens (and creates) the database at path. Use ":memory:" in tests.
func OpenSQLite(path string) (*SQLite, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)", path)
	if path == ":memory:" {
		dsn = "file::memory:?_pragma=foreign_keys(1)"
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection serialises writes and keeps ":memory:" a single database.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &SQLite{db: db}, nil
}

func (s *SQLite) Close() error { return s.db.Close() }

func today() string { return time.Now().UTC().Format("2006-01-02") }

func (s *SQLite) CreateSession(ctx context.Context) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions (id, created_at) VALUES (?, ?)`,
		sessionID(token), time.Now().UTC().Format(time.RFC3339))
	return token, err
}

func (s *SQLite) SessionExists(ctx context.Context, token string) (bool, error) {
	var one int
	err := s.db.QueryRowContext(ctx, `SELECT 1 FROM sessions WHERE id = ?`, sessionID(token)).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *SQLite) Migrations(ctx context.Context, token string) ([]Migration, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT base, COALESCE(to_id, ''), buys, since FROM migrations WHERE session_id = ? ORDER BY seq DESC`,
		sessionID(token))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Migration{}
	for rows.Next() {
		var m Migration
		if err := rows.Scan(&m.Base, &m.To, &m.Buys, &m.Since); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *SQLite) AddBase(ctx context.Context, token, base string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO migrations (session_id, base, buys, since, seq)
		 VALUES (?, ?, 0, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM migrations WHERE session_id = ?))`,
		sessionID(token), base, today(), sessionID(token))
	return err
}

func (s *SQLite) Migrate(ctx context.Context, token, base, to string) (Migration, error) {
	id := sessionID(token)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Migration{}, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM migrations WHERE session_id = ? AND base = ?`, id, base); err != nil {
		return Migration{}, err
	}
	m := Migration{Base: base, To: to, Buys: 1, Since: today()}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO migrations (session_id, base, to_id, buys, since, seq)
		 VALUES (?, ?, ?, 1, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM migrations WHERE session_id = ?))`,
		id, base, to, m.Since, id); err != nil {
		return Migration{}, err
	}
	return m, tx.Commit()
}

func (s *SQLite) BuyAgain(ctx context.Context, token, base string) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE migrations SET buys = buys + 1 WHERE session_id = ? AND base = ? AND to_id IS NOT NULL`,
		sessionID(token), base)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *SQLite) Remove(ctx context.Context, token, base string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM migrations WHERE session_id = ? AND base = ?`, sessionID(token), base)
	return err
}

func (s *SQLite) Clear(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM migrations WHERE session_id = ?`, sessionID(token))
	return err
}

func (s *SQLite) Want(ctx context.Context, token, productID string) error {
	_, err := s.db.ExecContext(ctx, `INSERT OR IGNORE INTO wants (session_id, product_id) VALUES (?, ?)`, sessionID(token), productID)
	return err
}

func (s *SQLite) Wanted(ctx context.Context, token string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT product_id FROM wants WHERE session_id = ? ORDER BY rowid`, sessionID(token))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
