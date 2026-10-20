import type { Migration, MigrationStore } from './ports';

export type { Migration };

// Views call these plain functions; they forward to whichever MigrationStore was provided at start-up.
let impl: MigrationStore | null = null;
const store = () => {
  if (!impl) throw new Error('No MigrationStore provided');
  return impl;
};

export const provideStore = (s: MigrationStore) => {
  impl = s;
};

export const getMigrations = () => store().list();
export const getMigration = (base: string) => store().list().find((m) => m.base === base);
/** The migration that switched *to* this product, if any. */
export const migrationTo = (to: string) => store().list().find((m) => m.to === to);

/** Mark a product as one you use. */
export const addBase = (base: string) => store().addBase(base);
/** Switch from `base` to `to`; counts as the first purchase of `to`. */
export const migrate = (base: string, to: string) => store().migrate(base, to);
export const buyAgain = (base: string) => store().buyAgain(base);
export const removeMigration = (base: string) => store().remove(base);
export const resetMigrations = () => store().clear();
