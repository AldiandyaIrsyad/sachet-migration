// Everything lives in this browser's localStorage. No server, no account.
const MIGRATIONS_KEY = 'sachet-migration:migrations';

/**
 * One product you use. `base` is what you used to buy; `to` is what you switched to.
 * `buys` counts how many packs of `to` you've bought since switching.
 */
export interface Migration {
  base: string;
  to?: string;
  buys: number;
  /** ISO date the base was added or the switch was made. */
  since: string;
}

function read(): Migration[] {
  try {
    const raw = localStorage.getItem(MIGRATIONS_KEY);
    return raw ? (JSON.parse(raw) as Migration[]) : [];
  } catch {
    return [];
  }
}

let migrations: Migration[] = read();

function save() {
  try {
    localStorage.setItem(MIGRATIONS_KEY, JSON.stringify(migrations));
  } catch {
    // Private mode or storage full: keep working in memory for this visit.
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export const getMigrations = () => migrations;
export const getMigration = (base: string) => migrations.find((m) => m.base === base);
/** The migration that switched *to* this product, if any. */
export const migrationTo = (to: string) => migrations.find((m) => m.to === to);

/** Mark a product as one you use. */
export function addBase(base: string) {
  if (getMigration(base)) return;
  migrations = [{ base, buys: 0, since: today() }, ...migrations];
  save();
}

/** Switch from `base` to `to`; counts as the first purchase of `to`. */
export function migrate(base: string, to: string): Migration {
  const m: Migration = { base, to, buys: 1, since: today() };
  migrations = [m, ...migrations.filter((x) => x.base !== base)];
  save();
  return m;
}

export function buyAgain(base: string) {
  migrations = migrations.map((m) => (m.base === base && m.to ? { ...m, buys: m.buys + 1 } : m));
  save();
}

export function removeMigration(base: string) {
  migrations = migrations.filter((m) => m.base !== base);
  save();
}
