import type { L } from './i18n';

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO ADD OR EDIT A PRODUCT
// For each product you only need three numbers from the shelf:
//   price     – shelf price in rupiah
//   portions  – how many portions (cups, washes, bowls) the pack makes
//   plastic   – grams of plastic packaging, EITHER for the whole pack
//               { total: 12 }  OR for one portion  { perPortion: 1.2 }
// Price per portion and plastic per portion are calculated from these.
//
// SAMPLE DATA: the numbers below are rough estimates. Replace them with your
// shelf prices and weighed packaging. Barcodes starting 8990000 are placeholders.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryId = 'coffee' | 'cereal' | 'chocolate' | 'spice' | 'floor' | 'ironing' | 'detergent' | 'milk';

export type Kind =
  | 'sachet'
  | 'renceng'
  | 'bulk-sachet'
  | 'cup'
  | 'pouch'
  | 'bag'
  | 'box'
  | 'jar'
  | 'can'
  | 'homemade'
  | 'refill';

export type AddonId = 'sugar' | 'creamer' | 'milk';

type PlasticInput = { total: number } | { perPortion: number };

export type Estimate = 'price' | 'plastic' | 'portions';

interface ProductInput {
  id: string;
  /** EAN-13 printed under the barcode. Empty for refills. */
  barcode: string;
  brand: string;
  /** Flavour/line within the brand. Same brand + same variant is the easiest swap. */
  variant?: string;
  name: L | string;
  /** What's on the shelf, e.g. "Renceng isi 10 sachet". */
  pack: L;
  category: CategoryId;
  kind: Kind;
  price: number;
  portions: number;
  plastic: PlasticInput;
  /** Things you have to buy separately to match the usual product (sugar, milk…). */
  addons?: AddonId[];
  /** Only add `addons` when switching from one of these variants. Absent = always. */
  addonsIf?: string[];
  note?: L;
  /** Not available yet; shown as a preview of the refill idea. */
  future?: boolean;
  /** Numbers that are guesses, not measured. Shown with an asterisk. */
  estimated?: Estimate[];
  /** No bigger pack of this product exists on the minimarket shelf. */
  noBigPack?: boolean;
  /** How to measure one portion so it matches the usual product, e.g. "25 g + 170 ml air". */
  portionHint?: L;
  /** For refills: where to get it. */
  provider?: L;
}

export interface Product extends Omit<ProductInput, 'portions' | 'plastic'> {
  /** Portions per pack. */
  servings: number;
  /** Grams of plastic per pack. */
  plasticG: number;
  /** Single-use packs thrown away per pack (sachets, cups). */
  sachets: number;
}

export interface Category {
  id: CategoryId;
  label: L;
  /** Portion unit: "gelas" / "cup". */
  unit: L;
  /** English plural for "30 cups a month"; Indonesian doesn't pluralise. */
  unitPluralEn: string;
  /** Default portions a household uses per month. */
  monthly: number;
}

export interface Addon {
  id: AddonId;
  name: L;
  costPerServing: number;
  plasticPerServing: number;
}

export const categories: Record<CategoryId, Category> = {
  // Categories with measured data come first, so they lead the shelf.
  chocolate: {
    id: 'chocolate', label: { id: 'Minuman cokelat', en: 'Chocolate drink' },
    unit: { id: 'gelas', en: 'glass' }, unitPluralEn: 'glasses', monthly: 20,
  },
  cereal: {
    id: 'cereal', label: { id: 'Sereal', en: 'Cereal' },
    unit: { id: 'porsi', en: 'serving' }, unitPluralEn: 'servings', monthly: 20,
  },
  spice: {
    id: 'spice', label: { id: 'Bumbu instan', en: 'Instant seasoning' },
    unit: { id: 'kali masak', en: 'cooking' }, unitPluralEn: 'cookings', monthly: 8,
  },
  coffee: {
    id: 'coffee', label: { id: 'Kopi', en: 'Coffee' },
    unit: { id: 'gelas', en: 'cup' }, unitPluralEn: 'cups', monthly: 30,
  },
  detergent: {
    id: 'detergent', label: { id: 'Deterjen', en: 'Detergent' },
    unit: { id: 'kali cuci', en: 'wash' }, unitPluralEn: 'washes', monthly: 20,
  },
  floor: {
    id: 'floor', label: { id: 'Pembersih lantai', en: 'Floor cleaner' },
    unit: { id: 'kali pel', en: 'mop' }, unitPluralEn: 'mops', monthly: 30,
  },
  ironing: {
    id: 'ironing', label: { id: 'Pelicin pakaian', en: 'Ironing spray' },
    unit: { id: '100 ml', en: '100 ml' }, unitPluralEn: '× 100 ml', monthly: 4,
  },
  milk: {
    id: 'milk', label: { id: 'Susu kental manis', en: 'Condensed milk' },
    unit: { id: 'kali pakai', en: 'use' }, unitPluralEn: 'uses', monthly: 30,
  },
};

// Extras needed so a swap matches what the usual product gives you.
export const addons: Record<AddonId, Addon> = {
  sugar: { id: 'sugar', name: { id: 'gula 1 kg', en: '1 kg sugar' }, costPerServing: 180, plasticPerServing: 0.08 },
  creamer: { id: 'creamer', name: { id: 'krimer 500 g', en: '500 g creamer' }, costPerServing: 400, plasticPerServing: 0.16 },
  // ESTIMATE: the cup holds ≈ 8–10 g Dancow (30 g label − 20 g cereal measured).
  // 8 g from an 800 g box at ≈ Rp 131/g ≈ Rp 1.050; foil bag ≈ 0,08 g per portion.
  milk: { id: 'milk', name: { id: 'susu bubuk ±8 g', en: '≈8 g milk powder' }, costPerServing: 1050, plasticPerServing: 0.08 },
};

// ─────────────────────────────────────────────────────────────────────────────
// The catalogue lives in public/data/products.json and is loaded at start-up, so the
// code bundle stays small however many products it holds. Everything below builds
// lookup tables once, so finding a product never means scanning the whole list.
// ─────────────────────────────────────────────────────────────────────────────

const SINGLE_USE: Kind[] = ['sachet', 'renceng', 'bulk-sachet', 'cup'];

export let products: Product[] = [];
export let productById = new Map<string, Product>();
export let byCategory = new Map<CategoryId, Product[]>();
let byBarcode = new Map<string, Product>();
/** Lower-cased searchable text per product, in both languages. */
let haystack = new Map<string, string>();

function derive({ portions, plastic, ...rest }: ProductInput): Product {
  return {
    ...rest,
    servings: portions,
    plasticG: 'total' in plastic ? plastic.total : plastic.perPortion * portions,
    sachets: SINGLE_USE.includes(rest.kind) ? portions : 0,
  };
}

export async function loadCatalog(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/products.json`);
  if (!res.ok) throw new Error(`products.json: ${res.status}`);
  const inputs = (await res.json()) as ProductInput[];

  products = inputs.map(derive);
  productById = new Map(products.map((p) => [p.id, p]));
  byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode, p]));
  byCategory = new Map();
  for (const p of products) {
    const list = byCategory.get(p.category);
    if (list) list.push(p);
    else byCategory.set(p.category, [p]);
  }
  haystack = new Map(
    products.map((p) => [
      p.id,
      `${typeof p.name === 'string' ? p.name : `${p.name.id} ${p.name.en}`} ${p.brand} ${p.pack.id} ${p.pack.en} ${categories[p.category].label.id} ${categories[p.category].label.en}`.toLowerCase(),
    ]),
  );
}

/** Products worth listing to a shopper (not refill previews or homemade tips). */
export const isListed = (p: Product) => !p.future && p.kind !== 'homemade';

export function findByBarcode(code: string): Product | undefined {
  const clean = code.replace(/\D/g, '');
  const exact = byBarcode.get(clean);
  if (exact) return exact;
  // Typing 12 digits (without the check digit) should still find the product.
  if (clean.length === 12) return products.find((p) => p.barcode.startsWith(clean));
  return undefined;
}

/**
 * Ranked search: every word must appear; names that start with the query rank first,
 * then whole-word hits, then anywhere. Returns the top `limit` and the total hit count.
 */
export function search(query: string, limit: number): { hits: Product[]; total: number } {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const digits = query.replace(/\D/g, '');
  const scored: { p: Product; score: number }[] = [];
  for (const p of products) {
    if (!isListed(p)) continue;
    const text = haystack.get(p.id)!;
    if (digits.length >= 4 && p.barcode.includes(digits)) {
      scored.push({ p, score: 0 });
      continue;
    }
    if (!words.every((w) => text.includes(w))) continue;
    const startsWith = words.every((w) => text.startsWith(w) || text.includes(` ${w}`));
    scored.push({ p, score: text.startsWith(words[0]) ? 1 : startsWith ? 2 : 3 });
  }
  scored.sort((a, b) => a.score - b.score);
  return { hits: scored.slice(0, limit).map((x) => x.p), total: scored.length };
}

export const kindLabel: Record<Kind, L> = {
  sachet: { id: 'Sachet', en: 'Sachet' },
  renceng: { id: 'Renceng', en: 'Renceng' },
  'bulk-sachet': { id: 'Sachet sekantong', en: 'Bag of sachets' },
  cup: { id: 'Cup sekali pakai', en: 'Single-use cup' },
  pouch: { id: 'Pouch', en: 'Pouch' },
  bag: { id: 'Kantong', en: 'Bag' },
  box: { id: 'Kotak', en: 'Box' },
  jar: { id: 'Toples', en: 'Jar' },
  can: { id: 'Kaleng', en: 'Can' },
  homemade: { id: 'Racik sendiri', en: 'Homemade' },
  refill: { id: 'Isi ulang', en: 'Refill' },
};

export const isSachetKind = (k: Kind) => SINGLE_USE.includes(k);
