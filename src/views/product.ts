import { alternatives, appliedAddons, bulkSachetIn, closeness, compare, costPer, matchedPer, plasticPer, refillsFor, sachetsPer } from '../calc';
import { categories, isSachetKind, kindLabel, productById, products, type Product } from '../data';
import { t, tx } from '../i18n';
import { packIcon } from '../icons';
import { getMigration, migrationTo } from '../store';
import { count, dec1, esc, grams, name, pack, pct, rp, star, unit } from '../ui';

// ---------- product ----------

/** "renceng", "sachet", "cup sekali pakai": what you call one pack of this product. */
const packNoun = (p: Product) => tx(kindLabel[p.kind]).toLowerCase();

/** What the usual product would take to make `portions`: "31,6 sachet", "7,5 cup", "5,8 renceng". */
function usualAmount(usual: Product, portions: number): string {
  if (usual.sachets > 0) {
    const noun = usual.kind === 'cup' ? 'cup' : 'sachet';
    return `${dec1(portions * sachetsPer(usual))} ${noun}`;
  }
  return `${dec1(portions / usual.servings)} ${packNoun(usual)}`;
}

/** Your status with this product: add it as yours, or see what you switched to. */
function mineBlock(p: Product): string {
  const m = getMigration(p.id);
  const switchedHere = migrationTo(p.id);
  if (switchedHere) return `<p class="mine done">${t('newMine')}</p>`;
  if (!m) {
    return `<button class="btn mine-btn" type="button" data-mine="${p.id}">${t('mine')}</button>`;
  }
  const to = m.to ? productById.get(m.to) : undefined;
  return to
    ? `<a class="callout mine-switched" href="#/migrasi">${t('alreadySwitched', { name: `${name(to)}, ${pack(to)}` })}</a>`
    : `<p class="mine done">${t('mineDone')}</p>`;
}

const SWAP_PAGE = 5;
let swapLimit = SWAP_PAGE;
let swapFor = '';
export const showMoreSwaps = () => {
  swapLimit += SWAP_PAGE;
};

export function productView(p: Product): string {
  const c = p.category;
  const { shown: allSwaps, hiddenCount } = alternatives(p);
  if (swapFor !== p.id) {
    swapFor = p.id;
    swapLimit = SWAP_PAGE;
  }
  const shown = allSwaps.slice(0, swapLimit);
  const refills = p.kind === 'refill' ? [] : refillsFor(p);
  const bulk = bulkSachetIn(p);

  let warning = '';
  if (p.kind === 'bulk-sachet') {
    const ref = products
      .filter((x) => x.brand === p.brand && x.variant === p.variant && x.kind === 'renceng')
      .sort((a, b) => costPer(a) - costPer(b))[0];
    warning = ref
      ? `<div class="callout bad">${t('trap', {
          n: dec1(p.servings / ref.servings),
          ref: packNoun(ref),
          money: rp(compare(ref, p).savePerServing * p.servings),
        })}</div>`
      : `<div class="callout bad">${t('trapGeneric', { n: p.sachets, g: grams(p.plasticG) })}</div>`;
  } else if (isSachetKind(p.kind) && bulk) {
    warning = `<div class="callout">${t('bulkNudge', {
      bulk: esc(tx(bulk.pack).toLowerCase()),
      n: dec1(bulk.servings / p.servings),
      pack: packNoun(p),
      money: rp(compare(p, bulk).savePerServing * bulk.servings),
    })}</div>`;
  }

  const swaps = shown.length
    ? shown.map((alt) => swapCard(p, alt)).join('')
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
      <span class="sl-price">${rp(costPer(p))}${star(['price', 'portions'], p)}</span>
      <span class="sl-unit">${t('per', { unit: unit(c) })}</span>
    </div>

    ${mineBlock(p)}
    ${warning}
    ${p.noBigPack ? demandCard(p) : ''}

    <h2>${t('swaps')}</h2>
    <div class="swaps">${swaps}</div>
    ${allSwaps.length > shown.length ? `<button class="btn more" type="button" data-more-swaps>${t('showMore', { n: allSwaps.length - shown.length })}</button>` : ''}
    ${hiddenCount ? `<p class="hint">${t('hidden', { n: hiddenCount })}</p>` : ''}
    ${refills.length ? `<h2>${t('refillTitle')}</h2><div class="swaps">${refills.map((r) => refillCard(p, r)).join('')}</div>` : ''}
    ${[p, ...shown, ...refills].some((x) => x.estimated?.length) ? `<p class="footnote"><sup class="est">*</sup> ${t('estimateNote')}</p>` : ''}`;
}

// Requests for a bigger pack, kept on this phone. In the full version they'd feed the community database.
export const WANT_KEY = 'sachet-migration:want-big';
export function wanted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WANT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function demandCard(p: Product): string {
  const done = wanted().includes(p.id);
  return `<div class="callout demand">
    <p>${t('noBigPack')}</p>
    <button class="btn" type="button" data-want="${p.id}"${done ? ' disabled' : ''}>${done ? t('wantBigDone') : t('wantBig')}</button>
  </div>`;
}

/**
 * Two tiles for the whole purchase: money saved and plastic cut when you buy `portions`
 * of the alternative instead of the same amount of your usual product. Per-portion figures sit underneath.
 */
function impactTiles(usual: Product, alt: Product, portions: number): string {
  const cmp = compare(usual, alt);
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

function refillCard(usual: Product, r: Product): string {
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
    ${impactTiles(usual, r, usual.servings)}
    <p class="same-amount">${t('zeroTrash')}.</p>
  </article>`;
}

function swapCard(usual: Product, alt: Product): string {
  const c = usual.category;
  const cmp = compare(usual, alt);
  const packsKept = (sachetsPer(usual) - sachetsPer(alt)) * alt.servings;
  const near = closeness(usual, alt);
  const badge = `<span class="badge${near === 0 ? ' same' : ''}">${
    near === 0 ? t('sameVariant') : near === 1 ? t('sameBrand') : t('otherBrand')
  }</span>`;
  const isCurrent = getMigration(usual.id)?.to === alt.id;
  const addonList = appliedAddons(usual, alt).map((a) => tx(a.name)).join(', ');

  return `<article class="swap${isCurrent ? ' is-current' : ''}">
    <div class="swap-head">
      ${packIcon(alt.kind, 52)}
      <div class="swap-title">
        ${badge}
        <h3>${name(alt)}</h3>
        <p class="pack">${pack(alt)} · ${rp(alt.price)}${star(['price'], alt)}</p>
      </div>
    </div>
    ${buyIntro(usual, alt.servings)}
    ${impactTiles(usual, alt, alt.servings)}
    ${packsKept >= 1 ? `<p class="same-amount">${t('sachetsKept', { n: count(packsKept) })}.</p>` : ''}
    ${portionHint(alt)}
    ${addonList ? `<p class="note">${t('addonIncluded', { list: esc(addonList) })}</p>` : ''}
    ${alt.note ? `<p class="note">${esc(tx(alt.note))}</p>` : ''}
    <details class="math">
      <summary>${t('showMath')}</summary>
      <dl>
        <dt>${t('mPrice', { unit: unit(c) })}</dt><dd>${rp(matchedPer(usual, alt).cost)} <small>${t('mVs', { name: rp(costPer(usual)) })}</small></dd>
        <dt>${t('mPlastic', { unit: unit(c) })}</dt><dd>${grams(matchedPer(usual, alt).plastic)} <small>${t('mVs', { name: grams(plasticPer(usual)) })}</small></dd>
        <dt>${cmp.dCost <= 0 ? t('mCheaper') : t('mPricier')}</dt><dd>${pct(cmp.dCost)}</dd>
        <dt>${t('mLessPlastic')}</dt><dd>${pct(cmp.dPlastic)}</dd>
        ${cmp.wasteTolerance >= 0.01 ? `<dt class="full">${t('mWaste', { pct: pct(cmp.wasteTolerance) })}</dt>` : ''}
      </dl>
    </details>
    ${
      isCurrent
        ? `<button class="btn" type="button" disabled>${t('newMine')}</button>`
        : `<button class="btn primary" type="button" data-migrate="${alt.id}" data-base="${usual.id}">${t('migrate')}</button>`
    }
  </article>`;
}
