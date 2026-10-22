// Command sachet serves the Sachet Migration API and, when a built frontend is present, the app itself.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"sachet/server/internal/api"
	"sachet/server/internal/catalog"
	"sachet/server/internal/store"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	port := env("PORT", "8080")
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		// Used by the container's HEALTHCHECK: the final image has no curl or wget.
		c := http.Client{Timeout: 3 * time.Second}
		resp, err := c.Get("http://127.0.0.1:" + port + "/healthz")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log, port); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

// openStore uses PostgreSQL when DATABASE_URL is set (the Docker Compose setup) and a local SQLite file otherwise,
// which keeps `go run` working with nothing installed.
func openStore(log *slog.Logger) (store.Store, error) {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		log.Info("using PostgreSQL")
		return store.OpenPostgres(context.Background(), url)
	}
	path := env("DB_PATH", "./sachet.db")
	log.Info("using SQLite", "path", path)
	return store.OpenSQLite(path)
}

func run(log *slog.Logger, port string) error {
	dataDir := env("DATA_DIR", "./data")
	cat, err := catalog.LoadFiles(dataDir, "products.json")
	if err != nil {
		return fmt.Errorf("catalogue: %w", err)
	}
	st, err := openStore(log)
	if err != nil {
		return fmt.Errorf("database: %w", err)
	}
	defer st.Close()

	static := env("STATIC_DIR", "./web")
	if _, err := os.Stat(static); err != nil {
		log.Warn("no frontend found, serving the API only", "dir", static)
		static = ""
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           api.New(cat, st, static, log),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("listening", "addr", srv.Addr, "products", len(cat.All()))

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdown); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
