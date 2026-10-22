import { backend } from '../backend';
import { categories, isSachetKind, kindLabel, type Product } from '../data';
import { t, tx } from '../i18n';
import { packIcon } from '../icons';
import type { ProductPage, Swap, Warning } from '../ports';
import { count, dec1, esc, grams, name, pack, pct, rp, star, unit } from '../ui';

// ---------- product ----------

/** "renceng", "sachet", "cup sekali pakai": what you call one pack of this product. */
const packNoun = (p: Product) => tx(kindLabel[p.kind]).toLowerCase();

/** What the usual product would take to make `portions`: "31,6 sachet", "7,5 cup", "5,8 renceng". */
function usualAmount(usual: Product, portions: number): string {
  if (usual.sachets > 0) {
    const noun = usual.kind === 'cup' ? 'cup' : 'sachet';
    return `${dec1((portions * usual.sachets) / usual.servings)} ${noun}`;
  }
  return `${dec1(portions / usual.servings)} ${packNoun(usual)}`;
}

/** Your status with this product: add it as yours, or see what you switched to. */
function mineBlock(page: ProductPage): string {
  const { product: p, mine } = page;
  if (mine.state === 'target') return `<p class="mine done">${t('newMine')}</p>`;
  if (mine.state === 'none') {
    return `<button class="btn mine-btn" type="button" data-mine="${p.id}">${t('mine')}</button>`;
  }
  return mine.state === 'switched' && mine.to
    ? `<a class="callout mine-switched" href="#/migrasi">${t('alreadySwitched', { name: `${name(mine.to)}, ${pack(mine.to)}` })}</a>`
    : `<p class="mine done">${t('mineDone')}</p>`;
}

function warningBlock(p: Product, w: Warning | undefined): string {
  if (!w) return '';
  if (w.type === 'trap') {
    return w.ref
      ? `<div class="callout bad">${t('trap', { n: dec1(w.n), ref: packNoun(w.ref), money: rp(w.money) })}</div>`
      : `<div class="callout bad">${t('trapGeneric', { n: p.sachets, g: grams(p.plasticG) })}</div>`;
  }
  return `<div class="callout">${t('bulkNudge', {
    bulk: esc(tx(w.bulk.pack).toLowerCase()),
    n: dec1(w.n),
    pack: packNoun(p),
    money: rp(w.money),
  })}</div>`;
}

const SWAP_PAGE = 5;
let swapLimit = SWAP_PAGE;
let swapFor = '';
export const showMoreSwaps = () => {
  swapLimit += SWAP_PAGE;
};

/** The product screen, or null when there is no such product. */
export async function productView(id: string): Promise<string | null> {
  if (swapFor !== id) {
    swapFor = id;
    swapLimit = SWAP_PAGE;
  }
  const page = await backend().productPage(id, swapLimit);
  if (!page) return null;
  const { product: p, swaps: shown, refills } = page;

  const swaps = shown.length
    ? shown.map((s) => swapCard(p, s)).join('')
    : `<p class="hint">${t('noSwaps')}</p>`;

  return `
    <a class="back" href="#/" data-back>${t('back')}</a>
    <header class="product-head">
      ${packIcon(p.kind, 64)}
      <div>
        <span class="kind ${isSachetKind(p.kind) ? 'bad' : 'good'}">${tx(kindLabel[p.kind])}</span>
        <h1>${name(p)}</h1>
        <p class="pack">${pack(p)} · ${rp(p.price)}${star(['price'], p)}</p>
      </div>
    </header>

    <div class="shelf-label">
      <span class="sl-price">${rp(p.costPer)}${star(['price', 'portions'], p)}</span>
      <span class="sl-unit">${t('per', { unit: unit(p.category) })}</span>
    </div>

    ${mineBlock(page)}
    ${warningBlock(p, page.warning)}
    ${p.noBigPack ? demandCard(page) : ''}

    <h2>${t('swaps')}</h2>
    <div class="swaps">${swaps}</div>
    ${page.totalSwaps > shown.length ? `<button class="btn more" type="button" data-more-swaps>${t('showMore', { n: page.totalSwaps - shown.length })}</button>` : ''}
    ${page.hiddenCount ? `<p class="hint">${t('hidden', { n: page.hiddenCount })}</p>` : ''}
    ${refills.length ? `<h2>${t('refillTitle')}</h2><div class="swaps">${refills.map((r) => refillCard(p, r)).join('')}</div>` : ''}
    ${[p, ...shown.map((s) => s.product), ...refills.map((s) => s.product)].some((x) => x.estimated?.length) ? `<p class="footnote"><sup class="est">*</sup> ${t('estimateNote')}</p>` : ''}`;
}

function demandCard({ product: p, wanted }: ProductPage): string {
  return `<div class="callout demand">
    <p>${t('noBigPack')}</p>
    <button class="btn" type="button" data-want="${p.id}"${wanted ? ' disabled' : ''}>${wanted ? t('wantBigDone') : t('wantBig')}</button>
  </div>`;
}

/**
 * Two tiles for the whole purchase: money saved and plastic cut when you buy `portions`
 * of the alternative instead of the same amount of your usual product. Per-portion figures sit underneath.
 */
function impactTiles(usual: Product, { product: alt, comparison: cmp }: Swap, portions: number): string {
  const u = unit(usual.category);
  const money = cmp.savePerServing * portions;
  const plastic = cmp.plasticSavedPerServing * portions;
  const cheaper = money >= 0;
  return `<div class="tiles">
    <div class="tile ${cheaper ? 'good' : 'warn'}">
      <small>${cheaper ? t('totalSave') : t('totalCost')}</small>
      <b>${rp(Math.abs(money))}${star(['price', 'portions'], usual, alt)}</b>
      <span>${t('perUnit', { value: rp(Math.abs(cmp.savePerServing)), unit: u })}</span>
    </div>
    <div class="tile good">
      <small>${t('totalPlastic')}</small>
      <b>${grams(plastic)}${star(['plastic', 'portions'], usual, alt)}</b>
      <span>${t('perUnit', { value: grams(cmp.plasticSavedPerServing), unit: u })}</span>
    </div>
  </div>`;
}

/** "Buying this (31,6 glasses) instead of 31,6 sachets:" */
function buyIntro(usual: Product, portions: number) {
  const c = usual.category;
  return `<p class="buy-intro">${t('buyIntro', {
    portions: dec1(portions),
    unit: unit(c),
    units: categories[c].unitPluralEn,
    usual: usualAmount(usual, portions),
  })}</p>`;
}

function portionHint(p: Product) {
  return p.portionHint ? `<p class="portion"><b>${t('portionLabel')}</b> ${esc(tx(p.portionHint))}</p>` : '';
}

function refillCard(usual: Product, swap: Swap): string {
  const r = swap.product;
  // A refill has no pack size, so compare with one pack of the usual product.
  return `<article class="swap is-future">
    <div class="swap-head">
      ${packIcon('refill', 52)}
      <div class="swap-title">
        <span class="badge future">${t('comingLater')}</span>
        <h3>${name(r)}</h3>
        <p class="pack">${r.provider ? t('refillAt', { place: esc(tx(r.provider)) }) : ''} · ${pack(r)}</p>
      </div>
    </div>
    ${buyIntro(usual, usual.servings)}
    ${impactTiles(usual, swap, usual.servings)}
    <p class="same-amount">${t('zeroTrash')}.</p>
  </article>`;
}

function swapCard(usual: Product, swap: Swap): string {
  const { product: alt, comparison: cmp, matched, closeness: near } = swap;
  const c = usual.category;
  const badge = `<span class="badge${near === 0 ? ' same' : ''}">${
    near === 0 ? t('sameVariant') : near === 1 ? t('sameBrand') : t('otherBrand')
  }</span>`;
  const addonList = swap.addons.map((a) => tx(a.name)).join(', ');

  return `<article class="swap${swap.current ? ' is-current' : ''}">
    <div class="swap-head">
      ${packIcon(alt.kind, 52)}
      <div class="swap-title">
        ${badge}
        <h3>${name(alt)}</h3>
        <p class="pack">${pack(alt)} · ${rp(alt.price)}${star(['price'], alt)}</p>
      </div>
    </div>
    ${buyIntro(usual, alt.servings)}
    ${impactTiles(usual, swap, alt.servings)}
    ${swap.sachetsKept >= 1 ? `<p class="same-amount">${t('sachetsKept', { n: count(swap.sachetsKept) })}.</p>` : ''}
    ${portionHint(alt)}
    ${addonList ? `<p class="note">${t('addonIncluded', { list: esc(addonList) })}</p>` : ''}
    ${alt.note ? `<p class="note">${esc(tx(alt.note))}</p>` : ''}
    <details class="math">
      <summary>${t('showMath')}</summary>
      <dl>
        <dt>${t('mPrice', { unit: unit(c) })}</dt><dd>${rp(matched.cost)} <small>${t('mVs', { name: rp(usual.costPer) })}</small></dd>
        <dt>${t('mPlastic', { unit: unit(c) })}</dt><dd>${grams(matched.plastic)} <small>${t('mVs', { name: grams(usual.plasticPer) })}</small></dd>
        <dt>${cmp.dCost <= 0 ? t('mCheaper') : t('mPricier')}</dt><dd>${pct(cmp.dCost)}</dd>
        <dt>${t('mLessPlastic')}</dt><dd>${pct(cmp.dPlastic)}</dd>
        ${cmp.wasteTolerance >= 0.01 ? `<dt class="full">${t('mWaste', { pct: pct(cmp.wasteTolerance) })}</dt>` : ''}
      </dl>
    </details>
    ${
      swap.current
        ? `<button class="btn" type="button" disabled>${t('newMine')}</button>`
        : `<button class="btn primary" type="button" data-migrate="${alt.id}" data-base="${usual.id}">${t('migrate')}</button>`
    }
  </article>`;
}
