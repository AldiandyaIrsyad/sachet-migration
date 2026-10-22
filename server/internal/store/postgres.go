package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
)

const pgSchema = `
CREATE TABLE IF NOT EXISTS sessions (
	id         TEXT PRIMARY KEY,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS migrations (
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	base       TEXT NOT NULL,
	to_id      TEXT,
	buys       INTEGER NOT NULL DEFAULT 0,
	since      DATE NOT NULL,
	seq        BIGINT NOT NULL,
	PRIMARY KEY (session_id, base)
);
CREATE TABLE IF NOT EXISTS wants (
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	product_id TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (session_id, product_id)
);`

// Postgres is a Store backed by PostgreSQL.
type Postgres struct{ db *sql.DB }

// OpenPostgres connects to the database at url (postgres://user:pass@host:5432/db) and creates the tables.
// It retries for up to a minute so the server can start while the database is still coming up.
func OpenPostgres(ctx context.Context, url string) (*Postgres, error) {
	db, err := sql.Open("pgx", url)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)

	deadline := time.Now().Add(time.Minute)
	for {
		pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		err = db.PingContext(pingCtx)
		cancel()
		if err == nil {
			break
		}
		if time.Now().After(deadline) || ctx.Err() != nil {
			db.Close()
			return nil, fmt.Errorf("postgres not reachable: %w", err)
		}
		time.Sleep(time.Second)
	}
	if _, err := db.ExecContext(ctx, pgSchema); err != nil {
		db.Close()
		return nil, err
	}
	return &Postgres{db: db}, nil
}

func (p *Postgres) Close() error { return p.db.Close() }

func (p *Postgres) CreateSession(ctx context.Context) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	_, err := p.db.ExecContext(ctx, `INSERT INTO sessions (id) VALUES ($1)`, sessionID(token))
	return token, err
}

func (p *Postgres) SessionExists(ctx context.Context, token string) (bool, error) {
	var one int
	err := p.db.QueryRowContext(ctx, `SELECT 1 FROM sessions WHERE id = $1`, sessionID(token)).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (p *Postgres) Migrations(ctx context.Context, token string) ([]Migration, error) {
	rows, err := p.db.QueryContext(ctx,
		`SELECT base, COALESCE(to_id, ''), buys, to_char(since, 'YYYY-MM-DD')
		 FROM migrations WHERE session_id = $1 ORDER BY seq DESC`, sessionID(token))
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

func (p *Postgres) AddBase(ctx context.Context, token, base string) error {
	id := sessionID(token)
	_, err := p.db.ExecContext(ctx,
		`INSERT INTO migrations (session_id, base, buys, since, seq)
		 VALUES ($1, $2, 0, CURRENT_DATE, (SELECT COALESCE(MAX(seq), 0) + 1 FROM migrations WHERE session_id = $1))
		 ON CONFLICT DO NOTHING`, id, base)
	return err
}

func (p *Postgres) Migrate(ctx context.Context, token, base, to string) (Migration, error) {
	id := sessionID(token)
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return Migration{}, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM migrations WHERE session_id = $1 AND base = $2`, id, base); err != nil {
		return Migration{}, err
	}
	var m Migration
	err = tx.QueryRowContext(ctx,
		`INSERT INTO migrations (session_id, base, to_id, buys, since, seq)
		 VALUES ($1, $2, $3, 1, CURRENT_DATE, (SELECT COALESCE(MAX(seq), 0) + 1 FROM migrations WHERE session_id = $1))
		 RETURNING base, to_id, buys, to_char(since, 'YYYY-MM-DD')`, id, base, to).
		Scan(&m.Base, &m.To, &m.Buys, &m.Since)
	if err != nil {
		return Migration{}, err
	}
	return m, tx.Commit()
}

func (p *Postgres) BuyAgain(ctx context.Context, token, base string) error {
	res, err := p.db.ExecContext(ctx,
		`UPDATE migrations SET buys = buys + 1 WHERE session_id = $1 AND base = $2 AND to_id IS NOT NULL`,
		sessionID(token), base)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (p *Postgres) Remove(ctx context.Context, token, base string) error {
	_, err := p.db.ExecContext(ctx, `DELETE FROM migrations WHERE session_id = $1 AND base = $2`, sessionID(token), base)
	return err
}

func (p *Postgres) Clear(ctx context.Context, token string) error {
	_, err := p.db.ExecContext(ctx, `DELETE FROM migrations WHERE session_id = $1`, sessionID(token))
	return err
}

func (p *Postgres) Want(ctx context.Context, token, productID string) error {
	_, err := p.db.ExecContext(ctx,
		`INSERT INTO wants (session_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, sessionID(token), productID)
	return err
}

func (p *Postgres) Wanted(ctx context.Context, token string) ([]string, error) {
	rows, err := p.db.QueryContext(ctx, `SELECT product_id FROM wants WHERE session_id = $1 ORDER BY created_at, product_id`, sessionID(token))
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
