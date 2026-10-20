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
const ALL: Estimate[] = ['price', 'plastic', 'portions'];

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

const REFILL_SHOP: L = { id: 'toko isi ulang terdekat', en: 'the nearest refill shop' };

const inputs: ProductInput[] = [
  // ── Flow 1: Coffee. Kapal Api renceng → Kapal Api ground, Nescafé jar ──
  {
    id: 'kapal-mix-renceng', barcode: '8990000000028', brand: 'Kapal Api', variant: 'special-mix',
    name: 'Kapal Api Special Mix', pack: { id: 'Renceng isi 10 sachet', en: 'Renceng of 10 sachets' },
    category: 'coffee', kind: 'renceng',
    price: 15500, portions: 10, plastic: { perPortion: 1.2 }, estimated: ALL, noBigPack: true,
  },
  {
    id: 'kapal-mix-single', barcode: '8990000000011', brand: 'Kapal Api', variant: 'special-mix',
    name: 'Kapal Api Special Mix', pack: { id: '1 sachet 24 g', en: '1 sachet, 24 g' },
    category: 'coffee', kind: 'sachet',
    price: 1700, portions: 1, plastic: { total: 1.2 }, estimated: ALL, noBigPack: true,
  },
  {
    id: 'kapal-mix-bag30', barcode: '8990000000035', brand: 'Kapal Api', variant: 'special-mix',
    name: 'Kapal Api Special Mix', pack: { id: 'Sekantong isi 30 sachet', en: 'Bag of 30 sachets' },
    category: 'coffee', kind: 'bulk-sachet',
    price: 45000, portions: 30, plastic: { total: 30 * 1.2 + 6 }, estimated: ALL, noBigPack: true,
  },
  {
    id: 'kapal-ground-165', barcode: '8990000000042', brand: 'Kapal Api', variant: 'special',
    name: 'Kapal Api Special', pack: { id: 'Kopi bubuk, kantong 165 g', en: 'Ground coffee, 165 g bag' },
    category: 'coffee', kind: 'bag',
    price: 15000, portions: 16, plastic: { total: 6 }, addons: ['sugar'], addonsIf: ['special-mix'], estimated: ALL,
    note: { id: 'Kopi hitam bubuk.', en: 'Black ground coffee.' },
  },
  {
    id: 'nescafe-classic-100', barcode: '8990000000059', brand: 'Nescafé', variant: 'classic',
    name: 'Nescafé Classic', pack: { id: 'Toples kaca 100 g', en: '100 g glass jar' },
    category: 'coffee', kind: 'jar',
    price: 65000, portions: 50, plastic: { total: 5 }, addons: ['sugar', 'creamer'], addonsIf: ['special-mix'], estimated: ALL,
  },

  // Aldiandya's own migration, MEASURED: bag of 10 × 2 g sachets = Rp 14.300, 1,4 g outer bag + 3,6 g for
  // the 10 sachets = 5,0 g. 90 g pouch = Rp 56.700 for 45 cups, 4,1 g. Barcodes are still placeholders.
  {
    id: 'nescafe-classic-10x2', barcode: '8990000000066', brand: 'Nescafé', variant: 'classic',
    name: 'Nescafé Classic', pack: { id: 'Sekantong isi 10 sachet × 2 g', en: 'Bag of 10 sachets × 2 g' },
    category: 'coffee', kind: 'bulk-sachet',
    price: 14300, portions: 10, plastic: { total: 1.4 + 3.6 },
    addons: ['sugar', 'creamer'], addonsIf: ['special-mix'],
  },
  {
    id: 'nescafe-classic-90', barcode: '8990000000073', brand: 'Nescafé', variant: 'classic',
    name: 'Nescafé Classic', pack: { id: 'Pouch 90 g', en: '90 g pouch' },
    category: 'coffee', kind: 'pouch',
    price: 56700, portions: 45, plastic: { total: 4.1 },
    addons: ['sugar', 'creamer'], addonsIf: ['special-mix'],
    portionHint: { id: '2 g kopi = 1 gelas, sama seperti 1 sachet.', en: '2 g coffee = 1 cup, same as 1 sachet.' },
  },

  // ── Flow 2: Detergent. Rinso renceng → bigger bags + zero-waste refill ──
  {
    id: 'rinso-renceng', barcode: '8990000000202', brand: 'Rinso', variant: 'anti-noda',
    name: 'Rinso Anti Noda', pack: { id: 'Renceng isi 6 sachet', en: 'Renceng of 6 sachets' },
    category: 'detergent', kind: 'renceng',
    price: 7500, portions: 6, plastic: { perPortion: 1 }, estimated: ALL,
  },
  {
    id: 'rinso-800', barcode: '8990000000219', brand: 'Rinso', variant: 'anti-noda',
    name: 'Rinso Anti Noda', pack: { id: 'Kantong 800 g', en: '800 g bag' },
    category: 'detergent', kind: 'bag',
    price: 22000, portions: 20, plastic: { total: 9 }, estimated: ALL,
  },
  {
    id: 'rinso-1400', barcode: '8990000000226', brand: 'Rinso', variant: 'anti-noda',
    name: 'Rinso Anti Noda', pack: { id: 'Kantong 1,4 kg', en: '1.4 kg bag' },
    category: 'detergent', kind: 'bag',
    price: 36000, portions: 35, plastic: { total: 12 }, estimated: ALL,
  },
  {
    id: 'detergent-refill', barcode: '', brand: 'Refill', name: { id: 'Isi ulang deterjen', en: 'Detergent refill' },
    pack: { id: 'Bawa wadah sendiri', en: 'Bring your own container' },
    category: 'detergent', kind: 'refill',
    price: 800, portions: 1, plastic: { total: 0 }, future: true, provider: REFILL_SHOP, estimated: ALL,
  },

  // ── Flow 3: Cereal. Koko Krunch cup → Koko Krunch 150 g pack ──
  // MEASURED (Aldiandya): cup Rp 9.900, 20 g cereal + Dancow milk (add 80 ml water), 14,5 g plastic.
  // 150 g pack Rp 25.100, 5,4 g plastic; 150 g ÷ 20 g = 7,5 cups' worth.
  {
    id: 'koko-cup', barcode: '8992696428263', brand: 'Nestlé', variant: 'koko-krunch',
    name: 'Koko Krunch', pack: { id: 'Cup 30 g (20 g sereal + susu Dancow)', en: 'Cup, 30 g (20 g cereal + Dancow milk)' },
    category: 'cereal', kind: 'cup',
    price: 9900, portions: 1, plastic: { total: 14.5 },
    note: { id: 'Tinggal tambah 80 ml air.', en: 'Just add 80 ml water.' },
  },
  {
    id: 'koko-pack-150', barcode: '4800361002851', brand: 'Nestlé', variant: 'koko-krunch',
    name: 'Koko Krunch', pack: { id: 'Kemasan 150 g', en: '150 g pack' },
    category: 'cereal', kind: 'box',
    price: 25100, portions: 7.5, plastic: { total: 5.4 }, addons: ['milk'],
    portionHint: {
      id: '20 g sereal + ±8 g susu bubuk + 80 ml air = 1 cup.',
      en: '20 g cereal + ≈8 g milk powder + 80 ml water = 1 cup.',
    },

  },

  // ── Flow 4: MILO. Bag of 18 sachets → 790 g pack ──
  // MEASURED (Aldiandya): sachet bag = 9,3 g outer bag + 18 × 1,9 g sachets; each sachet makes 170 ml.
  // 790 g pack = 11,6 g plastic. Label: 22 g per 150 ml (36 glasses). To match one sachet glass (170 ml),
  // use 25 g per 170 ml → 790 / 25 ≈ 31,6 glasses.
  {
    id: 'milo-bag18', barcode: '8992696524323', brand: 'MILO', variant: 'activ-go-3in1',
    name: 'MILO 3in1 Activ-Go', pack: { id: 'Sekantong isi 18 sachet', en: 'Bag of 18 sachets' },
    category: 'chocolate', kind: 'bulk-sachet',
    price: 72500, portions: 18, plastic: { total: 9.3 + 18 * 1.9 },
  },
  {
    id: 'milo-790', barcode: '8992696427990', brand: 'MILO', variant: 'tiga-keunggulan',
    name: 'MILO Tiga Keunggulan', pack: { id: 'Bubuk, kemasan 790 g', en: 'Powder, 790 g pack' },
    category: 'chocolate', kind: 'pouch',
    price: 84900, portions: 790 / 25, plastic: { total: 11.6 },
    note: {
      id: 'Sudah mengandung gula dan padatan susu, tinggal tambah air.',
      en: 'Already contains sugar and milk solids; just add water.',
    },
    portionHint: {
      id: '25 g bubuk + 170 ml air = 1 gelas, sama seperti 1 sachet.',
      en: '25 g powder + 170 ml water = 1 glass, same as 1 sachet.',
    },
  },

  // ── More products (not part of the three demo flows) ──

  // Instant seasoning: no big pack on the shelf, so the swap is cooking from basics.
  {
    // MEASURED plastic: 2 g per sachet, 20 g seasoning for 2–4 plates (Aldiandya). Price is an estimate.
    // No bigger pack at the minimarket.
    id: 'sajiku-nasgor-ayam', barcode: '8990000000400', brand: 'Sajiku', variant: 'nasi-goreng-ayam',
    name: 'Sajiku Nasi Goreng Rasa Ayam',
    pack: { id: '1 sachet 20 g, untuk 2–4 porsi', en: '1 sachet, 20 g, for 2–4 plates' }, category: 'spice', kind: 'sachet',
    price: 2000, portions: 1, plastic: { total: 2 }, estimated: ['price'], noBigPack: true,
  },
  {
    id: 'nasgor-homemade', barcode: '', brand: 'Racik sendiri', variant: 'nasi-goreng',
    name: { id: 'Bumbu nasi goreng racik sendiri', en: 'Homemade fried-rice seasoning' },
    pack: { id: 'Bawang, cabai, kecap pouch besar', en: 'Shallot, garlic, chilli, big kecap pouch' },
    category: 'spice', kind: 'homemade',
    price: 1800, portions: 1, plastic: { total: 0.2 }, estimated: ALL,
    note: {
      id: 'Bawang dan cabai dari pasar tanpa kantong plastik, kecap dari pouch besar. Belum ada kemasan besar untuk bumbu instan ini.',
      en: 'Shallots and chilli from the market without a plastic bag, kecap from a big pouch. There’s no big pack of this seasoning on the shelf yet.',
    },
  },

  // Floor cleaner
  {
    id: 'soklin-lantai-renceng', barcode: '8990000000501', brand: 'So Klin', variant: 'lantai',
    name: 'So Klin Lantai', pack: { id: 'Renceng isi 6 sachet', en: 'Renceng of 6 sachets' },
    category: 'floor', kind: 'renceng',
    price: 6000, portions: 6, plastic: { perPortion: 1 }, estimated: ALL,
  },
  {
    id: 'soklin-lantai-800', barcode: '8990000000518', brand: 'So Klin', variant: 'lantai',
    name: 'So Klin Lantai', pack: { id: 'Isi ulang 800 ml', en: '800 ml refill pouch' },
    category: 'floor', kind: 'pouch',
    price: 14000, portions: 20, plastic: { total: 10 }, estimated: ALL,
  },
  {
    // MEASURED plastic: 26 g (Aldiandya). Price and number of mops are still estimates.
    id: 'soklin-lantai-1400', barcode: '8990000000525', brand: 'So Klin', variant: 'lantai',
    name: 'So Klin Lantai', pack: { id: 'Isi ulang 1,4 kg', en: '1.4 kg refill pouch' },
    category: 'floor', kind: 'pouch',
    price: 22000, portions: 35, plastic: { total: 26 }, estimated: ['price', 'portions'],
  },
  {
    id: 'floor-refill', barcode: '', brand: 'Refill', name: { id: 'Isi ulang pembersih lantai', en: 'Floor cleaner refill' },
    pack: { id: 'Bawa jeriken sendiri', en: 'Bring your own jerry can' },
    category: 'floor', kind: 'refill',
    price: 500, portions: 1, plastic: { total: 0 }, future: true, provider: REFILL_SHOP, estimated: ALL,
  },

  // Ironing spray
  {
    id: 'kispray-renceng', barcode: '8990000000103', brand: 'Kispray', variant: 'kispray',
    name: 'Kispray', pack: { id: 'Renceng isi 12 sachet', en: 'Renceng of 12 sachets' },
    category: 'ironing', kind: 'renceng',
    price: 11000, portions: 3, plastic: { total: 12 }, estimated: ALL,
  },
  {
    id: 'kispray-pouch300', barcode: '8990000000110', brand: 'Kispray', variant: 'kispray',
    name: 'Kispray', pack: { id: 'Isi ulang 300 ml', en: '300 ml refill pouch' },
    category: 'ironing', kind: 'pouch',
    price: 9500, portions: 3, plastic: { total: 8 }, estimated: ALL,
  },
  {
    id: 'kispray-pouch800', barcode: '8990000000127', brand: 'Kispray', variant: 'kispray',
    name: 'Kispray', pack: { id: 'Isi ulang 800 ml', en: '800 ml refill pouch' },
    category: 'ironing', kind: 'pouch',
    price: 22500, portions: 8, plastic: { total: 14 }, estimated: ALL,
  },
  {
    id: 'ironing-refill', barcode: '', brand: 'Refill', name: { id: 'Isi ulang pelicin', en: 'Ironing spray refill' },
    pack: { id: 'Bawa botol sendiri', en: 'Bring your own bottle' },
    category: 'ironing', kind: 'refill',
    price: 2400, portions: 1, plastic: { total: 0 }, future: true, provider: REFILL_SHOP, estimated: ALL,
  },

  // Detergent, other brand
  {
    id: 'daia-1800', barcode: '8990000000233', brand: 'Daia', variant: 'daia',
    name: 'Daia', pack: { id: 'Kantong 1,8 kg', en: '1.8 kg bag' },
    category: 'detergent', kind: 'bag',
    price: 33000, portions: 45, plastic: { total: 13 }, estimated: ALL,
  },

  // Condensed milk
  {
    id: 'ff-renceng', barcode: '8990000000301', brand: 'Frisian Flag', variant: 'putih',
    name: 'Frisian Flag Kental Manis', pack: { id: 'Renceng isi 6 sachet', en: 'Renceng of 6 sachets' },
    category: 'milk', kind: 'renceng',
    price: 8500, portions: 6, plastic: { perPortion: 1 }, estimated: ALL,
  },
  {
    id: 'ff-pouch545', barcode: '8990000000318', brand: 'Frisian Flag', variant: 'putih',
    name: 'Frisian Flag Kental Manis', pack: { id: 'Pouch 545 g', en: '545 g pouch' },
    category: 'milk', kind: 'pouch',
    price: 14500, portions: 14.7, plastic: { total: 7 }, estimated: ALL,
  },
  {
    id: 'ff-can370', barcode: '8990000000325', brand: 'Frisian Flag', variant: 'putih',
    name: 'Frisian Flag Kental Manis', pack: { id: 'Kaleng 370 g', en: '370 g can' },
    category: 'milk', kind: 'can',
    price: 12500, portions: 10, plastic: { total: 0 }, estimated: ALL,
    note: { id: 'Kaleng besi, mudah didaur ulang.', en: 'Steel can, widely recycled.' },
  },
];

const SINGLE_USE: Kind[] = ['sachet', 'renceng', 'bulk-sachet', 'cup'];

export const products: Product[] = inputs.map(({ portions, plastic, ...rest }) => ({
  ...rest,
  servings: portions,
  plasticG: 'total' in plastic ? plastic.total : plastic.perPortion * portions,
  sachets: SINGLE_USE.includes(rest.kind) ? portions : 0,
}));

export const productById = new Map(products.map((p) => [p.id, p]));

export function findByBarcode(code: string): Product | undefined {
  const clean = code.replace(/\D/g, '');
  // Typing 12 digits (without the check digit) should still find the product.
  return products.find((p) => p.barcode && (p.barcode === clean || (clean.length === 12 && p.barcode.startsWith(clean))));
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
