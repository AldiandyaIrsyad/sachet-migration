import { costPer, switchSavings } from '../calc';
import { productById, products } from '../data';
import { t } from '../i18n';
import { packIcon } from '../icons';
import { dec1, grams, name, rp, unit } from '../ui';

export function whyView(): string {
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
