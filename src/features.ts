import type { Features } from './ports';

/** Optional extras switched on by the host (see compose.ts). Empty in a normal deployment. */
export let features: Features = {};

export const provideFeatures = (f: Features) => {
  features = f;
};
