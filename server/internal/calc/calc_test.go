package calc

import (
	"math"
	"testing"

	"sachet/server/internal/catalog"
)

func f(v float64) *float64 { return &v }

func fixture(t *testing.T) Engine {
	t.Helper()
	pack := catalog.Text{ID: "p", EN: "p"}
	in := func(id, kind string, price, portions float64, plastic float64) catalog.Input {
		return catalog.Input{ID: id, Name: catalog.Text{ID: id, EN: id}, Brand: "B", Pack: pack, Category: "coffee",
			Kind: kind, Price: price, Portions: portions, Plastic: catalog.Plastic{Total: f(plastic)}}
	}
	single := in("single", "sachet", 2000, 1, 1)
	single.Barcode, single.Variant = "1234567890128", "mix"
	jar := in("jar", "jar", 30000, 20, 10)
	jar.Addons = []string{"sugar"}
	c, err := catalog.New([]catalog.Input{single, jar, in("refill", "refill", 500, 1, 0), in("worse", "bag", 90000, 10, 50)})
	if err != nil {
		t.Fatal(err)
	}
	return Engine{C: c}
}

func near(t *testing.T, name string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 1e-9 {
		t.Errorf("%s = %v, want %v", name, got, want)
	}
}

func TestCompareIncludesAddons(t *testing.T) {
	e := fixture(t)
	single, _ := e.C.Product("single")
	jar, _ := e.C.Product("jar")
	c := Compare(single, jar)
	// 30000/20 = 1500, plus 180 sugar = 1680 against 2000
	near(t, "savePerServing", c.SavePerServing, 320)
	near(t, "wasteTolerance", c.WasteTolerance, 1-1680.0/2000)
}

func TestNoWasteToleranceWhenPricier(t *testing.T) {
	e := fixture(t)
	single, _ := e.C.Product("single")
	worse, _ := e.C.Product("worse")
	near(t, "wasteTolerance", Compare(single, worse).WasteTolerance, 0)
}

func TestAlternativesCutPlasticAndSkipRefills(t *testing.T) {
	e := fixture(t)
	single, _ := e.C.Product("single")
	shown, hidden := e.Alternatives(single)
	if len(shown) != 1 || shown[0].ID != "jar" {
		t.Fatalf("shown = %v", shown)
	}
	if hidden != 1 { // "worse" has more plastic per serving
		t.Errorf("hidden = %d, want 1", hidden)
	}
}

func TestSwitchSavingsScaleWithPacks(t *testing.T) {
	e := fixture(t)
	single, _ := e.C.Product("single")
	jar, _ := e.C.Product("jar")
	s := SwitchSavings(single, jar, 2)
	near(t, "money", s.Money, 40*320)
	near(t, "plastic", s.Plastic, 40*(1-0.5-0.08))
	near(t, "sachets", s.Sachets, 40)
}

func TestLookup(t *testing.T) {
	e := fixture(t)
	for _, code := range []string{"1234567890128", "123456789012", "1234 5678 9012 8"} {
		if p, ok := e.C.ByBarcode(code); !ok || p.ID != "single" {
			t.Errorf("ByBarcode(%q) = %v, %v", code, p, ok)
		}
	}
	if _, ok := e.C.ByBarcode("000"); ok {
		t.Error("expected no match for 000")
	}
	hits, _ := e.C.Search("mix", 5)
	if len(hits) != 1 || hits[0].ID != "single" {
		t.Errorf("search by variant = %v", hits)
	}
}
