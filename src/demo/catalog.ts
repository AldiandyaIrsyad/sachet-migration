import { categories, isListed, isSachetKind, type CategoryId, type Product, type ProductInput } from '../data';

// The browser-only catalogue used by the demo. It builds lookup tables once from the JSON files, so finding a
// product never means scanning the whole list. The real app does the same work in the Go server.

export let products: Product[] = [];
export let productById = new Map<string, Product>();
export let byCategory = new Map<CategoryId, Product[]>();
let byBarcode = new Map<string, Product>();
/** First 12 digits of each barcode, for people who type it without the check digit. */
let byBarcode12 = new Map<string, Product>();
/** Lower-cased searchable text per product, in both languages. */
let haystack = new Map<string, string>();

function derive({ portions, plastic, ...rest }: ProductInput): Product {
  const plasticG = 'total' in plastic ? plastic.total : plastic.perPortion * portions;
  return {
    ...rest,
    servings: portions,
    plasticG,
    sachets: isSachetKind(rest.kind) ? portions : 0,
    costPer: rest.price / portions,
    plasticPer: plasticG / portions,
  };
}

export function loadCatalog(inputs: ProductInput[]): void {
  products = inputs.map(derive);
  productById = new Map(products.map((p) => [p.id, p]));
  byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode, p]));
  byBarcode12 = new Map(products.filter((p) => p.barcode.length === 13).map((p) => [p.barcode.slice(0, 12), p]));
  byCategory = new Map();
  for (const p of products) {
    const list = byCategory.get(p.category);
    if (list) list.push(p);
    else byCategory.set(p.category, [p]);
  }
  haystack = new Map(
    products.map((p) => [
      p.id,
      `${typeof p.name === 'string' ? p.name : `${p.name.id} ${p.name.en}`} ${p.brand} ${p.variant ?? ''} ${p.pack.id} ${p.pack.en} ${categories[p.category].label.id} ${categories[p.category].label.en}`.toLowerCase(),
    ]),
  );
}

export function findByBarcode(code: string): Product | undefined {
  const clean = code.replace(/\D/g, '');
  const exact = byBarcode.get(clean);
  if (exact) return exact;
  // Typing 12 digits (without the check digit) should still find the product.
  return clean.length === 12 ? byBarcode12.get(clean) : undefined;
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
