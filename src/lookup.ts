import type { IScannerControls } from '@zxing/browser';
import { findByBarcode, search } from './data';
import { t } from './i18n';
import { scanFromCamera, scanFromImage } from './scanner';
import { esc, productRow } from './ui';

// Finding a product: camera, photo, typed barcode, or text search.

const SEARCH_PREVIEW = 6;

let camera: IScannerControls | null = null;

export function stopCamera() {
  camera?.stop();
  camera = null;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);

export function handleCode(code: string) {
  const p = findByBarcode(code.replace(/\s/g, ''));
  if (p) {
    location.hash = `#/p/${p.id}`;
    return;
  }
  const msg = $('#scan-msg');
  if (msg) msg.innerHTML = t('unknownCode', { code: `<b>${esc(code)}</b>` });
}

/** Handles the home page's lookup buttons. Returns true if the click was one of them. */
export async function onLookupClick(el: HTMLElement): Promise<boolean> {
  if (el.id === 'start-scan') {
    const vf = $<HTMLDivElement>('#viewfinder')!;
    const msg = $<HTMLDivElement>('#scan-msg')!;
    vf.hidden = false;
    msg.textContent = t('aim');
    try {
      camera = await scanFromCamera($<HTMLVideoElement>('#video')!, (code) => {
        camera = null;
        vf.hidden = true;
        handleCode(code);
      });
    } catch {
      vf.hidden = true;
      msg.textContent = t('camFail');
    }
    return true;
  }
  if (el.id === 'stop-scan') {
    stopCamera();
    $<HTMLDivElement>('#viewfinder')!.hidden = true;
    $<HTMLDivElement>('#scan-msg')!.textContent = '';
    return true;
  }
  return false;
}

export function onBarcodeSubmit(form: HTMLFormElement) {
  const code = form.querySelector<HTMLInputElement>('#barcode')!.value.trim();
  if (code) handleCode(code);
}

export async function onPhotoChosen(input: HTMLInputElement) {
  const file = input.files?.[0];
  const msg = $<HTMLDivElement>('#scan-msg')!;
  if (!file) return;
  msg.textContent = t('reading');
  try {
    handleCode(await scanFromImage(file));
  } catch {
    msg.textContent = t('noCode');
  }
  input.value = '';
}

let searchTimer = 0;
/** Debounced, so typing quickly doesn't rank the whole catalogue on every keystroke. */
export function onSearchInput(input: HTMLInputElement) {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const q = input.value.trim();
    const out = $<HTMLDivElement>('#search-results');
    if (!out) return;
    if (!q) {
      out.innerHTML = '';
      return;
    }
    const { hits, total } = search(q, SEARCH_PREVIEW);
    out.innerHTML = hits.length
      ? hits.map(productRow).join('') +
        (total > hits.length
          ? `<a class="btn" href="#/produk?q=${encodeURIComponent(q)}">${t('seeAllResults', { n: total })}</a>`
          : '')
      : `<p class="hint">${t('notFound')}</p>`;
  }, 120);
}
