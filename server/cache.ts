export interface ProductPageCacheData {
  products: any[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  search: string;
  source: string;
  categories?: string[];
}

interface CacheEntry<T> {
  data: T;
  createdAt: number;
}

export const PRODUCTS_FRESH_TTL_MS = 60 * 1000; // 60s fresh cache
export const PRODUCTS_STALE_TTL_MS = 180 * 1000; // up to 3m stale-while-revalidate
export const CATEGORIES_TTL_MS = 10 * 60 * 1000; // 10m vendor categories cache
export const VENDORS_TTL_MS = 15 * 60 * 1000; // 15m stores list cache
export const OWNERSHIP_TTL_MS = 30 * 60 * 1000; // 30m verified product ownership cache

const productPageCache = new Map<string, CacheEntry<ProductPageCacheData>>();
const inFlightProductQueries = new Map<string, Promise<ProductPageCacheData>>();

const vendorCategoriesCache = new Map<number, CacheEntry<string[]>>();
const inFlightCategories = new Map<number, Promise<string[]>>();

// Verified ownership: vendorId -> Map<productId, verifiedAtMs>
const vendorOwnershipMap = new Map<number, Map<number, number>>();

// Per-product update locks to prevent duplicate concurrent mutations on the same product
const productMutationLocks = new Map<number, Promise<any>>();

// Short-lived idempotency cache for identical product updates (prevents double-clicks / duplicate retries)
const recentProductPayloads = new Map<string, { timestamp: number; response: any }>();

export function buildProductCacheKey(vendorId: number, page: number, perPage: number, search: string): string {
  return `${vendorId}:p${page}:pp${perPage}:s${search.trim().toLowerCase()}`;
}

export function getCachedProductPage(key: string): {
  status: 'hit' | 'stale' | 'miss';
  ageMs: number;
  data?: ProductPageCacheData;
} {
  const entry = productPageCache.get(key);
  if (!entry) {
    return { status: 'miss', ageMs: 0 };
  }
  const ageMs = Date.now() - entry.createdAt;
  if (ageMs < PRODUCTS_FRESH_TTL_MS) {
    return { status: 'hit', ageMs, data: entry.data };
  }
  if (ageMs < PRODUCTS_STALE_TTL_MS) {
    return { status: 'stale', ageMs, data: entry.data };
  }
  productPageCache.delete(key);
  return { status: 'miss', ageMs };
}

export function setCachedProductPage(key: string, vendorId: number, data: ProductPageCacheData): void {
  productPageCache.set(key, {
    data,
    createdAt: Date.now(),
  });
  recordVendorProductOwnership(
    vendorId,
    data.products.map((p: any) => Number(p.id)).filter((id: number) => !isNaN(id) && id > 0)
  );
}

// Invalidate ONLY cache keys belonging to a specific vendor (never global clear!)
export function invalidateVendorProductCache(vendorId: number): number {
  const prefix = `${vendorId}:`;
  let removed = 0;
  for (const key of productPageCache.keys()) {
    if (key.startsWith(prefix)) {
      productPageCache.delete(key);
      removed++;
    }
  }
  return removed;
}

// Patch a single updated product in-place across all cached pages of that vendor (avoids refetching catalog!)
export function patchProductInVendorCache(vendorId: number, productId: number, fields: Record<string, any>): void {
  const prefix = `${vendorId}:`;
  for (const [key, entry] of productPageCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    const idx = entry.data.products.findIndex((p: any) => Number(p.id) === Number(productId));
    if (idx !== -1) {
      const existing = entry.data.products[idx];
      entry.data.products[idx] = {
        ...existing,
        ...fields,
        lastModified: new Date().toISOString(),
      };
    }
  }
}

// Patch multiple updated products in-place for a vendor after batch sync
export function patchBatchInVendorCache(vendorId: number, updates: Array<{ id: number; fields: Record<string, any> }>): void {
  const updateMap = new Map<number, Record<string, any>>();
  for (const u of updates) {
    updateMap.set(Number(u.id), u.fields);
  }
  const prefix = `${vendorId}:`;
  for (const [key, entry] of productPageCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    entry.data.products = entry.data.products.map((p: any) => {
      const patch = updateMap.get(Number(p.id));
      return patch ? { ...p, ...patch, lastModified: new Date().toISOString() } : p;
    });
  }
}

export function removeProductFromVendorCache(vendorId: number, productId: number): void {
  const prefix = `${vendorId}:`;
  for (const [key, entry] of productPageCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    const before = entry.data.products.length;
    entry.data.products = entry.data.products.filter((p: any) => Number(p.id) !== Number(productId));
    if (entry.data.products.length !== before && entry.data.total > 0) {
      entry.data.total = Math.max(0, entry.data.total - 1);
    }
  }
  const owned = vendorOwnershipMap.get(vendorId);
  if (owned) owned.delete(Number(productId));
}

// Single-flight deduplication for product queries
export function runSingleFlightProductQuery(
  flightKey: string,
  fetcher: () => Promise<ProductPageCacheData>
): { promise: Promise<ProductPageCacheData>; joinedExisting: boolean } {
  const existing = inFlightProductQueries.get(flightKey);
  if (existing) {
    return { promise: existing, joinedExisting: true };
  }
  const promise = fetcher().finally(() => {
    inFlightProductQueries.delete(flightKey);
  });
  inFlightProductQueries.set(flightKey, promise);
  return { promise, joinedExisting: false };
}

// Categories cache
export function getCachedVendorCategories(vendorId: number): string[] | null {
  const entry = vendorCategoriesCache.get(vendorId);
  if (entry && Date.now() - entry.createdAt < CATEGORIES_TTL_MS) {
    return entry.data;
  }
  return null;
}

export function setCachedVendorCategories(vendorId: number, categories: string[]): void {
  vendorCategoriesCache.set(vendorId, { data: categories, createdAt: Date.now() });
}

export function runSingleFlightCategories(
  vendorId: number,
  fetcher: () => Promise<string[]>
): Promise<string[]> {
  const existing = inFlightCategories.get(vendorId);
  if (existing) return existing;
  const promise = fetcher()
    .then((cats) => {
      setCachedVendorCategories(vendorId, cats);
      return cats;
    })
    .finally(() => {
      inFlightCategories.delete(vendorId);
    });
  inFlightCategories.set(vendorId, promise);
  return promise;
}

// Ownership tracking
export function recordVendorProductOwnership(vendorId: number, productIds: number[]): void {
  let set = vendorOwnershipMap.get(vendorId);
  if (!set) {
    set = new Map<number, number>();
    vendorOwnershipMap.set(vendorId, set);
  }
  const now = Date.now();
  for (const id of productIds) {
    if (id > 0) set.set(id, now);
  }
}

export function hasCachedOwnership(vendorId: number, productId: number): boolean {
  const map = vendorOwnershipMap.get(vendorId);
  if (!map) return false;
  const ts = map.get(Number(productId));
  if (!ts) return false;
  if (Date.now() - ts > OWNERSHIP_TTL_MS) {
    map.delete(Number(productId));
    return false;
  }
  return true;
}

// Per-product mutex lock (non-blocking across different products or vendors)
export async function withProductLock<T>(productId: number, fn: () => Promise<T>): Promise<T> {
  const previous = productMutationLocks.get(productId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  productMutationLocks.set(productId, chained);

  try {
    await previous;
    return await fn();
  } finally {
    release();
    if (productMutationLocks.get(productId) === chained) {
      productMutationLocks.delete(productId);
    }
  }
}

export function getRecentIdempotentResponse(key: string, windowMs = 2500): any | null {
  const entry = recentProductPayloads.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp < windowMs) {
    return entry.response;
  }
  recentProductPayloads.delete(key);
  return null;
}

export function setRecentIdempotentResponse(key: string, response: any): void {
  if (recentProductPayloads.size > 500) {
    const cutoff = Date.now() - 5000;
    for (const [k, v] of recentProductPayloads.entries()) {
      if (v.timestamp < cutoff) recentProductPayloads.delete(k);
    }
  }
  recentProductPayloads.set(key, { timestamp: Date.now(), response });
}

export function getCacheOverview(vendorId?: number) {
  let vendorPages = 0;
  let totalPagesCached = productPageCache.size;
  if (vendorId) {
    const prefix = `${vendorId}:`;
    for (const k of productPageCache.keys()) {
      if (k.startsWith(prefix)) vendorPages++;
    }
  }
  return {
    totalProductPagesCached: totalPagesCached,
    vendorProductPagesCached: vendorId ? vendorPages : undefined,
    inFlightProductQueries: inFlightProductQueries.size,
    activeProductLocks: productMutationLocks.size,
    categoriesCachedCount: vendorCategoriesCache.size,
  };
}
