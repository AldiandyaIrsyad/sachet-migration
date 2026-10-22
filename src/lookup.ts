import type { IScannerControls } from '@zxing/browser';
import { backend } from './backend';
import { features } from './features';
import { t } from './i18n';
import { scanFromCamera, scanFromImage } from './scanner';
import { esc, productRow } from './ui';

// Finding a product: camera, photo, typed barcode, or text search.

const SEARCH_PREVIEW = 6;

let camera: IScannerControls | null = null;
/** Bumped on every stop, so a camera that finishes starting after you left the page can tell and shut itself off. */
let cameraRun = 0;

export function stopCamera() {
  cameraRun++;
  camera?.stop();
  camera = null;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);

export async function handleCode(code: string) {
  const msg = $('#scan-msg');
  let p;
  try {
    p = await backend().barcode(code.replace(/\s/g, ''));
  } catch {
    if (msg) msg.textContent = t('loadFail');
    return;
  }
  if (p) {
    location.hash = `#/p/${p.id}`;
    return;
  }
  if (msg) msg.innerHTML = t('unknownCode', { code: `<b>${esc(code)}</b>` });
}

/** Handles the home page's lookup buttons. Returns true if the click was one of them. */
export async function onLookupClick(el: HTMLElement): Promise<boolean> {
  if (el.id === 'start-scan') {
    const vf = $<HTMLDivElement>('#viewfinder')!;
    const msg = $<HTMLDivElement>('#scan-msg')!;
    vf.hidden = false;
    msg.textContent = t('aim');
    stopCamera();
    const run = cameraRun;
    try {
      const controls = await scanFromCamera($<HTMLVideoElement>('#video')!, (code) => {
        if (run !== cameraRun) return;
        camera = null;
        vf.hidden = true;
        void handleCode(code);
      });
      if (run === cameraRun) camera = controls;
      else controls.stop();
    } catch {
      if (run !== cameraRun) return true;
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
  if (el.id === 'use-example' && features.exampleBarcode) {
    await handleCode(features.exampleBarcode);
    return true;
  }
  return false;
}

export function onBarcodeSubmit(form: HTMLFormElement) {
  const code = form.querySelector<HTMLInputElement>('#barcode')!.value.trim();
  if (code) void handleCode(code);
}

export async function onPhotoChosen(input: HTMLInputElement) {
  const file = input.files?.[0];
  const msg = $<HTMLDivElement>('#scan-msg')!;
  if (!file) return;
  msg.textContent = t('reading');
  try {
    await handleCode(await scanFromImage(file));
  } catch {
    msg.textContent = t('noCode');
  }
  input.value = '';
}

let searchTimer = 0;
let searchRun = 0;
/** Debounced, so typing quickly doesn't query on every keystroke. Late answers to old queries are dropped. */
export function onSearchInput(input: HTMLInputElement) {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(async () => {
    const q = input.value.trim();
    const out = $<HTMLDivElement>('#search-results');
    if (!out) return;
    const run = ++searchRun;
    if (!q) {
      out.innerHTML = '';
      return;
    }
    try {
      const { items, total } = await backend().list({ q, limit: SEARCH_PREVIEW });
      if (run !== searchRun || !out.isConnected) return;
      out.innerHTML = items.length
        ? items.map(productRow).join('') +
          (total > items.length
            ? `<a class="btn" href="#/produk?q=${encodeURIComponent(q)}">${t('seeAllResults', { n: total })}</a>`
            : '')
        : `<p class="hint">${t('notFound')}</p>`;
    } catch {
      if (run === searchRun) out.innerHTML = `<p class="hint">${t('loadFail')}</p>`;
    }
  }, 120);
}
