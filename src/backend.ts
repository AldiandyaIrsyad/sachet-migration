import type { Backend } from './ports';

// Views call `backend()`; it returns whichever Backend src/compose.ts provided at start-up.
let impl: Backend | null = null;

export const provideBackend = (b: Backend) => {
  impl = b;
};

export const backend = (): Backend => {
  if (!impl) throw new Error('No Backend provided');
  return impl;
};
