package catalog

import "testing"

// The catalogue shipped with the app (and its demo extras) must always load and validate.
func TestShippedDataLoads(t *testing.T) {
	c, err := LoadFiles("../../../public/data", "products.json", "demo-products.json")
	if err != nil {
		t.Fatal(err)
	}
	if len(c.All()) < 30 {
		t.Errorf("only %d products loaded", len(c.All()))
	}
	if p, ok := c.ByBarcode("8992696524323"); !ok || p.ID == "" {
		t.Error("example barcode should resolve")
	}
}

func TestValidationCatchesMistakes(t *testing.T) {
	one := 1.0
	bad := Input{ID: "x", Brand: "B", Category: "nope", Kind: "sachet", Price: -1, Portions: 1, Plastic: Plastic{Total: &one}}
	if _, err := New([]Input{bad, bad}); err == nil {
		t.Fatal("expected validation errors")
	}
}

func TestListSortsByBrandThenName(t *testing.T) {
	c, err := LoadFiles("../../../public/data", "products.json")
	if err != nil {
		t.Fatal(err)
	}
	list := c.List("", "", "en")
	for i := 1; i < len(list); i++ {
		if list[i-1].Brand > list[i].Brand && list[i-1].Brand[0] == list[i].Brand[0] {
			t.Fatalf("%s before %s", list[i-1].Brand, list[i].Brand)
		}
	}
	if got := c.List("", "no-such-category", "en"); len(got) != 0 {
		t.Errorf("unknown category should list nothing, got %d", len(got))
	}
}
