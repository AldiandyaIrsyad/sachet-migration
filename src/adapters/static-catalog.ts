import type { ProductInput } from '../data';
import type { CatalogSource } from '../ports';

/** Reads one or more JSON files shipped with the site (relative to the site base). */
export class StaticCatalog implements CatalogSource {
  constructor(private readonly files: string[]) {}

  async load(): Promise<ProductInput[]> {
    const lists = await Promise.all(
      this.files.map(async (file) => {
        const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
        if (!res.ok) throw new Error(`${file}: ${res.status}`);
        return (await res.json()) as ProductInput[];
      }),
    );
    return lists.flat();
  }
}
