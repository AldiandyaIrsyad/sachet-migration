// Package catalog holds the product catalogue: loading, validation, derived per-serving numbers,
// barcode lookup and ranked search. It is read-only after load, so it is safe for concurrent use.
package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/text/collate"
	"golang.org/x/text/language"
)

// Text is a bilingual string. In JSON it is either a plain string (same in both languages) or {id, en}.
type Text struct {
	ID string `json:"id"`
	EN string `json:"en"`
}

func (t *Text) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		t.ID, t.EN = s, s
		return nil
	}
	var o struct {
		ID string `json:"id"`
		EN string `json:"en"`
	}
	if err := json.Unmarshal(b, &o); err != nil {
		return err
	}
	t.ID, t.EN = o.ID, o.EN
	return nil
}

// In returns the text for a language code ("id" or "en").
func (t Text) In(lang string) string {
	if lang == "en" {
		return t.EN
	}
	return t.ID
}

// Addon is something you have to buy separately so a swap matches the usual product.
type Addon struct {
	ID                string  `json:"id"`
	Name              Text    `json:"name"`
	CostPerServing    float64 `json:"costPerServing"`
	PlasticPerServing float64 `json:"plasticPerServing"`
}

// Addons mirrors the table in the frontend's src/data.ts.
var Addons = map[string]Addon{
	"sugar":   {ID: "sugar", Name: Text{ID: "gula 1 kg", EN: "1 kg sugar"}, CostPerServing: 180, PlasticPerServing: 0.08},
	"creamer": {ID: "creamer", Name: Text{ID: "krimer 500 g", EN: "500 g creamer"}, CostPerServing: 400, PlasticPerServing: 0.16},
	"milk":    {ID: "milk", Name: Text{ID: "susu bubuk ±8 g", EN: "≈8 g milk powder"}, CostPerServing: 1050, PlasticPerServing: 0.08},
}

var categoryIDs = []string{"chocolate", "cereal", "spice", "coffee", "detergent", "floor", "ironing", "milk", "shampoo", "sauce"}

var kindIDs = []string{"sachet", "renceng", "bulk-sachet", "cup", "pouch", "bag", "box", "jar", "can", "homemade", "refill"}

var singleUse = map[string]bool{"sachet": true, "renceng": true, "bulk-sachet": true, "cup": true}

// Plastic is grams of packaging, for the whole pack (total) or for one portion (perPortion).
type Plastic struct {
	Total      *float64 `json:"total"`
	PerPortion *float64 `json:"perPortion"`
}

// Input is one row of products.json.
type Input struct {
	ID          string   `json:"id"`
	Barcode     string   `json:"barcode"`
	Brand       string   `json:"brand"`
	Variant     string   `json:"variant"`
	Name        Text     `json:"name"`
	Pack        Text     `json:"pack"`
	Category    string   `json:"category"`
	Kind        string   `json:"kind"`
	Price       float64  `json:"price"`
	Portions    float64  `json:"portions"`
	Plastic     Plastic  `json:"plastic"`
	Addons      []string `json:"addons"`
	AddonsIf    []string `json:"addonsIf"`
	Note        *Text    `json:"note"`
	Future      bool     `json:"future"`
	Estimated   []string `json:"estimated"`
	NoBigPack   bool     `json:"noBigPack"`
	PortionHint *Text    `json:"portionHint"`
	Provider    *Text    `json:"provider"`
}

// Product is an Input plus the numbers derived from it. This is also the JSON the API serves.
type Product struct {
	ID          string   `json:"id"`
	Barcode     string   `json:"barcode"`
	Brand       string   `json:"brand"`
	Variant     string   `json:"variant,omitempty"`
	Name        Text     `json:"name"`
	Pack        Text     `json:"pack"`
	Category    string   `json:"category"`
	Kind        string   `json:"kind"`
	Price       float64  `json:"price"`
	Addons      []string `json:"addons,omitempty"`
	AddonsIf    []string `json:"addonsIf,omitempty"`
	Note        *Text    `json:"note,omitempty"`
	Future      bool     `json:"future,omitempty"`
	Estimated   []string `json:"estimated,omitempty"`
	NoBigPack   bool     `json:"noBigPack,omitempty"`
	PortionHint *Text    `json:"portionHint,omitempty"`
	Provider    *Text    `json:"provider,omitempty"`

	// Servings is the portions per pack.
	Servings float64 `json:"servings"`
	// PlasticG is grams of plastic per pack.
	PlasticG float64 `json:"plasticG"`
	// Sachets is the single-use packs thrown away per pack (sachets, cups).
	Sachets float64 `json:"sachets"`
	// CostPer is the shelf price per portion.
	CostPer float64 `json:"costPer"`
	// PlasticPer is grams of plastic per portion.
	PlasticPer float64 `json:"plasticPer"`
}

// Listed reports whether a shopper should see this product (not refill previews or homemade tips).
func (p *Product) Listed() bool { return !p.Future && p.Kind != "homemade" }

// Catalog is the loaded catalogue with its lookup tables.
type Catalog struct {
	products    []*Product
	byID        map[string]*Product
	byCategory  map[string][]*Product
	byBarcode   map[string]*Product
	byBarcode12 map[string]*Product
	haystack    map[string]string
	// sorted holds listed products ordered by brand then name, per language.
	sorted map[string][]*Product
}

// LoadFiles reads and merges the named JSON files from dir.
func LoadFiles(dir string, files ...string) (*Catalog, error) {
	var inputs []Input
	for _, f := range files {
		raw, err := os.ReadFile(filepath.Join(dir, f))
		if err != nil {
			return nil, err
		}
		var in []Input
		if err := json.Unmarshal(raw, &in); err != nil {
			return nil, fmt.Errorf("%s: %w", f, err)
		}
		inputs = append(inputs, in...)
	}
	return New(inputs)
}

// New validates the inputs and builds the lookup tables.
func New(inputs []Input) (*Catalog, error) {
	if err := validate(inputs); err != nil {
		return nil, err
	}
	c := &Catalog{
		byID:        map[string]*Product{},
		byCategory:  map[string][]*Product{},
		byBarcode:   map[string]*Product{},
		byBarcode12: map[string]*Product{},
		haystack:    map[string]string{},
	}
	for _, in := range inputs {
		p := derive(in)
		c.products = append(c.products, p)
		c.byID[p.ID] = p
		c.byCategory[p.Category] = append(c.byCategory[p.Category], p)
		if p.Barcode != "" {
			c.byBarcode[p.Barcode] = p
			if len(p.Barcode) == 13 {
				c.byBarcode12[p.Barcode[:12]] = p
			}
		}
		c.haystack[p.ID] = strings.ToLower(strings.Join([]string{
			p.Name.ID, p.Name.EN, p.Brand, p.Variant, p.Pack.ID, p.Pack.EN, categoryLabel(p.Category),
		}, " "))
	}
	c.sorted = map[string][]*Product{}
	for lang, tag := range map[string]language.Tag{"id": language.Indonesian, "en": language.English} {
		col := collate.New(tag)
		var list []*Product
		for _, p := range c.products {
			if p.Listed() {
				list = append(list, p)
			}
		}
		sort.SliceStable(list, func(i, j int) bool {
			if r := col.CompareString(list[i].Brand, list[j].Brand); r != 0 {
				return r < 0
			}
			return col.CompareString(list[i].Name.In(lang), list[j].Name.In(lang)) < 0
		})
		c.sorted[lang] = list
	}
	return c, nil
}

func derive(in Input) *Product {
	plastic := 0.0
	if in.Plastic.Total != nil {
		plastic = *in.Plastic.Total
	} else if in.Plastic.PerPortion != nil {
		plastic = *in.Plastic.PerPortion * in.Portions
	}
	p := &Product{
		ID: in.ID, Barcode: in.Barcode, Brand: in.Brand, Variant: in.Variant, Name: in.Name, Pack: in.Pack,
		Category: in.Category, Kind: in.Kind, Price: in.Price, Addons: in.Addons, AddonsIf: in.AddonsIf,
		Note: in.Note, Future: in.Future, Estimated: in.Estimated, NoBigPack: in.NoBigPack,
		PortionHint: in.PortionHint, Provider: in.Provider,
		Servings: in.Portions, PlasticG: plastic,
		CostPer: in.Price / in.Portions, PlasticPer: plastic / in.Portions,
	}
	if singleUse[in.Kind] {
		p.Sachets = in.Portions
	}
	return p
}

// categoryLabel is only used to make a category name searchable.
func categoryLabel(id string) string {
	labels := map[string]string{
		"chocolate": "minuman cokelat chocolate drink", "cereal": "sereal cereal", "spice": "bumbu instan instant seasoning",
		"coffee": "kopi coffee", "detergent": "deterjen detergent", "floor": "pembersih lantai floor cleaner",
		"ironing": "pelicin pakaian ironing spray", "milk": "susu kental manis condensed milk",
		"shampoo": "sampo shampoo", "sauce": "kecap manis sweet soy sauce",
	}
	return labels[id]
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

func validate(inputs []Input) error {
	var errs []error
	ids := map[string]bool{}
	barcodes := map[string]string{}
	bad := func(i int, id, format string, a ...any) {
		errs = append(errs, fmt.Errorf("#%d (%s): %s", i, id, fmt.Sprintf(format, a...)))
	}
	positive := func(f float64) bool { return f > 0 && !math.IsInf(f, 0) && !math.IsNaN(f) }
	for i, p := range inputs {
		if p.ID == "" || ids[p.ID] {
			bad(i, p.ID, "missing or duplicate id")
		}
		ids[p.ID] = true
		if p.Barcode != "" {
			if l := len(p.Barcode); (l != 12 && l != 13) || strings.Trim(p.Barcode, "0123456789") != "" {
				bad(i, p.ID, "barcode %q must be 12 or 13 digits", p.Barcode)
			}
			if other, dup := barcodes[p.Barcode]; dup {
				bad(i, p.ID, "barcode %s also used by %s", p.Barcode, other)
			}
			barcodes[p.Barcode] = p.ID
		}
		if p.Brand == "" {
			bad(i, p.ID, "missing brand")
		}
		if !contains(categoryIDs, p.Category) {
			bad(i, p.ID, "unknown category %q", p.Category)
		}
		if !contains(kindIDs, p.Kind) {
			bad(i, p.ID, "unknown kind %q", p.Kind)
		}
		if !positive(p.Price) {
			bad(i, p.ID, "price must be a positive number")
		}
		if !positive(p.Portions) {
			bad(i, p.ID, "portions must be a positive number")
		}
		if (p.Plastic.Total == nil && p.Plastic.PerPortion == nil) ||
			(p.Plastic.Total != nil && *p.Plastic.Total < 0) ||
			(p.Plastic.Total == nil && *p.Plastic.PerPortion < 0) {
			bad(i, p.ID, "plastic needs total or perPortion (>= 0)")
		}
		for _, a := range p.Addons {
			if _, ok := Addons[a]; !ok {
				bad(i, p.ID, "unknown addon %q", a)
			}
		}
	}
	return errors.Join(errs...)
}

// All returns every product, including refill previews.
func (c *Catalog) All() []*Product { return c.products }

// Product finds a product by id.
func (c *Catalog) Product(id string) (*Product, bool) {
	p, ok := c.byID[id]
	return p, ok
}

// InCategory returns every product in a category, in catalogue order.
func (c *Catalog) InCategory(category string) []*Product { return c.byCategory[category] }

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// ByBarcode finds a product by scanned or typed barcode. A 12-digit code (check digit left off) still matches.
func (c *Catalog) ByBarcode(code string) (*Product, bool) {
	clean := digitsOnly(code)
	if p, ok := c.byBarcode[clean]; ok {
		return p, true
	}
	if len(clean) == 12 {
		p, ok := c.byBarcode12[clean]
		return p, ok
	}
	return nil, false
}

// Categories lists the categories that have at least one listed product.
func (c *Catalog) Categories() []string {
	out := []string{}
	for _, id := range categoryIDs {
		for _, p := range c.byCategory[id] {
			if p.Listed() {
				out = append(out, id)
				break
			}
		}
	}
	return out
}

// Search ranks listed products: every word must appear; names that start with the query rank first,
// then whole-word hits, then anywhere. Returns the top limit and the total hit count.
func (c *Catalog) Search(query string, limit int) (hits []*Product, total int) {
	ranked := c.rank(query)
	total = len(ranked)
	if limit < len(ranked) {
		ranked = ranked[:limit]
	}
	return ranked, total
}

func (c *Catalog) rank(query string) []*Product {
	words := strings.Fields(strings.ToLower(query))
	d := digitsOnly(query)
	type scored struct {
		p     *Product
		score int
	}
	var found []scored
	for _, p := range c.products {
		if !p.Listed() {
			continue
		}
		if len(d) >= 4 && strings.Contains(p.Barcode, d) {
			found = append(found, scored{p, 0})
			continue
		}
		if len(words) == 0 {
			continue
		}
		text := c.haystack[p.ID]
		all, wholeWord := true, true
		for _, w := range words {
			if !strings.Contains(text, w) {
				all = false
				break
			}
			if !strings.HasPrefix(text, w) && !strings.Contains(text, " "+w) {
				wholeWord = false
			}
		}
		if !all {
			continue
		}
		score := 3
		if strings.HasPrefix(text, words[0]) {
			score = 1
		} else if wholeWord {
			score = 2
		}
		found = append(found, scored{p, score})
	}
	sort.SliceStable(found, func(i, j int) bool { return found[i].score < found[j].score })
	out := make([]*Product, len(found))
	for i, f := range found {
		out[i] = f.p
	}
	return out
}

// List returns the listed products for the browser: ranked hits when there is a query, otherwise
// everything sorted by brand and name in lang. category "" means all categories.
func (c *Catalog) List(query, category, lang string) []*Product {
	var pool []*Product
	if strings.TrimSpace(query) != "" {
		pool = c.rank(query)
	} else if s, ok := c.sorted[lang]; ok {
		pool = s
	} else {
		pool = c.sorted["id"]
	}
	if category == "" {
		return pool
	}
	out := make([]*Product, 0, len(pool))
	for _, p := range pool {
		if p.Category == category {
			out = append(out, p)
		}
	}
	return out
}
