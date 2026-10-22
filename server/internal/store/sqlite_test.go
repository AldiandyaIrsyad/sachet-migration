package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// The same behaviour is required of every Store, so both implementations run this suite.
func testStore(t *testing.T, s Store) {
	t.Helper()
	ctx := context.Background()
	tok, err := s.CreateSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if ok, _ := s.SessionExists(ctx, "forged"); ok {
		t.Fatal("forged token should not exist")
	}
	if ok, _ := s.SessionExists(ctx, tok); !ok {
		t.Fatal("new session should exist")
	}

	s.AddBase(ctx, tok, "a")
	s.AddBase(ctx, tok, "a") // idempotent
	s.AddBase(ctx, tok, "b")
	if err := s.BuyAgain(ctx, tok, "a"); !errors.Is(err, ErrNotFound) {
		t.Errorf("buying again before switching should be ErrNotFound, got %v", err)
	}
	m, err := s.Migrate(ctx, tok, "a", "a2")
	if err != nil {
		t.Fatal(err)
	}
	if m.Base != "a" || m.To != "a2" || m.Buys != 1 || len(m.Since) != 10 {
		t.Errorf("unexpected migration %+v", m)
	}
	if err := s.BuyAgain(ctx, tok, "a"); err != nil {
		t.Fatal(err)
	}

	got, _ := s.Migrations(ctx, tok)
	if len(got) != 2 || got[0].Base != "a" || got[0].To != "a2" || got[0].Buys != 2 || got[1].Base != "b" || got[1].To != "" {
		t.Fatalf("newest switch should lead: %+v", got)
	}

	other, _ := s.CreateSession(ctx)
	if theirs, _ := s.Migrations(ctx, other); len(theirs) != 0 {
		t.Errorf("sessions must be isolated, other saw %+v", theirs)
	}

	s.Remove(ctx, tok, "a")
	s.Want(ctx, tok, "x")
	s.Want(ctx, tok, "x")
	s.Want(ctx, tok, "y")
	if w, _ := s.Wanted(ctx, tok); len(w) != 2 || w[0] != "x" {
		t.Errorf("wants should be deduplicated and in order, got %v", w)
	}
	s.Clear(ctx, tok)
	if got, _ := s.Migrations(ctx, tok); len(got) != 0 {
		t.Errorf("clear left %v", got)
	}
}

func TestSQLiteStore(t *testing.T) {
	s, err := OpenSQLite(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	testStore(t, s)
}

// Set TEST_DATABASE_URL to a throwaway database to run the suite against PostgreSQL, e.g.
// postgres://sachet:sachet@localhost:5432/sachet_test?sslmode=disable
func TestPostgresStore(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	s, err := OpenPostgres(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	testStore(t, s)
}
