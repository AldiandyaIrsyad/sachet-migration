import { ApiBackend } from './adapters/api-backend';
import { provideBackend } from './backend';
import { provideFeatures } from './features';

/**
 * The one place that decides what the app is plugged into.
 *
 *   app   (default)  the Go server does the work and keeps each visitor's switches (see server/).
 *                    Build it with `npm run build`; `npm run dev` proxies /api to a local server.
 *   demo             no server: the same logic runs in the browser, switches live in localStorage,
 *                    plus a "this is a demo" notice and a guided walkthrough. This is what GitHub Pages
 *                    publishes (`npm run build:demo`). The demo code is loaded only in this mode.
 */
export async function compose(mode: string): Promise<void> {
  if (mode === 'demo') {
    const [{ LocalBackend }, { LocalMigrationStore }] = await Promise.all([
      import('./demo/local-backend'),
      import('./demo/local-store'),
    ]);
    const store = new LocalMigrationStore('sachet-demo:migrations', 'sachet-demo:want-big');
    provideBackend(await LocalBackend.create(store, ['data/products.json', 'data/demo-products.json']));
    provideFeatures({ demoBanner: true, exampleBarcode: '8992696524323', tour: true });
    return;
  }
  provideBackend(new ApiBackend());
}
