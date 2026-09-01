// Per-run memo so pairing all 5 catalogs against the same term doesn't refetch
// the same course. Cache lives for the lifetime of one pairing run (seed, or one
// import-apply / resync request) — callers create a fresh instance each run.

import { fetchSections, groupByCode, type FetchOpts } from "../shared-oferta/fetcher";
import type { SeccionAPI } from "../shared-oferta/ofertaDeCursosAPI";

export class OfferingsCache {
  private byUrl = new Map<string, Promise<SeccionAPI[]>>();

  /** fetch (once) and cache the raw section list for a URL */
  fetch(url: string, opts?: FetchOpts): Promise<SeccionAPI[]> {
    let p = this.byUrl.get(url);
    if (!p) {
      p = fetchSections(url, opts);
      this.byUrl.set(url, p);
    }
    return p;
  }

  /** fetch a URL and return rows grouped by `class+course` */
  async fetchGrouped(url: string, opts?: FetchOpts): Promise<Map<string, SeccionAPI[]>> {
    return groupByCode(await this.fetch(url, opts));
  }
}
