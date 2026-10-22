// Fails the build when a file in public/data/ has mistakes. Cheap insurance at 1000s of rows.
import { readdirSync, readFileSync } from 'node:fs';

const dataDir = new URL('../public/data/', import.meta.url);
const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'));
// Every catalogue file is checked together, so ids and barcodes stay unique across base and demo data.
const products = files.flatMap((f) => JSON.parse(readFileSync(new URL(f, dataDir), 'utf8')));
const src = readFileSync(new URL('../src/data.ts', import.meta.url), 'utf8');
// Comments are stripped first so they can't confuse the union-type reader below.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const list = (name) => {
  const m = code.match(new RegExp(`export type ${name}\\s*=([^;]+);`));
  const values = m ? [...m[1].matchAll(/'([\w-]+)'/g)].map((x) => x[1]) : [];
  if (!values.length) {
    console.error(`check-data: could not read "export type ${name} = '…' | '…';" from src/data.ts. Keep it in that form or update this script.`);
    process.exit(1);
  }
  return values;
};
const categories = list('CategoryId');
const kinds = list('Kind');
const addons = list('AddonId');

const errors = [];
const ids = new Set();
const barcodes = new Map();
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const bilingual = (v) => typeof v === 'string' || (v && typeof v.id === 'string' && typeof v.en === 'string');

for (const [i, p] of products.entries()) {
  const at = `#${i} (${p.id ?? '?'})`;
  const bad = (msg) => errors.push(`${at}: ${msg}`);
  if (!p.id || ids.has(p.id)) bad('missing or duplicate id');
  ids.add(p.id);
  if (p.barcode && !/^\d{12,13}$/.test(p.barcode)) bad(`barcode "${p.barcode}" must be 12 or 13 digits`);
  if (p.barcode) {
    if (barcodes.has(p.barcode)) bad(`barcode ${p.barcode} also used by ${barcodes.get(p.barcode)}`);
    barcodes.set(p.barcode, p.id);
  }
  if (!p.brand) bad('missing brand');
  if (!bilingual(p.name)) bad('name must be a string or {id, en}');
  if (!bilingual(p.pack) || typeof p.pack === 'string') bad('pack must be {id, en}');
  if (!categories.includes(p.category)) bad(`unknown category "${p.category}"`);
  if (!kinds.includes(p.kind)) bad(`unknown kind "${p.kind}"`);
  if (!isNum(p.price) || p.price <= 0) bad('price must be a positive number');
  if (!isNum(p.portions) || p.portions <= 0) bad('portions must be a positive number');
  const pl = p.plastic;
  if (!pl || !(isNum(pl.total) || isNum(pl.perPortion)) || (pl.total ?? pl.perPortion) < 0) bad('plastic needs total or perPortion (>= 0)');
  for (const a of p.addons ?? []) if (!addons.includes(a)) bad(`unknown addon "${a}"`);
  for (const e of p.estimated ?? []) if (!['price', 'plastic', 'portions'].includes(e)) bad(`unknown estimate field "${e}"`);
}

if (errors.length) {
  console.error(`public/data: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`${files.join(', ')}: ${products.length} products OK`);
