import type { Migration, MigrationStore } from '../ports';

const today = () => new Date().toISOString().slice(0, 10);

/** Keeps everything in this browser's localStorage. No server, no account. */
export class LocalMigrationStore implements MigrationStore {
  private migrations: Migration[];

  constructor(private readonly key: string) {
    this.migrations = this.read();
  }

  private read(): Migration[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as Migration[]) : [];
    } catch {
      return [];
    }
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.migrations));
    } catch {
      // Private mode or storage full: keep working in memory for this visit.
    }
  }

  list = () => this.migrations;

  addBase(base: string) {
    if (this.migrations.some((m) => m.base === base)) return;
    this.migrations = [{ base, buys: 0, since: today() }, ...this.migrations];
    this.save();
  }

  /** Switch from `base` to `to`; counts as the first purchase of `to`. */
  migrate(base: string, to: string): Migration {
    const m: Migration = { base, to, buys: 1, since: today() };
    this.migrations = [m, ...this.migrations.filter((x) => x.base !== base)];
    this.save();
    return m;
  }

  buyAgain(base: string) {
    this.migrations = this.migrations.map((m) => (m.base === base && m.to ? { ...m, buys: m.buys + 1 } : m));
    this.save();
  }

  remove(base: string) {
    this.migrations = this.migrations.filter((m) => m.base !== base);
    this.save();
  }

  clear() {
    this.migrations = [];
    this.save();
  }
}
