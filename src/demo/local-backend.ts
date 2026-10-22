import { categories, isListed, isSachetKind, type CategoryId, type Product, type ProductInput } from '../data';
import { getLang, tx } from '../i18n';
import type {
  Backend,
  MigrationItem,
  MigrationsOverview,
  ProductPage,
  Savings,
  Swap,
  SwitchResult,
  Warning,
} from '../ports';
import {
  alternatives,
  appliedAddons,
  bulkSachetIn,
  closeness,
  compare,
  matchedPer,
  refillsFor,
  sachetsPer,
  switchSavings,
} from './calc';
import { byCategory, findByBarcode, loadCatalog, productById, products, search } from './catalog';
import type { LocalMigrationStore } from './local-store';

/** Reads the JSON files shipped with the site (relative to the site base). */
async function fetchCatalog(files: string[]): Promise<ProductInput[]> {
  const lists = await Promise.all(
    files.map(async (file) => {
      const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      return (await res.json()) as ProductInput[];
    }),
  );
  return lists.flat();
}

/**
 * The whole backend running in the browser, for the GitHub Pages demo: the same maths as the Go server,
 * with each visitor's switches kept in localStorage. Nothing here talks to a server.
 */
export class LocalBackend implements Backend {
  private constructor(private readonly store: LocalMigrationStore) {}

  static async create(store: LocalMigrationStore, files: string[]): Promise<LocalBackend> {
    loadCatalog(await fetchCatalog(files));
    return new LocalBackend(store);
  }

  async list({ q, category, limit }: { q?: string; category?: CategoryId; limit: number }) {
    const query = (q ?? '').trim();
    const pool = query
      ? search(query, Number.MAX_SAFE_INTEGER).hits
      : products
          .filter(isListed)
          .sort((a, b) => a.brand.localeCompare(b.brand) || tx(a.name).localeCompare(tx(b.name), getLang()));
    const matching = category ? pool.filter((p) => p.category === category) : pool;
    return {
      items: matching.slice(0, limit),
      total: matching.length,
      categories: (Object.keys(categories) as CategoryId[]).filter((c) => (byCategory.get(c) ?? []).some(isListed)),
    };
  }

  async barcode(code: string) {
    return findByBarcode(code) ?? null;
  }

  private swap(usual: Product, alt: Product, currentTo: string | undefined): Swap {
    return {
      product: alt,
      comparison: compare(usual, alt),
      matched: matchedPer(usual, alt),
      addons: appliedAddons(usual, alt),
      closeness: closeness(usual, alt),
      sachetsKept: (sachetsPer(usual) - sachetsPer(alt)) * alt.servings,
      current: currentTo === alt.id,
    };
  }

  async productPage(id: string, swaps: number): Promise<ProductPage | null> {
    const p = productById.get(id);
    if (!p) return null;
    const migs = this.store.list();
    const mine: ProductPage['mine'] = { state: 'none' };
    let currentTo: string | undefined;
    for (const m of migs) {
      if (m.to === p.id) mine.state = 'target';
      if (m.base === p.id) {
        currentTo = m.to;
        if (mine.state !== 'target') {
          const to = m.to ? productById.get(m.to) : undefined;
          mine.state = to ? 'switched' : 'base';
          mine.to = to;
        }
      }
    }

    let warning: Warning | undefined;
    const bulk = bulkSachetIn(p);
    if (p.kind === 'bulk-sachet') {
      const ref = products
        .filter((x) => x.brand === p.brand && x.variant === p.variant && x.kind === 'renceng')
        .sort((a, b) => a.costPer - b.costPer)[0];
      warning = ref
        ? { type: 'trap', ref, n: p.servings / ref.servings, money: compare(ref, p).savePerServing * p.servings }
        : { type: 'trap', n: 0, money: 0 };
    } else if (isSachetKind(p.kind) && bulk) {
      warning = { type: 'nudge', bulk, n: bulk.servings / p.servings, money: compare(p, bulk).savePerServing * bulk.servings };
    }

    const { shown, hiddenCount } = alternatives(p);
    return {
      product: p,
      mine,
      wanted: this.store.wanted().includes(p.id),
      warning,
      swaps: shown.slice(0, swaps).map((alt) => this.swap(p, alt, currentTo)),
      totalSwaps: shown.length,
      hiddenCount,
      refills: p.kind === 'refill' ? [] : refillsFor(p).map((r) => this.swap(p, r, currentTo)),
    };
  }

  async refills() {
    return products.filter((p) => p.future);
  }

  async compare(base: string, to: string, packs: number): Promise<SwitchResult | null> {
    const b = productById.get(base);
    const t = productById.get(to);
    return b && t ? { base: b, to: t, savings: switchSavings(b, t, packs) } : null;
  }

  async migrations(): Promise<MigrationsOverview> {
    const items: MigrationItem[] = [];
    const totals: Savings = { money: 0, plastic: 0, sachets: 0 };
    for (const migration of this.store.list()) {
      const base = productById.get(migration.base);
      if (!base) continue;
      const to = migration.to ? productById.get(migration.to) : undefined;
      const savings = to ? switchSavings(base, to, migration.buys) : undefined;
      if (savings) {
        totals.money += savings.money;
        totals.plastic += savings.plastic;
        totals.sachets += savings.sachets;
      }
      items.push({ migration, base, to, savings });
    }
    return { items, totals };
  }

  async addBase(base: string) {
    this.store.addBase(base);
  }

  async migrate(base: string, to: string): Promise<SwitchResult> {
    const b = productById.get(base)!;
    const t = productById.get(to)!;
    this.store.migrate(base, to);
    return { base: b, to: t, savings: switchSavings(b, t, 1) };
  }

  async buyAgain(base: string) {
    this.store.buyAgain(base);
  }

  async remove(base: string) {
    this.store.remove(base);
  }

  async reset() {
    this.store.clear();
  }

  async wantBigPack(id: string) {
    this.store.want(id);
  }
}
