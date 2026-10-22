import { t, type StringKey } from '../i18n';
import { features } from '../features';
import { backend } from '../backend';

// A skippable walkthrough that drives the real app with the MILO example.
const SEEN_KEY = 'sachet-demo:tour-seen';
const EXAMPLE_BARCODE = features.exampleBarcode ?? '8992696524323';

interface Step {
  hash: string;
  target: string;
  title: StringKey;
  body: StringKey;
  next?: StringKey;
  /** Runs when the viewer taps Next, before moving on. */
  action?: () => Promise<void> | void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function typeBarcode() {
  const input = document.querySelector<HTMLInputElement>('#barcode');
  if (!input) return;
  input.value = '';
  for (const ch of EXAMPLE_BARCODE) {
    input.value += ch;
    await wait(45);
  }
  await wait(250);
  document.querySelector<HTMLFormElement>('#barcode-form')?.requestSubmit();
}

async function switchAndBuy() {
  await backend().migrate('milo-bag18', 'milo-790');
  await backend().buyAgain('milo-bag18');
  await backend().buyAgain('milo-bag18');
}

const steps: Step[] = [
  { hash: '#/', target: '#barcode-form', title: 'tour1Title', body: 'tour1', next: 'tour1Next', action: typeBarcode },
  { hash: '#/p/milo-bag18', target: '.shelf-label', title: 'tour2Title', body: 'tour2' },
  { hash: '#/p/milo-bag18', target: '.swap:has([data-migrate="milo-790"])', title: 'tour3Title', body: 'tour3' },
  { hash: '#/p/milo-bag18', target: '[data-migrate="milo-790"]', title: 'tour4Title', body: 'tour4', action: switchAndBuy },
  { hash: '#/migrasi', target: '.receipt', title: 'tour5Title', body: 'tour5' },
  { hash: '#/migrasi', target: '#nav', title: 'tour6Title', body: 'tour6', next: 'tourDone' },
];

const LOOK = 'look-here';
let lit: HTMLElement | null = null;
let root: HTMLDivElement | null = null;
let index = 0;
let busy = false;

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
}

function unlight() {
  lit?.classList.remove(LOOK);
  lit = null;
}

function close() {
  unlight();
  root?.remove();
  root = null;
  markSeen();
  document.removeEventListener('keydown', onKey);
  location.hash = '#/';
}

function onKey(ev: KeyboardEvent) {
  if (ev.key === 'Escape') close();
}

async function show(i: number) {
  index = i;
  const step = steps[i];
  const here = location.hash || '#/';
  if (here !== step.hash) {
    location.hash = step.hash;
    await wait(120);
  }
  unlight();
  // The page may still be swapping in after a hash change, so give the target a moment to appear.
  let target = document.querySelector<HTMLElement>(step.target);
  for (let tries = 0; !target && tries < 15; tries++) {
    await wait(60);
    target = document.querySelector<HTMLElement>(step.target);
  }
  if (!root) return;
  const tall = !!target && target.getBoundingClientRect().height > innerHeight * 0.5;
  target?.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'instant' });
  if (tall) scrollBy(0, -70);
  target?.classList.add(LOOK);
  lit = target;
  await wait(100);
  const r = target?.getBoundingClientRect();
  const card = root.querySelector<HTMLDivElement>('.tour-card')!;
  const inLowerHalf = !tall && !!r && r.top + r.height / 2 > innerHeight / 2;
  card.className = `tour-card ${inLowerHalf ? 'top' : 'bottom'}`;
  card.querySelector('h2')!.textContent = t(step.title);
  card.querySelector('p')!.textContent = t(step.body);
  card.querySelector<HTMLButtonElement>('[data-tour-next]')!.textContent = t(step.next ?? 'tourNext');
  card.querySelector('.tour-count')!.textContent = `${i + 1}/${steps.length}`;
}

async function next() {
  if (busy) return;
  busy = true;
  try {
    await steps[index].action?.();
    if (index === steps.length - 1) close();
    else await show(index + 1);
  } finally {
    busy = false;
  }
}

async function start() {
  if (root) return;
  root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `
    <div class="tour-backdrop"></div>
    <div class="tour-card bottom" role="dialog" aria-live="polite">
      <span class="tour-count"></span>
      <h2></h2>
      <p></p>
      <div class="tour-actions">
        <button type="button" class="btn" data-tour-skip>${t('tourSkip')}</button>
        <button type="button" class="btn primary" data-tour-next></button>
      </div>
    </div>`;
  root.addEventListener('click', (ev) => {
    const el = ev.target as HTMLElement;
    if (el.closest('[data-tour-skip]')) close();
    else if (el.closest('[data-tour-next]')) void next();
  });
  document.body.append(root);
  document.addEventListener('keydown', onKey);
  await backend().reset();
  void show(0);
}

export function replayTour() {
  location.hash = '#/';
  void wait(60).then(() => start());
}

export function startTourIfFirstVisit() {
  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // ignore
  }
  if (!seen) void start();
}
