// Package api is the HTTP layer: JSON endpoints under /api plus the static frontend.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"sachet/server/internal/calc"
	"sachet/server/internal/catalog"
	"sachet/server/internal/store"
)

const sessionCookie = "sid"

// Server wires the catalogue, the maths and the store to HTTP.
type Server struct {
	cat    *catalog.Catalog
	calc   calc.Engine
	store  store.Store
	static string
	log    *slog.Logger
}

// New builds the handler. static is a directory holding the built frontend ("" to serve only the API).
func New(cat *catalog.Catalog, st store.Store, static string, log *slog.Logger) http.Handler {
	s := &Server{cat: cat, calc: calc.Engine{C: cat}, store: st, static: static, log: log}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })

	mux.HandleFunc("GET /api/products", s.listProducts)
	mux.HandleFunc("GET /api/products/{id}", s.getProduct)
	mux.HandleFunc("GET /api/products/{id}/page", s.productPage)
	mux.HandleFunc("GET /api/barcode/{code}", s.barcode)
	mux.HandleFunc("GET /api/refills", s.refills)
	mux.HandleFunc("GET /api/compare", s.compare)

	mux.HandleFunc("GET /api/migrations", s.migrations)
	mux.HandleFunc("POST /api/migrations", s.addBase)
	mux.HandleFunc("DELETE /api/migrations", s.clear)
	mux.HandleFunc("POST /api/migrations/{base}/switch", s.switchTo)
	mux.HandleFunc("POST /api/migrations/{base}/again", s.buyAgain)
	mux.HandleFunc("DELETE /api/migrations/{base}", s.remove)
	mux.HandleFunc("POST /api/wants", s.want)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) { fail(w, http.StatusNotFound, "no such endpoint") })
	if static != "" {
		mux.Handle("/", s.spa())
	}
	return s.middleware(mux)
}

// ---------- plumbing ----------

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		defer func() {
			if v := recover(); v != nil {
				s.log.Error("panic", "path", r.URL.Path, "panic", v)
				fail(rec, http.StatusInternalServerError, "internal error")
			}
			s.log.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "ms", time.Since(start).Milliseconds())
		}()
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			// State-changing calls must be JSON; a cross-site form post cannot send that without a CORS preflight.
			if r.Method != http.MethodGet && r.ContentLength != 0 && !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				fail(rec, http.StatusUnsupportedMediaType, "expected application/json")
				return
			}
		}
		next.ServeHTTP(rec, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<14)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		fail(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func (s *Server) serverError(w http.ResponseWriter, err error) {
	s.log.Error("request failed", "err", err)
	fail(w, http.StatusInternalServerError, "internal error")
}

// token returns the caller's session token if it names a real session.
func (s *Server) token(r *http.Request) (string, bool) {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return "", false
	}
	ok, err := s.store.SessionExists(r.Context(), c.Value)
	if err != nil || !ok {
		return "", false
	}
	return c.Value, true
}

// ensureToken returns the caller's session token, starting a new session (and setting the cookie) if needed.
func (s *Server) ensureToken(w http.ResponseWriter, r *http.Request) (string, error) {
	if tok, ok := s.token(r); ok {
		return tok, nil
	}
	tok, err := s.store.CreateSession(r.Context())
	if err != nil {
		return "", err
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: tok, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode,
		Secure: r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https", MaxAge: 60 * 60 * 24 * 365,
	})
	return tok, nil
}

func (s *Server) spa() http.Handler {
	files := http.FileServer(http.Dir(s.static))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		if r.URL.Path != "/" {
			if _, err := os.Stat(filepath.Join(s.static, filepath.Clean("/"+r.URL.Path))); err != nil {
				http.ServeFile(w, r, filepath.Join(s.static, "index.html"))
				return
			}
		}
		files.ServeHTTP(w, r)
	})
}

// ---------- catalogue ----------

func queryInt(r *http.Request, key string, def, max int) int {
	n, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil || n < 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

func (s *Server) listProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	category := q.Get("category")
	if category != "" && len(s.cat.InCategory(category)) == 0 {
		category = "\x00" // unknown category: matches nothing
	}
	all := s.cat.List(q.Get("q"), category, q.Get("lang"))
	limit := queryInt(r, "limit", 20, 500)
	items := all
	if limit < len(items) {
		items = items[:limit]
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":      items,
		"total":      len(all),
		"categories": s.cat.Categories(),
	})
}

func (s *Server) getProduct(w http.ResponseWriter, r *http.Request) {
	p, ok := s.cat.Product(r.PathValue("id"))
	if !ok {
		fail(w, http.StatusNotFound, "unknown product")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) barcode(w http.ResponseWriter, r *http.Request) {
	p, ok := s.cat.ByBarcode(r.PathValue("code"))
	if !ok {
		fail(w, http.StatusNotFound, "unknown barcode")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) refills(w http.ResponseWriter, _ *http.Request) {
	out := []*catalog.Product{}
	for _, p := range s.cat.All() {
		if p.Future {
			out = append(out, p)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// SwitchResult is what happens when you switch: both products and what the first purchase saves.
type SwitchResult struct {
	Base    *catalog.Product `json:"base"`
	To      *catalog.Product `json:"to"`
	Savings calc.Savings     `json:"savings"`
}

func (s *Server) compare(w http.ResponseWriter, r *http.Request) {
	base, ok1 := s.cat.Product(r.URL.Query().Get("base"))
	to, ok2 := s.cat.Product(r.URL.Query().Get("to"))
	if !ok1 || !ok2 {
		fail(w, http.StatusNotFound, "unknown product")
		return
	}
	packs := 1.0
	if v, err := strconv.ParseFloat(r.URL.Query().Get("packs"), 64); err == nil && v > 0 && v <= 1000 {
		packs = v
	}
	writeJSON(w, http.StatusOK, SwitchResult{Base: base, To: to, Savings: calc.SwitchSavings(base, to, packs)})
}

// ---------- product page ----------

// Swap is one alternative for a product, with the numbers the screen needs.
type Swap struct {
	Product     *catalog.Product `json:"product"`
	Comparison  calc.Comparison  `json:"comparison"`
	Matched     calc.Matched     `json:"matched"`
	Addons      []catalog.Addon  `json:"addons"`
	Closeness   int              `json:"closeness"`
	SachetsKept float64          `json:"sachetsKept"`
	// Current is true when the person already switched to this alternative.
	Current bool `json:"current"`
}

// Warning is the callout above the swaps: a bulk-sachet trap or a nudge towards a bulk pack.
type Warning struct {
	Type string `json:"type"` // "trap" or "nudge"
	// Ref is the renceng a trap compares against; absent when the product has no renceng sibling.
	Ref *catalog.Product `json:"ref,omitempty"`
	// Bulk is the bulk-sachet pack a nudge talks about.
	Bulk *catalog.Product `json:"bulk,omitempty"`
	// N is how many times bigger the pack is than the reference.
	N float64 `json:"n"`
	// Money is what the pack costs extra (trap) or saves (nudge) over a whole pack.
	Money float64 `json:"money"`
}

// Mine is the person's relationship to a product: none, base (marked as theirs), switched (they moved
// to To), or target (they switched to this product from another).
type Mine struct {
	State string           `json:"state"`
	To    *catalog.Product `json:"to,omitempty"`
}

// ProductPage is everything the product screen shows.
type ProductPage struct {
	Product     *catalog.Product `json:"product"`
	Mine        Mine             `json:"mine"`
	Wanted      bool             `json:"wanted"`
	Warning     *Warning         `json:"warning,omitempty"`
	Swaps       []Swap           `json:"swaps"`
	TotalSwaps  int              `json:"totalSwaps"`
	HiddenCount int              `json:"hiddenCount"`
	Refills     []Swap           `json:"refills"`
}

func (s *Server) swap(usual, alt *catalog.Product, currentTo string) Swap {
	return Swap{
		Product:     alt,
		Comparison:  calc.Compare(usual, alt),
		Matched:     calc.MatchedPer(usual, alt),
		Addons:      calc.AppliedAddons(usual, alt),
		Closeness:   calc.Closeness(usual, alt),
		SachetsKept: calc.SachetsKept(usual, alt),
		Current:     currentTo == alt.ID,
	}
}

func (s *Server) productPage(w http.ResponseWriter, r *http.Request) {
	p, ok := s.cat.Product(r.PathValue("id"))
	if !ok {
		fail(w, http.StatusNotFound, "unknown product")
		return
	}
	var migs []store.Migration
	wanted := false
	if tok, ok := s.token(r); ok {
		var err error
		if migs, err = s.store.Migrations(r.Context(), tok); err != nil {
			s.serverError(w, err)
			return
		}
		ids, err := s.store.Wanted(r.Context(), tok)
		if err != nil {
			s.serverError(w, err)
			return
		}
		for _, id := range ids {
			wanted = wanted || id == p.ID
		}
	}

	page := ProductPage{Product: p, Wanted: wanted, Mine: Mine{State: "none"}, Refills: []Swap{}}

	currentTo := ""
	for _, m := range migs {
		if m.To == p.ID {
			page.Mine.State = "target"
		}
		if m.Base == p.ID {
			currentTo = m.To
			if page.Mine.State != "target" {
				page.Mine.State = "base"
				if to, ok := s.cat.Product(m.To); ok && m.To != "" {
					page.Mine = Mine{State: "switched", To: to}
				}
			}
		}
	}

	switch bulk := s.calc.BulkSachetIn(p); {
	case p.Kind == "bulk-sachet":
		if ref := s.calc.TrapReference(p); ref != nil {
			page.Warning = &Warning{Type: "trap", Ref: ref, N: p.Servings / ref.Servings, Money: calc.Compare(ref, p).SavePerServing * p.Servings}
		} else {
			page.Warning = &Warning{Type: "trap"}
		}
	case isSachetKind(p.Kind) && bulk != nil:
		page.Warning = &Warning{Type: "nudge", Bulk: bulk, N: bulk.Servings / p.Servings, Money: calc.Compare(p, bulk).SavePerServing * bulk.Servings}
	}

	alts, hidden := s.calc.Alternatives(p)
	page.TotalSwaps, page.HiddenCount = len(alts), hidden
	limit := queryInt(r, "swaps", 5, 100)
	if limit < len(alts) {
		alts = alts[:limit]
	}
	page.Swaps = make([]Swap, 0, len(alts))
	for _, alt := range alts {
		page.Swaps = append(page.Swaps, s.swap(p, alt, currentTo))
	}
	if p.Kind != "refill" {
		for _, rf := range s.calc.RefillsFor(p) {
			page.Refills = append(page.Refills, s.swap(p, rf, currentTo))
		}
	}
	writeJSON(w, http.StatusOK, page)
}

func isSachetKind(kind string) bool {
	switch kind {
	case "sachet", "renceng", "bulk-sachet", "cup":
		return true
	}
	return false
}

// ---------- my switches ----------

// MigrationItem is one row of "my switches" with its products and what it saved so far.
type MigrationItem struct {
	Migration store.Migration  `json:"migration"`
	Base      *catalog.Product `json:"base"`
	To        *catalog.Product `json:"to,omitempty"`
	Savings   *calc.Savings    `json:"savings,omitempty"`
}

// Overview is the "my switches" screen.
type Overview struct {
	Items  []MigrationItem `json:"items"`
	Totals calc.Savings    `json:"totals"`
}

func (s *Server) migrations(w http.ResponseWriter, r *http.Request) {
	out := Overview{Items: []MigrationItem{}}
	if tok, ok := s.token(r); ok {
		migs, err := s.store.Migrations(r.Context(), tok)
		if err != nil {
			s.serverError(w, err)
			return
		}
		for _, m := range migs {
			base, ok := s.cat.Product(m.Base)
			if !ok {
				continue
			}
			item := MigrationItem{Migration: m, Base: base}
			if to, ok := s.cat.Product(m.To); ok && m.To != "" {
				sv := calc.SwitchSavings(base, to, float64(m.Buys))
				item.To, item.Savings = to, &sv
				out.Totals.Money += sv.Money
				out.Totals.Plastic += sv.Plastic
				out.Totals.Sachets += sv.Sachets
			}
			out.Items = append(out.Items, item)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) addBase(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Base string `json:"base"`
	}
	if !decode(w, r, &body) {
		return
	}
	if _, ok := s.cat.Product(body.Base); !ok {
		fail(w, http.StatusBadRequest, "unknown product")
		return
	}
	tok, err := s.ensureToken(w, r)
	if err == nil {
		err = s.store.AddBase(r.Context(), tok, body.Base)
	}
	s.done(w, err)
}

func (s *Server) switchTo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		To string `json:"to"`
	}
	if !decode(w, r, &body) {
		return
	}
	base, ok1 := s.cat.Product(r.PathValue("base"))
	to, ok2 := s.cat.Product(body.To)
	if !ok1 || !ok2 {
		fail(w, http.StatusBadRequest, "unknown product")
		return
	}
	tok, err := s.ensureToken(w, r)
	if err == nil {
		_, err = s.store.Migrate(r.Context(), tok, base.ID, to.ID)
	}
	if err != nil {
		s.serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, SwitchResult{Base: base, To: to, Savings: calc.SwitchSavings(base, to, 1)})
}

func (s *Server) buyAgain(w http.ResponseWriter, r *http.Request) {
	tok, ok := s.token(r)
	if !ok {
		fail(w, http.StatusNotFound, "no such switch")
		return
	}
	err := s.store.BuyAgain(r.Context(), tok, r.PathValue("base"))
	if errors.Is(err, store.ErrNotFound) {
		fail(w, http.StatusNotFound, "no such switch")
		return
	}
	s.done(w, err)
}

func (s *Server) remove(w http.ResponseWriter, r *http.Request) {
	if tok, ok := s.token(r); ok {
		s.done(w, s.store.Remove(r.Context(), tok, r.PathValue("base")))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) clear(w http.ResponseWriter, r *http.Request) {
	if tok, ok := s.token(r); ok {
		s.done(w, s.store.Clear(r.Context(), tok))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) want(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductID string `json:"productId"`
	}
	if !decode(w, r, &body) {
		return
	}
	if _, ok := s.cat.Product(body.ProductID); !ok {
		fail(w, http.StatusBadRequest, "unknown product")
		return
	}
	tok, err := s.ensureToken(w, r)
	if err == nil {
		err = s.store.Want(r.Context(), tok, body.ProductID)
	}
	s.done(w, err)
}

func (s *Server) done(w http.ResponseWriter, err error) {
	if err != nil {
		s.serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
