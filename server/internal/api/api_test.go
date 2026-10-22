package api_test

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"testing"

	"sachet/server/internal/api"
	"sachet/server/internal/catalog"
	"sachet/server/internal/store"
)

// newClient starts the real server on the real catalogue with an in-memory database.
func newClient(t *testing.T) (*http.Client, string) {
	t.Helper()
	cat, err := catalog.LoadFiles("../../../public/data", "products.json", "demo-products.json")
	if err != nil {
		t.Fatal(err)
	}
	st, err := store.OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	ts := httptest.NewServer(api.New(cat, st, "", slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(ts.Close)
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar}, ts.URL
}

func call(t *testing.T, c *http.Client, method, url string, body any, out any) int {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, url, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if out != nil && resp.StatusCode < 300 && resp.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			t.Fatal(err)
		}
	}
	return resp.StatusCode
}

func TestCatalogueEndpoints(t *testing.T) {
	c, base := newClient(t)

	var list struct {
		Items      []catalog.Product `json:"items"`
		Total      int               `json:"total"`
		Categories []string          `json:"categories"`
	}
	if code := call(t, c, "GET", base+"/api/products?limit=3", nil, &list); code != 200 {
		t.Fatalf("list status %d", code)
	}
	if len(list.Items) != 3 || list.Total < 3 || len(list.Categories) == 0 {
		t.Fatalf("unexpected list: %d items, total %d", len(list.Items), list.Total)
	}

	var milo catalog.Product
	if code := call(t, c, "GET", base+"/api/barcode/8992696524323", nil, &milo); code != 200 {
		t.Fatalf("barcode status %d", code)
	}
	if code := call(t, c, "GET", base+"/api/barcode/123", nil, nil); code != 404 {
		t.Errorf("unknown barcode status %d, want 404", code)
	}
}

func TestSwitchFlowKeepsStatePerSession(t *testing.T) {
	c, base := newClient(t)

	var empty api.Overview
	call(t, c, "GET", base+"/api/migrations", nil, &empty)
	if len(empty.Items) != 0 {
		t.Fatalf("new visitor should have no switches, got %d", len(empty.Items))
	}

	var res api.SwitchResult
	if code := call(t, c, "POST", base+"/api/migrations/milo-bag18/switch", map[string]string{"to": "milo-790"}, &res); code != 200 {
		t.Fatalf("switch status %d", code)
	}
	if res.Savings.Money <= 0 {
		t.Errorf("expected the swap to save money, got %v", res.Savings.Money)
	}
	if code := call(t, c, "POST", base+"/api/migrations/milo-bag18/again", map[string]string{}, nil); code != 204 {
		t.Errorf("buy again status %d", code)
	}

	var ov api.Overview
	call(t, c, "GET", base+"/api/migrations", nil, &ov)
	if len(ov.Items) != 1 || ov.Items[0].Migration.Buys != 2 {
		t.Fatalf("unexpected overview: %+v", ov.Items)
	}
	if want := res.Savings.Money * 2; ov.Totals.Money < want-1e-6 || ov.Totals.Money > want+1e-6 {
		t.Errorf("totals money = %v, want %v", ov.Totals.Money, want)
	}

	// The product page knows about the switch.
	var page api.ProductPage
	call(t, c, "GET", base+"/api/products/milo-790/page", nil, &page)
	if page.Mine.State != "target" {
		t.Errorf("mine state = %q, want target", page.Mine.State)
	}

	// Another visitor sees none of it.
	other, _ := newClientOn(base)
	var theirs api.Overview
	call(t, other, "GET", base+"/api/migrations", nil, &theirs)
	if len(theirs.Items) != 0 {
		t.Errorf("a different session should not see these switches")
	}

	if code := call(t, c, "DELETE", base+"/api/migrations/milo-bag18", nil, nil); code != 204 {
		t.Errorf("remove status %d", code)
	}
	call(t, c, "GET", base+"/api/migrations", nil, &ov)
	if len(ov.Items) != 0 {
		t.Errorf("switch should be gone, got %d", len(ov.Items))
	}
}

func newClientOn(string) (*http.Client, error) {
	jar, err := cookiejar.New(nil)
	return &http.Client{Jar: jar}, err
}

func TestRejectsBadInput(t *testing.T) {
	c, base := newClient(t)
	if code := call(t, c, "POST", base+"/api/migrations", map[string]string{"base": "nope"}, nil); code != 400 {
		t.Errorf("unknown product status %d, want 400", code)
	}
	if code := call(t, c, "POST", base+"/api/wants", map[string]string{"productId": "milo-bag18", "extra": "x"}, nil); code != 400 {
		t.Errorf("unknown field status %d, want 400", code)
	}
	req, _ := http.NewRequest("POST", base+"/api/wants", bytes.NewReader([]byte(`{"productId":"milo-bag18"}`)))
	req.Header.Set("Content-Type", "text/plain")
	resp, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnsupportedMediaType {
		t.Errorf("non-JSON body status %d, want 415", resp.StatusCode)
	}
}
