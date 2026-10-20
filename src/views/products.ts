import { byCategory, categories, isListed, products, search, type CategoryId, type Product } from '../data';
import { costPer } from '../calc';
import { t, tx } from '../i18n';
import { packIcon } from '../icons';
import { esc, name, pack, rp, star, unit } from '../ui';

// Marketplace-style product browser: search, category row, 2-column grid.
// Lists are shown a page at a time so the page stays short however big the catalogue is.
const PAGE = 20;

let cat: CategoryId | 'all' = 'all';
let query = '';
let limit = PAGE;

/** Applies `?c=coffee&q=abc` from the hash, if present. */
export function applyParams(params: URLSearchParams) {
  const c = params.get('c');
  cat = c && c in categories ? (c as CategoryId) : 'all';
  query = params.get('q') ?? '';
  limit = PAGE;
}

export function setCategory(c: CategoryId | 'all') {
  cat = c;
  limit = PAGE;
}
export function setQuery(q: string) {
  query = q.trim();
  limit = PAGE;
}
export const showMoreProducts = () => {
  limit += PAGE;
};

function matching(): Product[] {
  const pool = query ? search(query, Number.MAX_SAFE_INTEGER).hits : products.filter(isListed);
  const inCat = cat === 'all' ? pool : pool.filter((p) => p.category === cat);
  return query
    ? inCat // already ranked by relevance
    : [...inCat].sort((a, b) => a.brand.localeCompare(b.brand) || tx(a.name).localeCompare(tx(b.name)));
}

function card(p: Product): string {
  return `<a class="pcard" href="#/p/${p.id}">
    ${packIcon(p.kind, 56)}
    <b>${name(p)}</b>
    <small>${pack(p)}</small>
    <span class="pcard-price">${rp(costPer(p))}${star(['price', 'portions'], p)}<small> ${t('per', { unit: unit(p.category) })}</small></span>
  </a>`;
}

/** The results block only, so typing in the search box doesn't rebuild (and unfocus) the page. */
export function productListHtml(): string {
  const items = matching();
  const shown = items.slice(0, limit);
  return `
    <p class="hint">${t('resultsCount', { n: items.length })}</p>
    ${shown.length ? `<div class="pgrid">${shown.map(card).join('')}</div>` : `<p class="hint">${t('notFound')}</p>`}
    ${items.length > shown.length ? `<button class="btn more" type="button" data-more-products>${t('showMore', { n: items.length - shown.length })}</button>` : ''}`;
}

export function productsView(): string {
  const chip = (id: CategoryId | 'all', label: string) =>
    `<button type="button" class="chip" data-pcat="${id}" aria-pressed="${id === cat}">${label}</button>`;
  const chips = [
    chip('all', t('allCategories')),
    ...(Object.keys(categories) as CategoryId[])
      .filter((c) => (byCategory.get(c) ?? []).some(isListed))
      .map((c) => chip(c, tx(categories[c].label))),
  ].join('');

  return `
    <div class="pfilter">
      <label class="visually-hidden" for="psearch">${t('searchLabel')}</label>
      <input id="psearch" class="search" type="search" placeholder="${t('productsPh')}" value="${esc(query)}" autocomplete="off">
      <div class="chips scroll" role="group">${chips}</div>
    </div>
    <p class="hint">${t('estimateLegend')}</p>
    <div id="plist">${productListHtml()}</div>`;
}
