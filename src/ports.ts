// The seams between the UI and wherever data lives. The app only talks to these interfaces;
// src/compose.ts decides which implementations to plug in (browser-only demo today, a real backend later).
import type { ProductInput } from './data';

/** Where the product catalogue comes from. */
export interface CatalogSource {
  load(): Promise<ProductInput[]>;
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

/** Where a person's switches are kept. */
export interface MigrationStore {
  list(): Migration[];
  addBase(base: string): void;
  migrate(base: string, to: string): Migration;
  buyAgain(base: string): void;
  remove(base: string): void;
  clear(): void;
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
