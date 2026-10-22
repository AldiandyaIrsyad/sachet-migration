import './style.css';
import { backend } from './backend';
import { compose } from './compose';
import { features } from './features';
import { getLang, setLang, t, type Lang } from './i18n';
import { onBarcodeSubmit, onLookupClick, onPhotoChosen, onSearchInput, stopCamera } from './lookup';
import { grams, name, pack, rp } from './ui';
import { homeView } from './views/home';
import { productView, showMoreSwaps } from './views/product';
import {
  applyParams,
  productListHtml,
  productsView,
  setCategory,
  setQuery,
  showMoreProducts,
} from './views/products';
import { migrationsView } from './views/savings';
import { whyView } from './views/why';
import type { CategoryId } from './data';

const app = document.querySelector<HTMLDivElement>('#app')!;
const topbar = document.querySelector<HTMLElement>('#topbar')!;
const nav = document.querySelector<HTMLElement>('#nav')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;

let toastTimer = 0;
function toast(html: string) {
  toastEl.innerHTML = html;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), 5000);
}

// ---------- chrome ----------

function renderChrome(tab: string) {
  const lang = getLang();
  topbar.innerHTML = `
    <a href="#/" class="brand"><span class="brand-mark" aria-hidden="true"></span>Sachet Migration</a>
    ${features.tour ? `<button type="button" class="guide-btn" data-tour>${t('guide')}</button>` : ''}
    <div class="lang" role="group" aria-label="Language">
      ${(['id', 'en'] as Lang[])
        .map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`)
        .join('')}
    </div>`;
  nav.innerHTML = [
    ['home', '#/', t('navCheck')],
    ['products', '#/produk', t('navProducts')],
    ['migrations', '#/migrasi', t('navSavings')],
  ]
    .map(([id, href, label]) => `<a href="${href}" class="${id === tab ? 'active' : ''}">${label}</a>`)
    .join('');
}

// ---------- router ----------

/** `#/produk?c=coffee` -> page "produk", id undefined, params {c: coffee}. */
function parseHash() {
  const [path, qs = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page, id] = path.split('/');
  return { page, id, params: new URLSearchParams(qs) };
}

let lastHash = '';
/** True once the person has moved between pages here, so history.back() stays inside the app. */
let navigatedInApp = false;
/** Bumped on every render, so a slow page that finishes after you've moved on doesn't overwrite the new one. */
let renderRun = 0;

async function pageHtml(page: string, id: string | undefined, params: URLSearchParams): Promise<{ html: string; tab: string }> {
  if (page === 'p' && id) {
    const html = await productView(id);
    if (html) return { html, tab: 'home' };
  } else if (page === 'migrasi') {
    return { html: await migrationsView(), tab: 'migrations' };
  } else if (page === 'kenapa') {
    return { html: await whyView(), tab: 'home' };
  } else if (page === 'produk') {
    // Filters in the URL only apply when you arrive with them (e.g. from "see all results").
    if (location.hash !== lastHash && params.size) applyParams(params);
    return { html: await productsView(), tab: 'products' };
  }
  return { html: homeView(), tab: 'home' };
}

async function route() {
  stopCamera();
  toastEl.hidden = true;
  const run = ++renderRun;
  const { page, id, params } = parseHash();
  let result: { html: string; tab: string };
  try {
    result = await pageHtml(page, id, params);
  } catch {
    if (run !== renderRun) return;
    result = { html: `<p class="hint">${t('loadFail')}</p>`, tab: 'home' };
  }
  if (run !== renderRun) return;
  app.innerHTML = result.html;
  lastHash = location.hash;
  renderChrome(result.tab);
  window.scrollTo(0, 0);
}

async function rerender() {
  const y = window.scrollY;
  await route();
  window.scrollTo(0, y);
}

// ---------- events ----------

topbar.addEventListener('click', async (ev) => {
  if ((ev.target as HTMLElement).closest('[data-tour]')) {
    (await import('./demo/tour')).replayTour();
    return;
  }
  const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-lang]');
  if (!btn) return;
  setLang(btn.dataset.lang as Lang);
  void rerender();
});

app.addEventListener('click', async (ev) => {
  const target = ev.target as HTMLElement;

  // "Back" goes to wherever you came from (the product list keeps its filters).
  const back = target.closest<HTMLAnchorElement>('[data-back]');
  if (back && navigatedInApp) {
    ev.preventDefault();
    history.back();
    return;
  }

  const el = target.closest<HTMLElement>('button');
  if (!el) return;

  if (await onLookupClick(el)) return;

  try {
    await act(el);
  } catch {
    toast(t('loadFail'));
  }
});

async function act(el: HTMLElement) {
  if (el.dataset.mine) {
    await backend().addBase(el.dataset.mine);
    await rerender();
  } else if (el.dataset.migrate) {
    const { to, savings: s } = await backend().migrate(el.dataset.base!, el.dataset.migrate);
    await rerender();
    toast(
      `${t('toastMigrate', { name: `${name(to)}, ${pack(to)}` })} ${
        s.money >= 0 ? t('toastSave', { money: rp(s.money) }) : t('toastCost', { money: rp(-s.money) })
      }${t('toastPlastic', { g: grams(s.plastic) })} <a href="#/migrasi">${t('seeTotal')}</a>`,
    );
  } else if (el.dataset.again) {
    await backend().buyAgain(el.dataset.again);
    await rerender();
  } else if (el.dataset.remove) {
    await backend().remove(el.dataset.remove);
    await rerender();
  } else if (el.dataset.want) {
    (el as HTMLButtonElement).disabled = true;
    await backend().wantBigPack(el.dataset.want);
    el.textContent = t('wantBigDone');
  } else if (el.dataset.pcat) {
    setCategory(el.dataset.pcat as CategoryId | 'all');
    await rerender();
  } else if ('moreProducts' in el.dataset) {
    showMoreProducts();
    document.querySelector('#plist')!.innerHTML = await productListHtml();
  } else if ('moreSwaps' in el.dataset) {
    showMoreSwaps();
    await rerender();
  }
}

app.addEventListener('submit', (ev) => {
  const form = ev.target as HTMLFormElement;
  if (form.id !== 'barcode-form') return;
  ev.preventDefault();
  onBarcodeSubmit(form);
});

app.addEventListener('change', (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.id === 'photo') void onPhotoChosen(input);
});

let productSearchTimer = 0;
let listRun = 0;
app.addEventListener('input', (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.id === 'search') onSearchInput(input);
  if (input.id === 'psearch') {
    clearTimeout(productSearchTimer);
    productSearchTimer = window.setTimeout(() => {
      setQuery(input.value);
      const run = ++listRun;
      void productListHtml().then((html) => {
        const list = document.querySelector('#plist');
        if (list && run === listRun) list.innerHTML = html;
      });
    }, 120);
  }
});

// ---------- boot ----------

async function boot() {
  app.innerHTML = `<p class="hint">${t('loading')}</p>`;
  try {
    await compose(import.meta.env.MODE);
  } catch {
    app.innerHTML = `<p class="hint">${t('loadFail')}</p>`;
    return;
  }
  if (features.demoBanner) {
    const banner = document.querySelector<HTMLDivElement>('#demo-banner')!;
    banner.textContent = t('demoBanner');
    banner.hidden = false;
    document.title += ' (demo)';
  }
  window.addEventListener('hashchange', () => {
    navigatedInApp = true;
    void route();
  });
  await route();
  if (features.tour) (await import('./demo/tour')).startTourIfFirstVisit();
}

void boot();
