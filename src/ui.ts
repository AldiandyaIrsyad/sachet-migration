import { costPer } from './calc';
import { categories, type CategoryId, type Estimate, type Product } from './data';
import { getLang, t, tx } from './i18n';
import { packIcon } from './icons';

// Formatting and small fragments shared by every view.

export const rp = (n: number) => `${n < 0 ? '−' : ''}Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;

export function grams(g: number): string {
  const a = Math.abs(g);
  const locale = getLang() === 'id' ? 'id-ID' : 'en-GB';
  if (a >= 1000) return `${(a / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} kg`;
  if (a < 100) return `${a.toLocaleString(locale, { maximumFractionDigits: 1 })} g`;
  return `${Math.round(a)} g`;
}

export const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
export const count = (n: number) => Math.round(n).toLocaleString('id-ID');
export const dec1 = (n: number) => n.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 });

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const unit = (c: CategoryId) => tx(categories[c].unit);

/** "*" when any of these numbers is a guess rather than measured. */
export const star = (fields: Estimate[], ...ps: Product[]) =>
  ps.some((p) => p.estimated?.some((f) => fields.includes(f))) ? '<sup class="est">*</sup>' : '';
export const name = (p: Product) => esc(tx(p.name));
export const pack = (p: Product) => esc(tx(p.pack));

export function productRow(p: Product) {
  return `<a class="row" href="#/p/${p.id}">
    ${packIcon(p.kind)}
    <span class="row-main"><b>${name(p)}</b><small>${pack(p)}</small></span>
    <span class="row-val">${rp(costPer(p))}${star(['price', 'portions'], p)}<small>${t('per', { unit: unit(p.category) })}</small></span>
  </a>`;
}
