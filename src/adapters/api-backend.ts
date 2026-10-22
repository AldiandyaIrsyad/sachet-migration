import type { Product } from '../data';
import { getLang } from '../i18n';
import type { Backend, MigrationsOverview, ProductList, ProductPage, SwitchResult } from '../ports';

/** Talks to the Go server. The server keeps each visitor's switches (an anonymous session cookie) and does the maths. */
export class ApiBackend implements Backend {
  constructor(private readonly base = './api') {}

  private async request<T>(method: string, path: string, body?: unknown, allow404 = false): Promise<T | null> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
    return res.status === 204 ? null : ((await res.json()) as T);
  }

  private get<T>(path: string) {
    return this.request<T>('GET', path) as Promise<T>;
  }

  list({ q, category, limit }: { q?: string; category?: string; limit: number }) {
    const params = new URLSearchParams({ limit: String(limit), lang: getLang() });
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    return this.get<ProductList>(`/products?${params}`);
  }

  barcode(code: string) {
    return this.request<Product>('GET', `/barcode/${encodeURIComponent(code)}`, undefined, true);
  }

  productPage(id: string, swaps: number) {
    return this.request<ProductPage>('GET', `/products/${encodeURIComponent(id)}/page?swaps=${swaps}`, undefined, true);
  }

  refills() {
    return this.get<Product[]>('/refills');
  }

  compare(base: string, to: string, packs: number) {
    const params = new URLSearchParams({ base, to, packs: String(packs) });
    return this.request<SwitchResult>('GET', `/compare?${params}`, undefined, true);
  }

  migrations() {
    return this.get<MigrationsOverview>('/migrations');
  }

  async addBase(base: string) {
    await this.request('POST', '/migrations', { base });
  }

  migrate(base: string, to: string) {
    return this.request<SwitchResult>('POST', `/migrations/${encodeURIComponent(base)}/switch`, { to }) as Promise<SwitchResult>;
  }

  async buyAgain(base: string) {
    await this.request('POST', `/migrations/${encodeURIComponent(base)}/again`, {});
  }

  async remove(base: string) {
    await this.request('DELETE', `/migrations/${encodeURIComponent(base)}`);
  }

  async reset() {
    await this.request('DELETE', '/migrations');
  }

  async wantBigPack(id: string) {
    await this.request('POST', '/wants', { productId: id });
  }
}
