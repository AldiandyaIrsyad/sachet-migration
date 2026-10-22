import { beforeAll, describe, expect, it } from 'vitest';
import { alternatives, compare, switchSavings, totals } from '../src/demo/calc';
import type { ProductInput } from '../src/data';
import { findByBarcode, loadCatalog, productById, search } from '../src/demo/catalog';

const base = { category: 'coffee', brand: 'B', pack: { id: 'p', en: 'p' } } as const;
const input = (p: Partial<ProductInput> & Pick<ProductInput, 'id' | 'price' | 'portions' | 'plastic' | 'kind'>): ProductInput => ({
  barcode: '',
  name: p.id,
  ...base,
  ...p,
});

const catalogue: ProductInput[] = [
  input({ id: 'single', kind: 'sachet', price: 2000, portions: 1, plastic: { total: 1 }, barcode: '1234567890128', variant: 'mix' }),
  input({ id: 'jar', kind: 'jar', price: 30000, portions: 20, plastic: { total: 10 }, addons: ['sugar'] }),
  input({ id: 'refill', kind: 'refill', price: 500, portions: 1, plastic: { total: 0 } }),
  input({ id: 'worse', kind: 'bag', price: 90000, portions: 10, plastic: { total: 50 } }),
];

beforeAll(async () => {
  loadCatalog(catalogue);
});

const p = (id: string) => productById.get(id)!;

describe('compare', () => {
  it('includes add-ons in the swap cost', () => {
    const c = compare(p('single'), p('jar'));
    // 30000/20 = 1500, plus 180 sugar = 1680 vs 2000
    expect(c.savePerServing).toBeCloseTo(320);
    expect(c.wasteTolerance).toBeCloseTo(1 - 1680 / 2000);
  });

  it('reports no waste tolerance when the swap costs more', () => {
    expect(compare(p('single'), p('worse')).wasteTolerance).toBe(0);
  });
});

describe('alternatives', () => {
  it('lists only lower-plastic packs and excludes refills', () => {
    const { shown, hiddenCount } = alternatives(p('single'));
    expect(shown.map((x) => x.id)).toEqual(['jar']);
    expect(hiddenCount).toBe(1); // 'worse' has more plastic per serving
  });
});

describe('savings', () => {
  it('scales per-serving savings by packs bought', () => {
    const s = switchSavings(p('single'), p('jar'), 2);
    expect(s.money).toBeCloseTo(40 * 320);
    expect(s.plastic).toBeCloseTo(40 * (1 - 0.5 - 0.08));
    expect(s.sachets).toBe(40);
  });

  it('ignores migrations whose products are gone', () => {
    const t = totals([{ base: 'single', to: 'missing', buys: 3 }]);
    expect(t).toEqual({ money: 0, plastic: 0, sachets: 0 });
  });
});

describe('lookup', () => {
  it('finds a barcode typed with or without the check digit', () => {
    expect(findByBarcode('1234567890128')?.id).toBe('single');
    expect(findByBarcode('123456789012')?.id).toBe('single');
    expect(findByBarcode('000')).toBeUndefined();
  });

  it('searches by variant', () => {
    expect(search('mix', 5).hits.map((x) => x.id)).toEqual(['single']);
  });
});
