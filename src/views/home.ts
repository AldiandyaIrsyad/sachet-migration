import { t } from '../i18n';
import { packIcon } from '../icons';

export function homeView(): string {
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
      <div class="scan-row">
        <button class="btn primary big" id="start-scan" type="button">${t('scan')}</button>
        <label class="btn" for="photo">${t('photo')}</label>
      </div>
      <input type="file" id="photo" accept="image/*" hidden>
      <form id="barcode-form" class="barcode-form" autocomplete="off">
        <label class="visually-hidden" for="barcode">${t('barcodeLabel')}</label>
        <input id="barcode" class="search" type="text" inputmode="numeric" placeholder="${t('barcodePh')}">
        <button class="btn primary" type="submit">${t('barcodeGo')}</button>
      </form>
      <div id="scan-msg" class="scan-msg" role="status"></div>
      <label class="visually-hidden" for="search">${t('searchLabel')}</label>
      <input id="search" class="search" type="search" placeholder="${t('searchPh')}" autocomplete="off">
      <div id="search-results" class="results"></div>
    </section>

    <a class="tip-banner" href="#/kenapa">
      ${packIcon('bulk-sachet', 40)}
      <span>${t('tip')} <u>${t('tipMore')}</u></span>
    </a>
  `;
}
