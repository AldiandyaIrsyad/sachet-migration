import { backend } from '../backend';
import { t } from '../i18n';
import { packIcon } from '../icons';
import { dec1, grams, name, rp, unit } from '../ui';

export async function whyView(): Promise<string> {
  const [example, refills] = await Promise.all([backend().compare('milo-bag18', 'milo-790', 1), backend().refills()]);
  const intro = example
    ? `<p>${t('why1', { glasses: dec1(example.to.servings), money: rp(example.savings.money), g: grams(example.savings.plastic) })}</p>`
    : '';

  return `
    <h1 class="page-title">${t('whyTitle')}</h1>

    <section class="tip bad">
      <div class="tip-head">${packIcon('bulk-sachet', 48)}<h2>${t('why1Title')}</h2></div>
      ${intro}
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
        .map((p) => `<div class="refill"><b>${name(p)}</b><small>${rp(p.costPer)} ${t('per', { unit: unit(p.category) })} · ${t('zeroPlastic')}</small></div>`)
        .join('')}</div>
    </section>`;
}
