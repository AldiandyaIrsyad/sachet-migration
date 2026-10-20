import './style.css';
import type { IScannerControls } from '@zxing/browser';
import {
  alternatives,
  appliedAddons,
  bulkSachetIn,
  closeness,
  compare,
  costPer,
  matchedPer,
  migrationSavings,
  plasticPer,
  refillsFor,
  sachetsPer,
  switchSavings,
  totals,
} from './calc';
import {
  categories,
  findByBarcode,
  isSachetKind,
  kindLabel,
  productById,
  products,
  type CategoryId,
  type Estimate,
  type Product,
} from './data';
import { getLang, setLang, t, tx, type Lang } from './i18n';
import { packIcon } from './icons';
import { scanFromCamera, scanFromImage } from './scanner';
import {
  addBase,
  buyAgain,
  getMigration,
  getMigrations,
  migrate,
  migrationTo,
  removeMigration,
  type Migration,
} from './store';

const app = document.querySelector<HTMLDivElement>('#app')!;
const topbar = document.querySelector<HTMLElement>('#topbar')!;
const nav = document.querySelector<HTMLElement>('#nav')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;

// ---------- formatting ----------

const rp = (n: number) => `${n < 0 ? '−' : ''}Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;

function grams(g: number): string {
  const a = Math.abs(g);
  const locale = getLang() === 'id' ? 'id-ID' : 'en-GB';
  if (a >= 1000) return `${(a / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} kg`;
  if (a < 100) return `${a.toLocaleString(locale, { maximumFractionDigits: 1 })} g`;
  return `${Math.round(a)} g`;
}

const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
const count = (n: number) => Math.round(n).toLocaleString('id-ID');
const dec1 = (n: number) => n.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-GB', { maximumFractionDigits: 1 });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const unit = (c: CategoryId) => tx(categories[c].unit);

/** "*" when any of these numbers is a guess rather than measured. */
const star = (fields: Estimate[], ...ps: Product[]) =>
  ps.some((p) => p.estimated?.some((f) => fields.includes(f))) ? '<sup class="est">*</sup>' : '';
const name = (p: Product) => esc(tx(p.name));
const pack = (p: Product) => esc(tx(p.pack));

function productRow(p: Product) {
  return `<a class="row" href="#/p/${p.id}">
    ${packIcon(p.kind)}
    <span class="row-main"><b>${name(p)}</b><small>${pack(p)}</small></span>
    <span class="row-val">${rp(costPer(p))}${star(['price', 'portions'], p)}<small>${t('per', { unit: unit(p.category) })}</small></span>
  </a>`;
}

let toastTimer = 0;
function toast(html: string) {
  toastEl.innerHTML = html;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), 5000);
}

// ---------- camera ----------

let camera: IScannerControls | null = null;
function stopCamera() {
  camera?.stop();
  camera = null;
}

function handleCode(code: string) {
  const p = findByBarcode(code);
  if (p) {
    location.hash = `#/p/${p.id}`;
    return;
  }
  const msg = document.querySelector<HTMLDivElement>('#scan-msg');
  if (msg) msg.innerHTML = t('unknownCode', { code: `<b>${esc(code)}</b>` });
}

// ---------- chrome ----------

function renderChrome(tab: string) {
  const lang = getLang();
  topbar.innerHTML = `
    <a href="#/" class="brand"><span class="brand-mark" aria-hidden="true"></span>Sachet Migration</a>
    <div class="lang" role="group" aria-label="Language">
      ${(['id', 'en'] as Lang[])
        .map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`)
        .join('')}
    </div>`;
  nav.innerHTML = [
    ['home', '#/', t('navCheck')],
    ['migrations', '#/migrasi', t('navSavings')],
    ['why', '#/kenapa', t('navWhy')],
  ]
    .map(([id, href, label]) => `<a href="${href}" class="${id === tab ? 'active' : ''}">${label}</a>`)
    .join('');
}

// ---------- home ----------

function homeView(): string {
  const groups = (Object.keys(categories) as CategoryId[])
    .map((c) => {
      const items = products.filter((p) => p.category === c && !p.future && p.kind !== 'homemade');
      return `<div class="group"><h3>${tx(categories[c].label)}</h3>${items.map(productRow).join('')}</div>`;
    })
    .join('');

  return `
    <section class="hero">
      <h1>${t('homeTitle')}</h1>
      <p class="lead">${t('homeSub')}</p>
    </section>

    <section class="scan">
      <div class="viewfinder" id="viewfinder" hidden>
        <video id="video" playsinline muted></video>
        <span class="aim" aria-hidden="true"></span>
        <button class="btn stop" id="stop-scan" type="button">${t('stop')}</button>
      </div>
      <button class="btn primary big" id="start-scan" type="button">
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M17 8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        ${t('scan')}
      </button>
      <label class="btn" for="photo">${t('photo')}</label>
      <input type="file" id="photo" accept="image/*" hidden>
      <div id="scan-msg" class="scan-msg" role="status"></div>
      <label class="visually-hidden" for="search">${t('searchLabel')}</label>
      <input id="search" class="search" type="search" placeholder="${t('searchPh')}" autocomplete="off">
      <div id="search-results" class="results"></div>
    </section>

    <a class="tip-banner" href="#/kenapa">
      ${packIcon('bulk-sachet', 40)}
      <span>${t('tip')} <u>${t('tipMore')}</u></span>
    </a>

    <section>
      <h2>${t('products')}</h2>
      <p class="hint">${t('productsHint')}</p>
      ${groups}
    </section>`;
}

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

function productView(p: Product): string {
  const c = p.category;
  const { shown, hiddenCount } = alternatives(p);
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
    <a class="back" href="#/">${t('back')}</a>
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
    ${hiddenCount ? `<p class="hint">${t('hidden', { n: hiddenCount })}</p>` : ''}
    ${refills.length ? `<h2>${t('refillTitle')}</h2><div class="swaps">${refills.map((r) => refillCard(p, r)).join('')}</div>` : ''}
    ${[p, ...shown, ...refills].some((x) => x.estimated?.length) ? `<p class="footnote"><sup class="est">*</sup> ${t('estimateNote')}</p>` : ''}`;
}

// Requests for a bigger pack, kept on this phone. In the full version they'd feed the community database.
const WANT_KEY = 'sachet-migration:want-big';
function wanted(): string[] {
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

// ---------- my migrations ----------

function migrationCard(m: Migration): string {
  const base = productById.get(m.base);
  if (!base) return '';
  const to = m.to ? productById.get(m.to) : undefined;

  if (!to) {
    return `<div class="mig">
      <div class="mig-pair">
        ${packIcon(base.kind, 40)}
        <div class="mig-names"><b>${name(base)}</b><small>${pack(base)}</small></div>
      </div>
      <div class="mig-foot">
        <span class="hint">${t('notYet')}</span>
        <a class="btn" href="#/p/${base.id}">${t('seeOptions')}</a>
        <button class="icon-btn" type="button" data-remove="${m.base}" aria-label="${t('remove')}">×</button>
      </div>
    </div>`;
  }

  const s = migrationSavings(m)!;
  return `<div class="mig">
    <div class="mig-pair">
      ${packIcon(base.kind, 40)}
      <span class="arrow" aria-hidden="true">→</span>
      ${packIcon(to.kind, 40)}
      <div class="mig-names">
        <b>${name(to)}</b>
        <small>${t('fromTo', { from: pack(base), to: pack(to) })}</small>
      </div>
    </div>
    <div class="mig-stats">
      <div><small>${s.money >= 0 ? t('totalSave') : t('totalCost')}</small><b class="${s.money < 0 ? 'neg' : 'pos'}">${rp(Math.abs(s.money))}</b></div>
      <div><small>${t('totalPlastic')}</small><b class="pos">${grams(s.plastic)}</b></div>
    </div>
    <div class="mig-foot">
      <span>${t('boughtTimes', { n: m.buys })}</span>
      <button class="btn" type="button" data-again="${m.base}">${t('again')}</button>
      <button class="icon-btn" type="button" data-remove="${m.base}" aria-label="${t('remove')}">×</button>
    </div>
  </div>`;
}

function migrationsView(): string {
  const ms = getMigrations();
  const switched = ms.filter((m) => m.to);
  const tot = totals(ms);
  const shareMsg = t('shareText', { money: rp(tot.money), n: count(tot.sachets), url: location.href.split('#')[0] });

  return `
    <section class="receipt" aria-label="${t('rTitle')}">
      <p class="r-head">${t('rTitle')}</p>
      <p class="r-sub">${t('rSub')}</p>
      <div class="r-big"><span>${t('rMoney')}</span><b class="${tot.money < 0 ? 'neg' : ''}">${rp(tot.money)}</b></div>
      <div class="r-line"><span>${t('rPlastic')}</span><b>${grams(tot.plastic)}</b></div>
      <div class="r-line"><span>${t('rSachets')}</span><b>${count(tot.sachets)}</b></div>
      <div class="r-line r-total"><span>${t('rCount')}</span><b>${switched.length}</b></div>
      <p class="r-foot">${t('rFoot')}</p>
    </section>

    ${
      switched.length
        ? `<a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(shareMsg)}" target="_blank" rel="noopener">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/></svg>
            ${t('share')}
          </a>`
        : ''
    }

    <h2>${t('myProducts')}</h2>
    <div class="migs">${
      ms.length ? ms.map(migrationCard).join('') : `<div class="empty"><p>${t('migEmpty')}</p></div>`
    }</div>`;
}

// ---------- why ----------

function whyView(): string {
  const bag = productById.get('milo-bag18')!;
  const big = productById.get('milo-790')!;
  const s = switchSavings(bag, big, 1);
  const refills = products.filter((p) => p.future);

  return `
    <h1 class="page-title">${t('whyTitle')}</h1>

    <section class="tip bad">
      <div class="tip-head">${packIcon('bulk-sachet', 48)}<h2>${t('why1Title')}</h2></div>
      <p>${t('why1', { glasses: dec1(big.servings), money: rp(s.money), g: grams(s.plastic) })}</p>
      <p><b>${t('why1b')}</b></p>
    </section>

    <section class="tip">
      <div class="tip-head">${packIcon('pouch', 48)}<h2>${t('why2Title')}</h2></div>
      <p>${t('why2')}</p>
    </section>

    <section class="tip">
      <div class="tip-head">${packIcon('refill', 48)}<h2>${t('why3Title')}</h2></div>
      <p>${t('why3')}</p>
      <div class="refills">${refills
        .map((p) => `<div class="refill"><b>${name(p)}</b><small>${rp(costPer(p))} ${t('per', { unit: unit(p.category) })} · ${t('zeroPlastic')}</small></div>`)
        .join('')}</div>
    </section>`;
}

// ---------- router ----------

function route() {
  stopCamera();
  toastEl.hidden = true;
  const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
  let tab = 'home';
  if (page === 'p' && id && productById.has(id)) {
    app.innerHTML = productView(productById.get(id)!);
  } else if (page === 'migrasi') {
    app.innerHTML = migrationsView();
    tab = 'migrations';
  } else if (page === 'kenapa') {
    app.innerHTML = whyView();
    tab = 'why';
  } else {
    app.innerHTML = homeView();
  }
  renderChrome(tab);
  window.scrollTo(0, 0);
}

function rerender() {
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

// ---------- events ----------

topbar.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-lang]');
  if (!btn) return;
  setLang(btn.dataset.lang as Lang);
  rerender();
});

app.addEventListener('click', async (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('button');
  if (!el) return;

  if (el.dataset.mine) {
    addBase(el.dataset.mine);
    rerender();
    return;
  }

  if (el.dataset.migrate) {
    const base = productById.get(el.dataset.base!)!;
    const to = productById.get(el.dataset.migrate)!;
    migrate(base.id, to.id);
    const s = switchSavings(base, to, 1);
    rerender();
    toast(
      `${t('toastMigrate', { name: `${name(to)}, ${pack(to)}` })} ${
        s.money >= 0 ? t('toastSave', { money: rp(s.money) }) : t('toastCost', { money: rp(-s.money) })
      }${t('toastPlastic', { g: grams(s.plastic) })} <a href="#/migrasi">${t('seeTotal')}</a>`,
    );
    return;
  }

  if (el.dataset.again) {
    buyAgain(el.dataset.again);
    rerender();
    return;
  }

  if (el.dataset.want) {
    try {
      localStorage.setItem(WANT_KEY, JSON.stringify([...wanted(), el.dataset.want]));
    } catch {
      // ignore
    }
    (el as HTMLButtonElement).disabled = true;
    el.textContent = t('wantBigDone');
    return;
  }

  if (el.dataset.remove) {
    removeMigration(el.dataset.remove);
    rerender();
    return;
  }

  if (el.id === 'start-scan') {
    const vf = document.querySelector<HTMLDivElement>('#viewfinder')!;
    const video = document.querySelector<HTMLVideoElement>('#video')!;
    const msg = document.querySelector<HTMLDivElement>('#scan-msg')!;
    vf.hidden = false;
    msg.textContent = t('aim');
    try {
      camera = await scanFromCamera(video, (code) => {
        camera = null;
        vf.hidden = true;
        handleCode(code);
      });
    } catch {
      vf.hidden = true;
      msg.textContent = t('camFail');
    }
    return;
  }

  if (el.id === 'stop-scan') {
    stopCamera();
    document.querySelector<HTMLDivElement>('#viewfinder')!.hidden = true;
    document.querySelector<HTMLDivElement>('#scan-msg')!.textContent = '';
  }
});

app.addEventListener('change', async (ev) => {
  const target = ev.target as HTMLElement;
  if (target.id !== 'photo') return;
  const input = target as HTMLInputElement;
  const file = input.files?.[0];
  const msg = document.querySelector<HTMLDivElement>('#scan-msg')!;
  if (!file) return;
  msg.textContent = t('reading');
  try {
    handleCode(await scanFromImage(file));
  } catch {
    msg.textContent = t('noCode');
  }
  input.value = '';
});

app.addEventListener('input', (ev) => {
  const target = ev.target as HTMLInputElement;
  if (target.id !== 'search') return;
  const q = target.value.trim().toLowerCase();
  const out = document.querySelector<HTMLDivElement>('#search-results')!;
  if (!q) {
    out.innerHTML = '';
    return;
  }
  const digits = q.replace(/\D/g, '');
  const hits = products
    .filter((p) => !p.future)
    .filter(
      (p) =>
        `${tx(p.name)} ${p.brand} ${tx(p.pack)} ${tx(categories[p.category].label)}`.toLowerCase().includes(q) ||
        (digits.length >= 4 && p.barcode.includes(digits)),
    )
    .slice(0, 6);
  out.innerHTML = hits.length ? hits.map(productRow).join('') : `<p class="hint">${t('notFound')}</p>`;
});

window.addEventListener('hashchange', route);
route();
