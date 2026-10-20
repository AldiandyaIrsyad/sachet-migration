import './style.css';
import { switchSavings } from './calc';
import { compose } from './compose';
import { productById } from './data';
import { features } from './features';
import { getLang, setLang, t, type Lang } from './i18n';
import { onBarcodeSubmit, onLookupClick, onPhotoChosen, onSearchInput, stopCamera } from './lookup';
import { addBase, buyAgain, migrate, removeMigration } from './store';
import { grams, name, pack, rp } from './ui';
import { homeView } from './views/home';
import { productView, showMoreSwaps, WANT_KEY, wanted } from './views/product';
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

function route() {
  stopCamera();
  toastEl.hidden = true;
  const { page, id, params } = parseHash();
  let tab = 'home';
  if (page === 'p' && id && productById.has(id)) {
    app.innerHTML = productView(productById.get(id)!);
  } else if (page === 'migrasi') {
    app.innerHTML = migrationsView();
    tab = 'migrations';
  } else if (page === 'kenapa') {
    app.innerHTML = whyView();
    tab = 'why';
  } else if (page === 'produk') {
    // Filters in the URL only apply when you arrive with them (e.g. from "see all results").
    if (location.hash !== lastHash && params.size) applyParams(params);
    app.innerHTML = productsView();
    tab = 'products';
  } else {
    app.innerHTML = homeView();
  }
  lastHash = location.hash;
  renderChrome(tab);
  window.scrollTo(0, 0);
}

function rerender() {
  const y = window.scrollY;
  route();
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
  rerender();
});

app.addEventListener('click', async (ev) => {
  const target = ev.target as HTMLElement;

  // "Back" goes to wherever you came from (the product list keeps its filters).
  const back = target.closest<HTMLAnchorElement>('[data-back]');
  if (back && history.length > 1) {
    ev.preventDefault();
    history.back();
    return;
  }

  const el = target.closest<HTMLElement>('button');
  if (!el) return;

  if (await onLookupClick(el)) return;

  if (el.dataset.mine) {
    addBase(el.dataset.mine);
    rerender();
  } else if (el.dataset.migrate) {
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
  } else if (el.dataset.again) {
    buyAgain(el.dataset.again);
    rerender();
  } else if (el.dataset.remove) {
    removeMigration(el.dataset.remove);
    rerender();
  } else if (el.dataset.want) {
    try {
      localStorage.setItem(WANT_KEY, JSON.stringify([...wanted(), el.dataset.want]));
    } catch {
      // ignore
    }
    (el as HTMLButtonElement).disabled = true;
    el.textContent = t('wantBigDone');
  } else if (el.dataset.pcat) {
    setCategory(el.dataset.pcat as CategoryId | 'all');
    rerender();
  } else if ('moreProducts' in el.dataset) {
    showMoreProducts();
    document.querySelector('#plist')!.innerHTML = productListHtml();
  } else if ('moreSwaps' in el.dataset) {
    showMoreSwaps();
    rerender();
  }
});

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
app.addEventListener('input', (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.id === 'search') onSearchInput(input);
  if (input.id === 'psearch') {
    clearTimeout(productSearchTimer);
    productSearchTimer = window.setTimeout(() => {
      setQuery(input.value);
      document.querySelector('#plist')!.innerHTML = productListHtml();
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
  window.addEventListener('hashchange', route);
  route();
  if (features.tour) (await import('./demo/tour')).startTourIfFirstVisit();
}

void boot();
