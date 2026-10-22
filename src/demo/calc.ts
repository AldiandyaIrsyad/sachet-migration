import { addons, type Product } from '../data';
import type { Comparison, Savings } from '../ports';
import { byCategory, productById } from './catalog';

const inCategory = (p: Product) => byCategory.get(p.category) ?? [];


/** Extras (sugar, milk…) you'd need to buy so `alt` matches `usual`. */
export function appliedAddons(usual: Product, alt: Product) {
  if (!alt.addons) return [];
  if (alt.addonsIf && !alt.addonsIf.includes(usual.variant ?? '')) return [];
  return alt.addons.map((a) => addons[a]);
}

/** Cost and plastic per portion of `alt` once it's made to match `usual`. */
export function matchedPer(usual: Product, alt: Product) {
  const extra = appliedAddons(usual, alt);
  return {
    cost: alt.costPer + extra.reduce((s, a) => s + a.costPerServing, 0),
    plastic: alt.plasticPer + extra.reduce((s, a) => s + a.plasticPerServing, 0),
  };
}

export const sachetsPer = (p: Product) => p.sachets / p.servings;

export function compare(usual: Product, alt: Product): Comparison {
  const cu = usual.costPer;
  const pu = usual.plasticPer;
  const { cost: ca, plastic: pa } = matchedPer(usual, alt);
  return {
    dCost: (ca - cu) / cu,
    dPlastic: pu > 0 ? (pa - pu) / pu : 0,
    savePerServing: cu - ca,
    plasticSavedPerServing: pu - pa,
    wasteTolerance: ca < cu ? 1 - ca / cu : 0,
  };
}

/** How close a swap is to what the person already buys: 0 same brand and variant, 1 same brand, 2 other. */
export function closeness(usual: Product, alt: Product): 0 | 1 | 2 {
  if (alt.brand !== usual.brand) return 2;
  return alt.variant === usual.variant ? 0 : 1;
}

/** Weighted score: 70% money saved, 30% plastic cut (both relative to the usual product). */
export function swapScore(usual: Product, alt: Product): number {
  const c = compare(usual, alt);
  return 0.7 * -c.dCost + 0.3 * -c.dPlastic;
}

/**
 * Pack swaps that cut plastic per serving, excluding refill stations (see refillsFor).
 * Order: same brand and variant, then same brand, then other brands;
 * within each group, highest weighted score first.
 */
export function alternatives(usual: Product): { shown: Product[]; hiddenCount: number } {
  const candidates = inCategory(usual).filter((p) => p.id !== usual.id && p.kind !== 'refill');
  const shown = candidates
    .filter((p) => p.plasticPer < usual.plasticPer)
    .sort(
      (a, b) =>
        closeness(usual, a) - closeness(usual, b) ||
        // Measured products before ones with guessed numbers.
        Number(!!a.estimated?.length) - Number(!!b.estimated?.length) ||
        swapScore(usual, b) - swapScore(usual, a),
    );
  return { shown, hiddenCount: candidates.length - shown.length };
}

/** Zero-waste refill options for this product's category. */
export function refillsFor(p: Product): Product[] {
  return inCategory(p).filter((x) => x.kind === 'refill');
}

/** The bulk-sachet pack in the same category, if one exists. */
export function bulkSachetIn(p: Product): Product | undefined {
  return inCategory(p).find((x) => x.kind === 'bulk-sachet' && x.id !== p.id);
}

/**
 * What you save by buying `packs` of `to` instead of the same amount of `base`:
 * the money and plastic the base product would have cost for those portions, minus what `to` cost.
 */
export function switchSavings(base: Product, to: Product, packs: number): Savings {
  const portions = to.servings * packs;
  const c = compare(base, to);
  return {
    money: portions * c.savePerServing,
    plastic: portions * c.plasticSavedPerServing,
    sachets: Math.max(0, portions * (sachetsPer(base) - sachetsPer(to))),
  };
}

export function migrationSavings(m: { base: string; to?: string; buys: number }): Savings | null {
  const base = productById.get(m.base);
  const to = m.to ? productById.get(m.to) : undefined;
  if (!base || !to) return null;
  return switchSavings(base, to, m.buys);
}

export function totals(ms: { base: string; to?: string; buys: number }[]): Savings {
  return ms.reduce<Savings>(
    (t, m) => {
      const s = migrationSavings(m);
      if (!s) return t;
      return { money: t.money + s.money, plastic: t.plastic + s.plastic, sachets: t.sachets + s.sachets };
    },
    { money: 0, plastic: 0, sachets: 0 },
  );
}
