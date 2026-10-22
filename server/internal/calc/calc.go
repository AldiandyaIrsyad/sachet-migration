// Package calc holds the per-serving cost, plastic and swap maths.
package calc

import (
	"math"
	"sort"

	"sachet/server/internal/catalog"
)

// Engine computes comparisons over one catalogue.
type Engine struct{ C *catalog.Catalog }

// Comparison is how a swap compares with the usual product, per serving.
type Comparison struct {
	// DCost is the relative change in cost per serving, e.g. -0.08 = 8% cheaper.
	DCost float64 `json:"dCost"`
	// DPlastic is the relative change in plastic per serving.
	DPlastic float64 `json:"dPlastic"`
	// SavePerServing is rupiah saved per serving (negative = costs more).
	SavePerServing float64 `json:"savePerServing"`
	// PlasticSavedPerServing is grams of plastic avoided per serving.
	PlasticSavedPerServing float64 `json:"plasticSavedPerServing"`
	// WasteTolerance is the share of the new pack you could waste and still pay less per serving
	// than the usual product. 0 when the swap is not cheaper.
	WasteTolerance float64 `json:"wasteTolerance"`
}

// Matched is cost and plastic per portion of an alternative once it is made to match the usual product.
type Matched struct {
	Cost    float64 `json:"cost"`
	Plastic float64 `json:"plastic"`
}

// Savings is what a person gains by switching.
type Savings struct {
	Money   float64 `json:"money"`
	Plastic float64 `json:"plastic"`
	Sachets float64 `json:"sachets"`
}

func (e Engine) inCategory(p *catalog.Product) []*catalog.Product { return e.C.InCategory(p.Category) }

func sachetsPer(p *catalog.Product) float64 { return p.Sachets / p.Servings }

// AppliedAddons returns the extras (sugar, milk...) you would need to buy so alt matches usual.
func AppliedAddons(usual, alt *catalog.Product) []catalog.Addon {
	out := []catalog.Addon{}
	if len(alt.Addons) == 0 {
		return out
	}
	if alt.AddonsIf != nil {
		found := false
		for _, v := range alt.AddonsIf {
			if v == usual.Variant {
				found = true
			}
		}
		if !found {
			return out
		}
	}
	for _, id := range alt.Addons {
		out = append(out, catalog.Addons[id])
	}
	return out
}

// MatchedPer is the cost and plastic per portion of alt once it is made to match usual.
func MatchedPer(usual, alt *catalog.Product) Matched {
	m := Matched{Cost: alt.CostPer, Plastic: alt.PlasticPer}
	for _, a := range AppliedAddons(usual, alt) {
		m.Cost += a.CostPerServing
		m.Plastic += a.PlasticPerServing
	}
	return m
}

// Compare compares alt with usual per serving.
func Compare(usual, alt *catalog.Product) Comparison {
	cu, pu := usual.CostPer, usual.PlasticPer
	m := MatchedPer(usual, alt)
	c := Comparison{
		DCost:                  (m.Cost - cu) / cu,
		SavePerServing:         cu - m.Cost,
		PlasticSavedPerServing: pu - m.Plastic,
	}
	if pu > 0 {
		c.DPlastic = (m.Plastic - pu) / pu
	}
	if m.Cost < cu {
		c.WasteTolerance = 1 - m.Cost/cu
	}
	return c
}

// Closeness says how near a swap is to what the person already buys:
// 0 same brand and variant, 1 same brand, 2 other.
func Closeness(usual, alt *catalog.Product) int {
	if alt.Brand != usual.Brand {
		return 2
	}
	if alt.Variant == usual.Variant {
		return 0
	}
	return 1
}

// SwapScore is a weighted score: 70% money saved, 30% plastic cut (both relative to the usual product).
func SwapScore(usual, alt *catalog.Product) float64 {
	c := Compare(usual, alt)
	return 0.7*-c.DCost + 0.3*-c.DPlastic
}

// Alternatives returns pack swaps that cut plastic per serving, excluding refill stations (see RefillsFor).
// Order: same brand and variant, then same brand, then other brands; measured products before ones
// with guessed numbers; within each group, highest weighted score first.
func (e Engine) Alternatives(usual *catalog.Product) (shown []*catalog.Product, hidden int) {
	candidates := 0
	shown = []*catalog.Product{}
	for _, p := range e.inCategory(usual) {
		if p.ID == usual.ID || p.Kind == "refill" {
			continue
		}
		candidates++
		if p.PlasticPer < usual.PlasticPer {
			shown = append(shown, p)
		}
	}
	sort.SliceStable(shown, func(i, j int) bool {
		a, b := shown[i], shown[j]
		if ca, cb := Closeness(usual, a), Closeness(usual, b); ca != cb {
			return ca < cb
		}
		if ea, eb := len(a.Estimated) > 0, len(b.Estimated) > 0; ea != eb {
			return !ea
		}
		return SwapScore(usual, a) > SwapScore(usual, b)
	})
	return shown, candidates - len(shown)
}

// RefillsFor returns the zero-waste refill options for this product's category.
func (e Engine) RefillsFor(p *catalog.Product) []*catalog.Product {
	out := []*catalog.Product{}
	for _, x := range e.inCategory(p) {
		if x.Kind == "refill" {
			out = append(out, x)
		}
	}
	return out
}

// BulkSachetIn returns the bulk-sachet pack in the same category, if one exists.
func (e Engine) BulkSachetIn(p *catalog.Product) *catalog.Product {
	for _, x := range e.inCategory(p) {
		if x.Kind == "bulk-sachet" && x.ID != p.ID {
			return x
		}
	}
	return nil
}

// TrapReference returns the cheapest renceng of the same brand and variant, to show what a bulk-sachet bag costs against.
func (e Engine) TrapReference(p *catalog.Product) *catalog.Product {
	var best *catalog.Product
	for _, x := range e.C.All() {
		if x.Brand == p.Brand && x.Variant == p.Variant && x.Kind == "renceng" {
			if best == nil || x.CostPer < best.CostPer {
				best = x
			}
		}
	}
	return best
}

// SwitchSavings is what you save by buying packs of to instead of the same amount of base:
// the money and plastic base would have cost for those portions, minus what to cost.
func SwitchSavings(base, to *catalog.Product, packs float64) Savings {
	portions := to.Servings * packs
	c := Compare(base, to)
	return Savings{
		Money:   portions * c.SavePerServing,
		Plastic: portions * c.PlasticSavedPerServing,
		Sachets: math.Max(0, portions*(sachetsPer(base)-sachetsPer(to))),
	}
}

// SachetsKept is how many single-use packs you avoid by buying one pack of alt instead of the same amount of usual.
func SachetsKept(usual, alt *catalog.Product) float64 {
	return (sachetsPer(usual) - sachetsPer(alt)) * alt.Servings
}
