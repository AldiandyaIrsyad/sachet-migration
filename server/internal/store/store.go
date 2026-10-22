// Package store keeps each visitor's switches and requests. The Store interface is the seam:
// SQLite is the implementation shipped here, Postgres could be dropped in behind the same methods.
package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

// ErrNotFound is returned when the named switch does not exist.
var ErrNotFound = errors.New("not found")

// Migration is one product a person uses. Base is what they used to buy; To is what they switched to.
// Buys counts how many packs of To they have bought since switching.
type Migration struct {
	Base string `json:"base"`
	To   string `json:"to,omitempty"`
	Buys int    `json:"buys"`
	// Since is the ISO date the base was added or the switch was made.
	Since string `json:"since"`
}

// Store persists anonymous sessions and what each one has saved.
type Store interface {
	// CreateSession makes a new anonymous session. The token goes to the browser; only its hash is stored.
	CreateSession(ctx context.Context) (token string, err error)
	// SessionExists reports whether the token belongs to a known session.
	SessionExists(ctx context.Context, token string) (bool, error)

	// Migrations lists a session's switches, newest first.
	Migrations(ctx context.Context, token string) ([]Migration, error)
	AddBase(ctx context.Context, token, base string) error
	// Migrate switches from base to "to"; it counts as the first purchase of "to".
	Migrate(ctx context.Context, token, base, to string) (Migration, error)
	BuyAgain(ctx context.Context, token, base string) error
	Remove(ctx context.Context, token, base string) error
	Clear(ctx context.Context, token string) error

	// Want records a request for a bigger pack of a product.
	Want(ctx context.Context, token, productID string) error
	Wanted(ctx context.Context, token string) ([]string, error)

	Close() error
}

func sessionID(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
