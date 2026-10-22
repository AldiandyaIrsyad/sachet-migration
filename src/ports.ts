// The seam between the UI and wherever the logic and data live. The views only talk to `Backend`;
// src/compose.ts decides which implementation is plugged in:
//   ApiBackend    (src/adapters/api-backend.ts)  the Go server does the work and keeps each visitor's data.
//   LocalBackend  (src/demo/local-backend.ts)    the same logic in the browser, for the GitHub Pages demo.
import type { Addon, CategoryId, Product } from './data';

/** How a swap compares with the usual product, per serving. */
export interface Comparison {
  /** Relative change in cost per serving, e.g. -0.08 = 8% cheaper. */
  dCost: number;
  /** Relative change in plastic per serving. */
  dPlastic: number;
  /** Rupiah saved per serving (negative = costs more). */
  savePerServing: number;
  /** Grams of plastic avoided per serving. */
  plasticSavedPerServing: number;
  /**
   * Share of the new pack you could waste and still pay less per serving
   * than the usual product. 0 when the swap is not cheaper.
   */
  wasteTolerance: number;
}

export interface Savings {
  money: number;
  plastic: number;
  sachets: number;
}

/**
 * One product you use. `base` is what you used to buy; `to` is what you switched to.
 * `buys` counts how many packs of `to` you've bought since switching.
 */
export interface Migration {
  base: string;
  to?: string;
  buys: number;
  /** ISO date the base was added or the switch was made. */
  since: string;
}

export interface ProductList {
  items: Product[];
  /** Matches before the limit was applied. */
  total: number;
  /** Categories that have at least one listed product, whatever the filters. */
  categories: CategoryId[];
}

/** One alternative for a product, with the numbers the screen needs. */
export interface Swap {
  product: Product;
  comparison: Comparison;
  /** Cost and plastic per portion once the swap is made to match the usual product. */
  matched: { cost: number; plastic: number };
  /** Extras (sugar, milk…) to buy so the swap matches. */
  addons: Addon[];
  /** 0 same brand and variant, 1 same brand, 2 other. */
  closeness: 0 | 1 | 2;
  /** Single-use packs avoided by buying one pack of this instead of the same amount of the usual product. */
  sachetsKept: number;
  /** Already switched to this one. */
  current: boolean;
}

export type Warning =
  /** A bulk-sachet bag: costs about the same as the renceng and adds plastic. `ref` is that renceng, if any. */
  | { type: 'trap'; ref?: Product; n: number; money: number }
  /** A single sachet: a bulk pack of it would save money. */
  | { type: 'nudge'; bulk: Product; n: number; money: number };

export interface ProductPage {
  product: Product;
  /**
   * none: not yet; base: marked as yours; switched: you moved to `to`; target: you switched to this
   * product from another.
   */
  mine: { state: 'none' | 'base' | 'switched' | 'target'; to?: Product };
  /** Already asked for a bigger pack. */
  wanted: boolean;
  warning?: Warning;
  swaps: Swap[];
  /** All swaps, not just the ones returned. */
  totalSwaps: number;
  /** Candidates left out because they don't cut plastic. */
  hiddenCount: number;
  refills: Swap[];
}

export interface MigrationItem {
  migration: Migration;
  base: Product;
  to?: Product;
  savings?: Savings;
}

export interface MigrationsOverview {
  items: MigrationItem[];
  totals: Savings;
}

export interface SwitchResult {
  base: Product;
  to: Product;
  savings: Savings;
}

export interface Backend {
  /** Listed products: ranked hits when `q` is set, otherwise sorted by brand and name. */
  list(query: { q?: string; category?: CategoryId; limit: number }): Promise<ProductList>;
  barcode(code: string): Promise<Product | null>;
  productPage(id: string, swaps: number): Promise<ProductPage | null>;
  /** Zero-waste refill previews. */
  refills(): Promise<Product[]>;
  /** What switching from `base` to `to` saves over `packs` packs. */
  compare(base: string, to: string, packs: number): Promise<SwitchResult | null>;

  migrations(): Promise<MigrationsOverview>;
  /** Mark a product as one you use. */
  addBase(base: string): Promise<void>;
  /** Switch from `base` to `to`; counts as the first purchase of `to`. */
  migrate(base: string, to: string): Promise<SwitchResult>;
  buyAgain(base: string): Promise<void>;
  remove(base: string): Promise<void>;
  /** Forget every switch. */
  reset(): Promise<void>;
  /** Ask for a bigger pack of this product. */
  wantBigPack(id: string): Promise<void>;
}

/** Optional extras the host can switch on. All absent in a normal deployment. */
export interface Features {
  /** Shows an "interactive demo, not a real deployment" notice. */
  demoBanner?: boolean;
  /** Barcode behind the "try an example" button. */
  exampleBarcode?: string;
  /** Offers the skippable guided walkthrough. */
  tour?: boolean;
}
