package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func TestMigrationsLifecycle(t *testing.T) {
	ctx := context.Background()
	s, err := OpenSQLite(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	tok, err := s.CreateSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if ok, _ := s.SessionExists(ctx, "forged"); ok {
		t.Fatal("forged token should not exist")
	}

	s.AddBase(ctx, tok, "a")
	s.AddBase(ctx, tok, "a") // idempotent
	s.AddBase(ctx, tok, "b")
	if err := s.BuyAgain(ctx, tok, "a"); !errors.Is(err, ErrNotFound) {
		t.Errorf("buying again before switching should be ErrNotFound, got %v", err)
	}
	if _, err := s.Migrate(ctx, tok, "a", "a2"); err != nil {
		t.Fatal(err)
	}
	if err := s.BuyAgain(ctx, tok, "a"); err != nil {
		t.Fatal(err)
	}

	got, _ := s.Migrations(ctx, tok)
	if len(got) != 2 || got[0].Base != "a" || got[0].To != "a2" || got[0].Buys != 2 || got[1].Base != "b" {
		t.Fatalf("newest switch should lead: %+v", got)
	}

	s.Remove(ctx, tok, "a")
	s.Want(ctx, tok, "x")
	s.Want(ctx, tok, "x")
	if w, _ := s.Wanted(ctx, tok); len(w) != 1 {
		t.Errorf("wants should be deduplicated, got %v", w)
	}
	s.Clear(ctx, tok)
	if got, _ := s.Migrations(ctx, tok); len(got) != 0 {
		t.Errorf("clear left %v", got)
	}
}
