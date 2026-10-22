import { backend } from '../backend';
import { categories, type CategoryId, type Product } from '../data';
import { t, tx } from '../i18n';
import { packIcon } from '../icons';
import type { ProductList } from '../ports';
import { esc, name, pack, rp, star, unit } from '../ui';

// Marketplace-style product browser: search, category row, 2-column grid.
// Lists are shown a page at a time so the page stays short however big the catalogue gets.
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

const load = () => backend().list({ q: query, category: cat === 'all' ? undefined : cat, limit });

function card(p: Product): string {
  return `<a class="pcard" href="#/p/${p.id}">
    ${packIcon(p.kind, 56)}
    <b>${name(p)}</b>
    <small>${pack(p)}</small>
    <span class="pcard-price">${rp(p.costPer)}${star(['price', 'portions'], p)}<small> ${t('per', { unit: unit(p.category) })}</small></span>
  </a>`;
}

function listHtml({ items, total }: ProductList): string {
  return `
    <p class="hint">${t('resultsCount', { n: total })}</p>
    ${items.length ? `<div class="pgrid">${items.map(card).join('')}</div>` : `<p class="hint">${t('notFound')}</p>`}
    ${total > items.length ? `<button class="btn more" type="button" data-more-products>${t('showMore', { n: total - items.length })}</button>` : ''}`;
}

/** The results block only, so typing in the search box doesn't rebuild (and unfocus) the page. */
export async function productListHtml(): Promise<string> {
  return listHtml(await load());
}

export async function productsView(): Promise<string> {
  const result = await load();
  const chip = (id: CategoryId | 'all', label: string) =>
    `<button type="button" class="chip" data-pcat="${id}" aria-pressed="${id === cat}">${label}</button>`;
  const chips = [
    chip('all', t('allCategories')),
    ...(Object.keys(categories) as CategoryId[])
      .filter((c) => result.categories.includes(c))
      .map((c) => chip(c, tx(categories[c].label))),
  ].join('');

  return `
    <div class="pfilter">
      <label class="visually-hidden" for="psearch">${t('searchLabel')}</label>
      <input id="psearch" class="search" type="search" placeholder="${t('productsPh')}" value="${esc(query)}" autocomplete="off">
      <div class="chips scroll" role="group">${chips}</div>
    </div>
    <p class="hint">${t('estimateLegend')}</p>
    <div id="plist">${listHtml(result)}</div>`;
}
