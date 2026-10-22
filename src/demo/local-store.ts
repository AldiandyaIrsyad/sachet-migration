import type { Migration } from '../ports';

const isMigration = (m: unknown): m is Migration =>
  !!m &&
  typeof m === 'object' &&
  typeof (m as Migration).base === 'string' &&
  ((m as Migration).to === undefined || typeof (m as Migration).to === 'string') &&
  Number.isFinite((m as Migration).buys) &&
  typeof (m as Migration).since === 'string';

const today = () => new Date().toISOString().slice(0, 10);

/** Keeps everything in this browser's localStorage. No server, no account. */
export class LocalMigrationStore {
  private migrations: Migration[];

  private wants: string[];

  constructor(
    private readonly key: string,
    private readonly wantKey: string,
  ) {
    this.migrations = this.read(key).filter(isMigration);
    this.wants = this.read(wantKey).filter((x): x is string => typeof x === 'string');
  }

  /** Parsed JSON array stored under `key`; anything else (missing, corrupt, wrong shape) reads as empty. */
  private read(key: string): unknown[] {
    try {
      const raw = localStorage.getItem(key);
      const data: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private save(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode or storage full: keep working in memory for this visit.
    }
  }

  list = () => this.migrations;

  addBase(base: string) {
    if (this.migrations.some((m) => m.base === base)) return;
    this.migrations = [{ base, buys: 0, since: today() }, ...this.migrations];
    this.save(this.key, this.migrations);
  }

  /** Switch from `base` to `to`; counts as the first purchase of `to`. */
  migrate(base: string, to: string): Migration {
    const m: Migration = { base, to, buys: 1, since: today() };
    this.migrations = [m, ...this.migrations.filter((x) => x.base !== base)];
    this.save(this.key, this.migrations);
    return m;
  }

  buyAgain(base: string) {
    this.migrations = this.migrations.map((m) => (m.base === base && m.to ? { ...m, buys: m.buys + 1 } : m));
    this.save(this.key, this.migrations);
  }

  remove(base: string) {
    this.migrations = this.migrations.filter((m) => m.base !== base);
    this.save(this.key, this.migrations);
  }

  clear() {
    this.migrations = [];
    this.save(this.key, this.migrations);
  }

  wanted = () => this.wants;

  want(id: string) {
    if (this.wants.includes(id)) return;
    this.wants = [...this.wants, id];
    this.save(this.wantKey, this.wants);
  }
}
