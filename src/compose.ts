import { LocalMigrationStore } from './adapters/local-store';
import { StaticCatalog } from './adapters/static-catalog';
import { loadCatalog } from './data';
import { provideFeatures } from './features';
import { provideStore } from './store';

/**
 * The one place that decides what the app is plugged into.
 *
 *   app   (default)  catalogue shipped as JSON, switches kept in this browser.
 *   demo             same code, plus extra sample products, a guided walkthrough and a
 *                    "this is a demo" notice. Build it with `npm run build:demo`.
 *
 * A backend-driven build would add an adapter for CatalogSource and MigrationStore (src/ports.ts)
 * and a new mode here; no view needs to change.
 */
export async function compose(mode: string): Promise<void> {
  if (mode === 'demo') {
    provideStore(new LocalMigrationStore('sachet-demo:migrations'));
    provideFeatures({ demoBanner: true, exampleBarcode: '8992696524323', tour: true });
    await loadCatalog(new StaticCatalog(['data/products.json', 'data/demo-products.json']));
    return;
  }
  provideStore(new LocalMigrationStore('sachet-migration:migrations'));
  await loadCatalog(new StaticCatalog(['data/products.json']));
}
