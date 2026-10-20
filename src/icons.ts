import type { Kind } from './data';

// Simple pack shapes so people can recognise what they're looking at without reading.
// Sachet-type packs are tinted "trash" red; the better packs are tinted green.
const shapes: Record<Kind, string> = {
  sachet: `<rect x="15" y="7" width="18" height="34" rx="2" class="f-bad"/>
    <path d="M15 11h18M15 37h18" class="dash"/>`,
  renceng: `<g class="f-bad">
      <rect x="4" y="9" width="9" height="30" rx="1.5"/><rect x="14" y="9" width="9" height="30" rx="1.5"/>
      <rect x="24" y="9" width="9" height="30" rx="1.5"/><rect x="34" y="9" width="9" height="30" rx="1.5"/>
    </g>
    <path d="M4 13h39M4 35h39" class="dash"/>`,
  'bulk-sachet': `<path d="M8 14h32l-2 28H10z" class="f-bad-strong"/>
    <path d="M14 14c0-5 4-8 10-8s10 3 10 8" class="line"/>
    <rect x="13" y="20" width="6" height="14" rx="1" class="f-bad"/><rect x="21" y="18" width="6" height="14" rx="1" class="f-bad"/>
    <rect x="29" y="21" width="6" height="14" rx="1" class="f-bad"/>`,
  pouch: `<path d="M14 9h20v3l3 26c0 2-1 3-3 3H14c-2 0-3-1-3-3l3-26z" class="f-good"/>
    <path d="M14 15h20" class="line"/>`,
  bag: `<path d="M12 12l3-4 3 4 3-4 3 4 3-4 3 4 3-4 3 4v28H12z" class="f-good"/>
    <rect x="17" y="22" width="14" height="10" rx="2" class="f-paper"/>`,
  jar: `<rect x="15" y="6" width="18" height="7" rx="2" class="f-good-strong"/>
    <rect x="12" y="13" width="24" height="29" rx="6" class="f-good"/>
    <rect x="16" y="21" width="16" height="11" rx="2" class="f-paper"/>`,
  cup: `<path d="M12 14h24l-3 27c0 1-1 2-2 2H17c-1 0-2-1-2-2z" class="f-bad"/>
    <rect x="10" y="10" width="28" height="5" rx="2" class="f-bad-strong"/>
    <path d="M34 4l-5 12" class="line" stroke-width="2.5" stroke-linecap="round"/>`,
  box: `<path d="M12 8h24v34H12z" class="f-good"/>
    <path d="M12 8l4-4h24l-4 4M36 8l4-4v34l-4 4" class="f-good-strong"/>
    <circle cx="24" cy="24" r="6" class="f-paper"/>`,
  can: `<path d="M12 11v27c0 2 5 4 12 4s12-2 12-4V11" class="f-good"/>
    <ellipse cx="24" cy="11" rx="12" ry="4" class="f-good-strong"/>
    <rect x="12" y="20" width="24" height="11" class="f-paper"/>`,
  // A cobek (stone mortar) with an ulekan.
  homemade: `<path d="M6 24h36c0 9-8 15-18 15S6 33 6 24z" class="f-good"/>
    <ellipse cx="24" cy="24" rx="18" ry="4" class="f-good-strong"/>
    <path d="M29 22l9-14" class="line" stroke-width="5" stroke-linecap="round"/>`,
  refill: `<path d="M18 6h12v6l4 5v23c0 2-1 3-3 3H17c-2 0-3-1-3-3V17l4-5z" class="f-refill"/>
    <path d="M24 22c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" class="f-paper"/>`,
};

export function packIcon(kind: Kind, size = 44): string {
  return `<svg class="pack-icon" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${shapes[kind]}</svg>`;
}
