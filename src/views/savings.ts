import { migrationSavings, totals } from '../calc';
import { productById } from '../data';
import { t } from '../i18n';
import { packIcon } from '../icons';
import { getMigrations, type Migration } from '../store';
import { count, grams, name, pack, rp } from '../ui';

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

export function migrationsView(): string {
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
