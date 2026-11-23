import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import {
  buildProductCacheKey,
  getCachedProductPage,
  setCachedProductPage,
  invalidateVendorProductCache,
  patchProductInVendorCache,
  patchBatchInVendorCache,
  removeProductFromVendorCache,
  runSingleFlightProductQuery,
  getCachedVendorCategories,
  runSingleFlightCategories,
  recordVendorProductOwnership,
  hasCachedOwnership,
  withProductLock,
  getRecentIdempotentResponse,
  setRecentIdempotentResponse,
  getCacheOverview,
  PRODUCTS_FRESH_TTL_MS,
  VENDORS_TTL_MS,
} from './server/cache';
import { recordOperationMetric, getDiagnosticsSummary, sanitizeLogMessage } from './server/logger';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const portFromArgs = portArgIndex !== -1 && args[portArgIndex + 1] ? parseInt(args[portArgIndex + 1], 10) : null;
const PORT = portFromArgs || Number(process.env.PORT) || Number(process.env.DEFAULT_APP_PORT) || 3000;

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, status: 'healthy' });
});

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const WC_STORE_URL = (process.env.WC_STORE_URL || 'https://merqba.com').replace(/\/+$/, '');
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY || '';
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET || '';
const WEBHOOK_SIGNING_SECRET =
  process.env.WEBHOOK_SECRET ||
  crypto.createHash('sha256').update(`${WC_STORE_URL}:${WC_CONSUMER_SECRET || 'merqba-default-hmac'}`).digest('hex');

// Minimal REST fields needed by Merqba FA (~60% smaller JSON payload from WordPress)
const DOKAN_PRODUCT_FIELDS = [
  'id',
  'name',
  'slug',
  'permalink',
  'sku',
  'price',
  'regular_price',
  'sale_price',
  'stock_quantity',
  'stock_status',
  'in_stock',
  'manage_stock',
  'images',
  'categories',
  'tags',
  'date_modified',
  'store',
].join(',');

app.use(express.json({ limit: '15mb' }));

// Multi-vendor Session Management (zero plaintext password storage)
interface ActiveSession {
  sessionId: string;
  username: string;
  cookies?: string;
  wpNonce?: string;
  nonceUpdatedAt?: number;
  vendorId: number;
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, ActiveSession>();
const SESSIONS_FILE = path.join(__dirname, '.sessions.json');

function loadSessionsFromFile() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const now = Date.now();
      let hadLegacyPasswords = false;
      if (Array.isArray(data)) {
        for (const sess of data) {
          if (sess && sess.sessionId && sess.expiresAt > now) {
            if ('password' in sess) {
              delete sess.password;
              hadLegacyPasswords = true;
            }
            activeSessions.set(sess.sessionId, sess);
          }
        }
      }
      if (hadLegacyPasswords) {
        saveSessionsToFile();
      }
    }
  } catch (err: any) {
    console.warn('Could not load sessions from file:', err?.message);
  }
}

function saveSessionsToFile() {
  try {
    const list = Array.from(activeSessions.values()).map(({ ...s }) => s);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Could not save sessions to file:', err?.message);
  }
}

function cleanCookieHeader(rawCookies: string | string[] | undefined): string {
  if (!rawCookies) return '';
  const list = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  const map = new Map<string, string>();
  const ignoredAttrs = new Set(['path', 'expires', 'max-age', 'domain', 'samesite', 'secure', 'httponly', 'priority']);

  for (const item of list) {
    const parts = item.split(/;\s*/);
    for (const rawPart of parts) {
      const subParts = rawPart.split(/,\s*(?=[a-zA-Z0-9_%-]+=)/);
      for (const sub of subParts) {
        const trimmed = sub.trim().replace(/^(?:HttpOnly|Secure|SameSite=\w+)\s*,\s*/i, '');
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim();
          const lower = k.toLowerCase();
          if (!ignoredAttrs.has(lower) && !k.includes(' ') && !k.includes(',')) {
            map.set(k, v);
          }
        }
      }
    }
  }

  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// HTTPS WooCommerce REST URL helper (used ONLY server-side when Dokan Lite lacks native endpoint, e.g. batch)
function buildWcApiUrl(endpointPath: string): string {
  const base = `${WC_STORE_URL}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;
  if (!WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}consumer_key=${encodeURIComponent(WC_CONSUMER_KEY)}&consumer_secret=${encodeURIComponent(WC_CONSUMER_SECRET)}`;
}

function getWcAdminHeaders(): Record<string, string> | null {
  if (!WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) return null;
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'MerqbaFA/2.0',
  };
}

async function refreshSessionNonce(session: ActiveSession, force = false): Promise<string | undefined> {
  if (!session.cookies) return undefined;
  const now = Date.now();
  if (!force && session.wpNonce && session.nonceUpdatedAt && now - session.nonceUpdatedAt < 25 * 60 * 1000) {
    return session.wpNonce;
  }
  try {
    const clean = cleanCookieHeader(session.cookies);
    if (!clean) return undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${WC_STORE_URL}/mi-cuenta/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Cookie: clean,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/wpApiSettings\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"/);
      if (m && m[1]) {
        session.wpNonce = m[1];
        session.nonceUpdatedAt = now;
        saveSessionsToFile();
        return m[1];
      }
    }
  } catch (err: any) {
    console.warn('Could not refresh WP REST nonce:', err?.message);
  }
  return session.wpNonce;
}

async function getVendorSessionHeaders(
  session: ActiveSession | null,
  forceRefreshNonce = false
): Promise<Record<string, string> | null> {
  if (!session || !session.cookies) return null;
  const clean = cleanCookieHeader(session.cookies);
  if (!clean) return null;
  const nonce = await refreshSessionNonce(session, forceRefreshNonce);
  if (!nonce) return null;
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'MerqbaFA/2.0',
    Cookie: clean,
    'X-WP-Nonce': nonce,
  };
}

loadSessionsFromFile();

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [id, sess] of activeSessions.entries()) {
    if (sess.expiresAt < now) {
      activeSessions.delete(id);
      changed = true;
    }
  }
  if (changed) saveSessionsToFile();
}, 15 * 60 * 1000);

function getSessionFromRequest(req: express.Request): ActiveSession | null {
  let sessionId: string | undefined;

  const tokenHeader = req.headers['x-session-token'] || req.headers['authorization'];
  if (typeof tokenHeader === 'string') {
    sessionId = tokenHeader.startsWith('Bearer ') ? tokenHeader.slice(7).trim() : tokenHeader.trim();
  }

  if (!sessionId && req.headers.cookie) {
    for (const c of req.headers.cookie.split(';')) {
      const eqIdx = c.indexOf('=');
      if (eqIdx > 0) {
        const k = c.slice(0, eqIdx).trim();
        const v = c.slice(eqIdx + 1).trim();
        if (k === 'merqba_session_token' && v) {
          sessionId = decodeURIComponent(v);
          break;
        }
      }
    }
  }

  if (!sessionId) return null;
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(sessionId);
    saveSessionsToFile();
    return null;
  }

  return session;
}

// Known vendors store (populated on demand and cached for 15 minutes with single-flight)
const knownVendors: Record<number, any> = {};
let vendorsCacheUpdatedAt = 0;
let vendorsFetchInFlight: Promise<Record<number, any>> | null = null;

function mapDokanStoreToVendor(s: any, fallbackId?: number) {
  const storeId = Number(s?.id || fallbackId);
  const addressStr = s?.address
    ? [s.address.street_1, s.address.street_2, s.address.city, s.address.state].filter(Boolean).join(', ')
    : 'Cuba';

  return {
    id: storeId,
    name: `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || s?.store_name || `Tienda #${storeId}`,
    storeName: s?.store_name || `Tienda #${storeId}`,
    email: s?.email || `${s?.slug || 'tienda'}@merqba.com`,
    avatar: s?.gravatar || s?.avatar || 'https://merqba.com/wp-content/plugins/dokan-lite/assets/images/mystery-person.jpg',
    banner: s?.banner || 'https://merqba.com/wp-content/plugins/dokan-lite/assets/images/default-store-banner.png',
    rating: s?.rating?.rating ? parseFloat(s.rating.rating) || 5.0 : 5.0,
    ratingCount: s?.rating?.count || 0,
    storeUrl: s?.shop_url || `${WC_STORE_URL}/store/${storeId}/`,
    phone: s?.phone ? String(s.phone) : '',
    address: addressStr || 'Cuba',
  };
}

async function fetchAllDokanVendors(force = false): Promise<Record<number, any>> {
  const now = Date.now();
  if (!force && vendorsCacheUpdatedAt > 0 && now - vendorsCacheUpdatedAt < VENDORS_TTL_MS) {
    return knownVendors;
  }
  if (vendorsFetchInFlight) {
    return vendorsFetchInFlight;
  }

  vendorsFetchInFlight = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/stores?per_page=100`, {
        headers: { 'User-Agent': 'MerqbaFA/2.0', Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const stores = await res.json();
        if (Array.isArray(stores)) {
          for (const s of stores) {
            if (!s?.id) continue;
            knownVendors[Number(s.id)] = mapDokanStoreToVendor(s);
          }
          vendorsCacheUpdatedAt = Date.now();
        }
      }
    } catch (err: any) {
      console.warn('Error fetching Dokan stores:', err?.message);
    } finally {
      vendorsFetchInFlight = null;
    }
    return knownVendors;
  })();

  return vendorsFetchInFlight;
}

async function getOrFetchSingleVendor(vendorId: number, session?: ActiveSession | null) {
  if (knownVendors[vendorId]) {
    return knownVendors[vendorId];
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/stores/${vendorId}`, {
      headers: { 'User-Agent': 'MerqbaFA/2.0', Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const storeInfo = await res.json();
      const mapped = mapDokanStoreToVendor(storeInfo, vendorId);
      knownVendors[vendorId] = mapped;
      return mapped;
    }
  } catch {
    // ignore single store fallback failure
  }

  if (session) {
    const vendorHeaders = await getVendorSessionHeaders(session, false);
    if (vendorHeaders) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const sRes = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/vendor-settings/store`, {
          headers: vendorHeaders,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (sRes.ok) {
          const settings = await sRes.json();
          const mapped = {
            id: vendorId,
            name: settings?.store_name || session.username,
            storeName: settings?.store_name || `Tienda #${vendorId}`,
            email: session.username.includes('@') ? session.username : `${session.username}@merqba.com`,
            avatar: settings?.gravatar || 'https://merqba.com/wp-content/plugins/dokan-lite/assets/images/mystery-person.jpg',
            banner: settings?.banner || '',
            rating: 5.0,
            ratingCount: 0,
            storeUrl: `${WC_STORE_URL}/store/${vendorId}/`,
            phone: settings?.phone || '',
            address: settings?.address?.city || '',
          };
          knownVendors[vendorId] = mapped;
          return mapped;
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    id: vendorId,
    name: session?.username || `Vendedor #${vendorId}`,
    storeName: `Tienda #${vendorId}`,
    email: '',
    avatar: 'https://merqba.com/wp-content/plugins/dokan-lite/assets/images/mystery-person.jpg',
    banner: '',
    rating: 5.0,
    ratingCount: 0,
    storeUrl: `${WC_STORE_URL}/store/${vendorId}/`,
    phone: '',
    address: '',
  };
}

function mapRawProduct(item: any, vendorId: number) {
  const priceNum =
    item.price !== undefined && item.price !== ''
      ? parseFloat(item.price)
      : item.regular_price !== undefined && item.regular_price !== ''
      ? parseFloat(item.regular_price)
      : 0;
  const regularNum =
    item.regular_price !== undefined && item.regular_price !== '' ? parseFloat(item.regular_price) : priceNum;
  const saleNum = item.sale_price !== undefined && item.sale_price !== '' ? parseFloat(item.sale_price) : undefined;
  const manageStock = Boolean(item.manage_stock);
  const rawQty = item.stock_quantity !== null && item.stock_quantity !== undefined ? Number(item.stock_quantity) : null;
  const inStock = item.in_stock === true || item.stock_status === 'instock' || (rawQty !== null && rawQty > 0);
  const stockStatus = inStock ? 'instock' : 'outofstock';
  const stockQuantity = rawQty !== null ? rawQty : inStock ? 10 : 0;

  const primaryImage =
    (Array.isArray(item.images) && item.images.find((img: any) => img?.is_featured === true)) ||
    item.images?.[0];

  return {
    id: Number(item.id),
    vendorId,
    name: item.name || 'Sin nombre',
    slug: item.slug || undefined,
    permalink: item.permalink || undefined,
    sku: item.sku || `SKU-${item.id}`,
    regularPrice: isNaN(regularNum) ? 0 : regularNum,
    salePrice: saleNum !== undefined && !isNaN(saleNum) ? saleNum : undefined,
    price: isNaN(priceNum) ? 0 : priceNum,
    stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity,
    stockStatus,
    manageStock,
    imageUrl: primaryImage?.src || 'https://merqba.com/wp-content/uploads/2026/05/cropped-merqba-logo-icon.png',
    imageId: primaryImage?.id ? Number(primaryImage.id) : undefined,
    category: item.categories?.[0]?.name || 'General',
    tags: Array.isArray(item.tags) ? item.tags.map((t: any) => t.name) : [],
    lastModified: item.date_modified || new Date().toISOString(),
  };
}

// Build WooCommerce/Dokan featured image payload (position: 0 is REQUIRED so WP sets _thumbnail_id for the shop catalog)
function buildFeaturedImagesPayload(
  imageUrl?: string,
  imageId?: number,
  forDokan = false
): Array<Record<string, any>> | undefined {
  const validId = imageId && Number(imageId) > 0 ? Number(imageId) : undefined;
  const validUrl = imageUrl && String(imageUrl).startsWith('http') ? String(imageUrl) : undefined;
  if (!validId && !validUrl) return undefined;

  const entry: Record<string, any> = { position: 0 };
  if (validId) {
    entry.id = validId;
  } else if (validUrl) {
    entry.src = validUrl;
  }
  if (forDokan) {
    if (validUrl) entry.src = validUrl;
    entry.is_featured = true;
  }
  return [entry];
}

// Verify strict server-side ownership of a single product before any mutation
async function verifySingleProductOwnership(
  session: ActiveSession,
  productId: number
): Promise<{ owned: boolean; externalCalls: number; externalMs: number; notFound?: boolean }> {
  if (hasCachedOwnership(session.vendorId, productId)) {
    return { owned: true, externalCalls: 0, externalMs: 0 };
  }

  let externalCalls = 0;
  let externalMs = 0;

  // 1. Prefer Dokan Lite's native vendor product endpoint (enforces author ownership in WP itself)
  const vendorHeaders = await getVendorSessionHeaders(session, false);
  if (vendorHeaders) {
    const t0 = performance.now();
    externalCalls++;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const dokanRes = await fetch(
        `${WC_STORE_URL}/wp-json/dokan/v1/products/${productId}?_fields=id,store`,
        { method: 'GET', headers: vendorHeaders, signal: controller.signal }
      );
      clearTimeout(timeout);
      externalMs += Math.round(performance.now() - t0);

      if (dokanRes.ok) {
        recordVendorProductOwnership(session.vendorId, [productId]);
        return { owned: true, externalCalls, externalMs };
      }
      if (dokanRes.status === 403) {
        return { owned: false, externalCalls, externalMs };
      }
      if (dokanRes.status === 404) {
        return { owned: false, externalCalls, externalMs, notFound: true };
      }
    } catch {
      externalMs += Math.round(performance.now() - t0);
    }
  }

  // 2. Fallback verification via WC REST API metadata (_dokan_vendor_id / store.id)
  const adminHeaders = getWcAdminHeaders();
  if (adminHeaders) {
    const t1 = performance.now();
    externalCalls++;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const checkRes = await fetch(
        buildWcApiUrl(`/wp-json/wc/v3/products/${productId}?_fields=id,meta_data,store`),
        { method: 'GET', headers: adminHeaders, signal: controller.signal }
      );
      clearTimeout(timeout);
      externalMs += Math.round(performance.now() - t1);

      if (checkRes.status === 404) {
        return { owned: false, externalCalls, externalMs, notFound: true };
      }
      if (checkRes.ok) {
        const existingProd = await checkRes.json();
        const dokanMeta = existingProd?.meta_data?.find(
          (m: any) => m.key === '_dokan_vendor_id' || m.key === 'dokan_vendor' || m.key === '_dokan_store_id'
        )?.value;
        const ownerId = dokanMeta
          ? parseInt(String(dokanMeta), 10)
          : existingProd?.store?.id
          ? Number(existingProd.store.id)
          : null;
        if (ownerId && ownerId === session.vendorId) {
          recordVendorProductOwnership(session.vendorId, [productId]);
          return { owned: true, externalCalls, externalMs };
        }
        return { owned: false, externalCalls, externalMs };
      }
    } catch {
      externalMs += Math.round(performance.now() - t1);
    }
  }

  return { owned: false, externalCalls, externalMs };
}

// Verify batch ownership in minimum HTTP requests (1 WC `include=` call for all uncached IDs)
async function verifyBatchOwnership(
  session: ActiveSession,
  productIds: number[]
): Promise<{ allOwned: boolean; unauthorizedId?: number; externalCalls: number; externalMs: number }> {
  const uncachedIds = Array.from(new Set(productIds)).filter((id) => !hasCachedOwnership(session.vendorId, id));
  if (uncachedIds.length === 0) {
    return { allOwned: true, externalCalls: 0, externalMs: 0 };
  }

  let externalCalls = 0;
  let externalMs = 0;
  const adminHeaders = getWcAdminHeaders();
  if (!adminHeaders) {
    return { allOwned: false, unauthorizedId: uncachedIds[0], externalCalls, externalMs };
  }

  for (let i = 0; i < uncachedIds.length; i += 100) {
    const chunk = uncachedIds.slice(i, i + 100);
    const t0 = performance.now();
    externalCalls++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const checkRes = await fetch(
        buildWcApiUrl(`/wp-json/wc/v3/products?include=${chunk.join(',')}&per_page=${chunk.length}&_fields=id,meta_data,store`),
        { method: 'GET', headers: adminHeaders, signal: controller.signal }
      );
      clearTimeout(timeout);
      externalMs += Math.round(performance.now() - t0);

      if (!checkRes.ok) {
        return { allOwned: false, unauthorizedId: chunk[0], externalCalls, externalMs };
      }
      const rows = await checkRes.json();
      if (!Array.isArray(rows)) {
        return { allOwned: false, unauthorizedId: chunk[0], externalCalls, externalMs };
      }
      const rowMap = new Map<number, any>();
      for (const r of rows) rowMap.set(Number(r.id), r);

      const verifiedIds: number[] = [];
      for (const id of chunk) {
        const prod = rowMap.get(id);
        if (!prod) {
          return { allOwned: false, unauthorizedId: id, externalCalls, externalMs };
        }
        const dokanMeta = prod?.meta_data?.find(
          (m: any) => m.key === '_dokan_vendor_id' || m.key === 'dokan_vendor' || m.key === '_dokan_store_id'
        )?.value;
        const ownerId = dokanMeta ? parseInt(String(dokanMeta), 10) : prod?.store?.id ? Number(prod.store.id) : null;
        if (!ownerId || ownerId !== session.vendorId) {
          return { allOwned: false, unauthorizedId: id, externalCalls, externalMs };
        }
        verifiedIds.push(id);
      }
      recordVendorProductOwnership(session.vendorId, verifiedIds);
    } catch {
      clearTimeout(timeout);
      externalMs += Math.round(performance.now() - t0);
      return { allOwned: false, unauthorizedId: chunk[0], externalCalls, externalMs };
    }
  }

  return { allOwned: true, externalCalls, externalMs };
}

// 1. Public connection status (hides keys)
app.get('/api/woocommerce/status', (req, res) => {
  const session = getSessionFromRequest(req);
  res.json({
    status: 'configured',
    storeUrl: WC_STORE_URL,
    hasCredentials: Boolean(WC_CONSUMER_KEY && WC_CONSUMER_SECRET),
    appName: 'Merqba FA',
    isAuthenticated: Boolean(session),
    activeVendorId: session?.vendorId || null,
    serverTime: new Date().toISOString(),
  });
});

// 1b. Strict Vendor Authentication (resolves real WordPress user & Dokan store, no password persisted)
app.post('/api/woocommerce/login', async (req, res) => {
  const start = performance.now();
  const { username, password } = req.body;
  let externalRequests = 0;
  let externalDurationMs = 0;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Por favor, ingresa tu usuario o correo y tu contraseña de Merqba.',
    });
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();

  try {
    let isWcSuccess = false;
    let wcErrorMessage: string | null = null;
    let postCookiesRaw: string | string[] = '';

    // 1. WordPress form login via /mi-cuenta/
    const tLogin = performance.now();
    try {
      externalRequests++;
      const initial = await fetch(`${WC_STORE_URL}/mi-cuenta/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      const html = await initial.text();
      const initialSetCookies = (initial.headers as any).getSetCookie?.() || initial.headers.get('set-cookie') || '';
      const cookies = cleanCookieHeader(initialSetCookies);
      const nonceMatch = html.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/);
      const nonce = nonceMatch ? nonceMatch[1] : '';

      const params = new URLSearchParams();
      params.append('username', cleanUser);
      params.append('password', cleanPass);
      params.append('woocommerce-login-nonce', nonce);
      params.append('_wp_http_referer', '/mi-cuenta/');
      params.append('login', 'Acceder');

      externalRequests++;
      const postRes = await fetch(`${WC_STORE_URL}/mi-cuenta/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Cookie: cookies,
          Referer: `${WC_STORE_URL}/mi-cuenta/`,
        },
        body: params.toString(),
        redirect: 'manual',
      });

      const getSetCookie = (postRes.headers as any).getSetCookie;
      postCookiesRaw = typeof getSetCookie === 'function' ? getSetCookie.call(postRes.headers) : postRes.headers.get('set-cookie') || '';
      const joinedCookies = Array.isArray(postCookiesRaw) ? postCookiesRaw.join('; ') : postCookiesRaw;
      isWcSuccess = joinedCookies.includes('wordpress_logged_in') || postRes.status === 302;

      if (!isWcSuccess) {
        const postHtml = await postRes.text();
        const errorMatch = postHtml.match(/<ul class="woocommerce-error"[^>]*>([\s\S]*?)<\/ul>/);
        if (errorMatch) {
          wcErrorMessage = errorMatch[1].replace(/<[^>]+>/g, '').trim();
        }
      }
    } catch (e: any) {
      console.warn('Merqba form login check failed:', e?.message);
    }
    externalDurationMs += Math.round(performance.now() - tLogin);

    if (!isWcSuccess) {
      recordOperationMetric({
        endpoint: '/api/woocommerce/login',
        opType: 'auth_login',
        vendorId: null,
        durationMs: Math.round(performance.now() - start),
        externalRequests,
        externalDurationMs,
        productsCount: 0,
        httpStatus: 401,
        cacheStatus: 'n/a',
        error: wcErrorMessage || 'Invalid credentials',
      });
      return res.status(401).json({
        success: false,
        message: wcErrorMessage || 'Usuario o contraseña incorrectos en Merqba.',
      });
    }

    const cleanedCookies = cleanCookieHeader(postCookiesRaw);
    if (!cleanedCookies) {
      return res.status(401).json({
        success: false,
        message: 'No se recibió sesión válida desde Merqba.',
      });
    }

    // 2. Fetch WP REST nonce
    let initialNonce: string | undefined;
    const tNonce = performance.now();
    try {
      externalRequests++;
      const accRes = await fetch(`${WC_STORE_URL}/mi-cuenta/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Cookie: cleanedCookies,
        },
      });
      if (accRes.ok) {
        const accHtml = await accRes.text();
        const nm = accHtml.match(/wpApiSettings\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"/);
        if (nm && nm[1]) initialNonce = nm[1];
      }
    } catch {
      // handled below
    }
    externalDurationMs += Math.round(performance.now() - tNonce);

    // 3. Strictly resolve WordPress user ID via /wp-json/wp/v2/users/me (no substring guessing!)
    let realUserId: number | null = null;
    if (initialNonce) {
      const tMe = performance.now();
      try {
        externalRequests++;
        const meRes = await fetch(`${WC_STORE_URL}/wp-json/wp/v2/users/me`, {
          headers: {
            Cookie: cleanedCookies,
            'X-WP-Nonce': initialNonce,
            'User-Agent': 'MerqbaFA/2.0',
            Accept: 'application/json',
          },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData && meData.id) {
            realUserId = Number(meData.id);
          }
        }
      } catch (meErr: any) {
        console.warn('Failed wp/v2/users/me:', meErr?.message);
      }
      externalDurationMs += Math.round(performance.now() - tMe);
    }

    if (!realUserId) {
      recordOperationMetric({
        endpoint: '/api/woocommerce/login',
        opType: 'auth_login',
        vendorId: null,
        durationMs: Math.round(performance.now() - start),
        externalRequests,
        externalDurationMs,
        productsCount: 0,
        httpStatus: 403,
        cacheStatus: 'n/a',
        error: 'Could not verify WordPress user ID',
      });
      return res.status(403).json({
        success: false,
        message: 'No se pudo verificar la identidad de tu tienda en el servidor. Inténtalo de nuevo.',
      });
    }

    // 4. Verify vendor store strictly via Dokan Lite (non-blocking against global stores)
    const tStore = performance.now();
    externalRequests++;
    const matchedVendor = await getOrFetchSingleVendor(realUserId, {
      sessionId: 'temp',
      username: cleanUser,
      cookies: cleanedCookies,
      wpNonce: initialNonce,
      vendorId: realUserId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });
    externalDurationMs += Math.round(performance.now() - tStore);

    const sessionId = 'merqba_sess_' + crypto.randomBytes(32).toString('hex');
    const newSession: ActiveSession = {
      sessionId,
      username: cleanUser,
      cookies: cleanedCookies,
      wpNonce: initialNonce,
      nonceUpdatedAt: initialNonce ? Date.now() : undefined,
      vendorId: realUserId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    activeSessions.set(sessionId, newSession);
    saveSessionsToFile();

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('merqba_session_token', sessionId, {
      httpOnly: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    });

    recordOperationMetric({
      endpoint: '/api/woocommerce/login',
      opType: 'auth_login',
      vendorId: realUserId,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: 0,
      httpStatus: 200,
      cacheStatus: 'n/a',
    });

    return res.json({
      success: true,
      sessionToken: sessionId,
      message: `Sesión verificada con éxito para ${cleanUser}`,
      vendor: matchedVendor,
    });
  } catch (err: any) {
    recordOperationMetric({
      endpoint: '/api/woocommerce/login',
      opType: 'auth_login',
      vendorId: null,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: 0,
      httpStatus: 500,
      cacheStatus: 'n/a',
      error: err?.message,
    });
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error al contactar al servidor de Merqba. Inténtalo nuevamente.',
    });
  }
});

app.post('/api/woocommerce/logout', (req, res) => {
  const session = getSessionFromRequest(req);
  if (session) {
    activeSessions.delete(session.sessionId);
    saveSessionsToFile();
  }
  res.clearCookie('merqba_session_token', { path: '/' });
  res.json({ success: true, message: 'Sesión cerrada correctamente.' });
});

// Fetch vendor categories (cached 10m with single-flight)
async function fetchVendorCategories(vendorId: number): Promise<{ categories: string[]; externalCalls: number; externalMs: number }> {
  const cached = getCachedVendorCategories(vendorId);
  if (cached) {
    return { categories: cached, externalCalls: 0, externalMs: 0 };
  }
  let externalCalls = 0;
  let externalMs = 0;
  const categories = await runSingleFlightCategories(vendorId, async () => {
    const t0 = performance.now();
    externalCalls++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/stores/${vendorId}/categories`, {
        headers: { 'User-Agent': 'MerqbaFA/2.0', Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      externalMs += Math.round(performance.now() - t0);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          return list
            .map((c: any) => String(c?.name || '').trim())
            .filter(Boolean);
        }
      }
    } catch {
      clearTimeout(timeout);
      externalMs += Math.round(performance.now() - t0);
    }
    return [];
  });
  return { categories, externalCalls, externalMs };
}

// Execute Dokan Store paginated fetch with _fields optimization (NO global wc/v3 fallback!)
async function fetchDokanStorePage(
  session: ActiveSession,
  vendorId: number,
  page: number,
  perPage: number,
  search: string
): Promise<{
  products: any[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  search: string;
  source: string;
  categories: string[];
  externalRequests: number;
  externalDurationMs: number;
}> {
  let externalRequests = 0;
  let externalDurationMs = 0;

  const queryParams = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    _fields: DOKAN_PRODUCT_FIELDS,
  });
  if (search.trim()) {
    queryParams.set('search', search.trim());
  }

  const dokanHeaders: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'MerqbaFA/2.0',
  };
  const vendorHeaders = await getVendorSessionHeaders(session, false);
  if (vendorHeaders?.Cookie) dokanHeaders['Cookie'] = vendorHeaders.Cookie;
  if (vendorHeaders?.['X-WP-Nonce']) dokanHeaders['X-WP-Nonce'] = vendorHeaders['X-WP-Nonce'];

  const dokanUrl = `${WC_STORE_URL}/wp-json/dokan/v1/stores/${vendorId}/products?${queryParams.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const t0 = performance.now();
  externalRequests++;

  const response = await fetch(dokanUrl, {
    method: 'GET',
    headers: dokanHeaders,
    signal: controller.signal,
  });
  clearTimeout(timeout);
  externalDurationMs += Math.round(performance.now() - t0);

  if (response.status === 400) {
    // WordPress returns 400 rest_post_invalid_page_number if page exceeds totalPages
    const errText = await response.text().catch(() => '');
    if (errText.includes('rest_post_invalid_page_number')) {
      const catInfo = await fetchVendorCategories(vendorId);
      return {
        products: [],
        total: 0,
        totalPages: 0,
        page,
        perPage,
        search,
        source: 'live_dokan_store',
        categories: catInfo.categories,
        externalRequests: externalRequests + catInfo.externalCalls,
        externalDurationMs: externalDurationMs + catInfo.externalMs,
      };
    }
    throw new Error(`Dokan HTTP 400: ${errText.slice(0, 180)}`);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    const err: any = new Error(`Error al consultar productos de la tienda (HTTP ${response.status})`);
    err.httpStatus = response.status === 401 || response.status === 403 ? response.status : 502;
    err.detail = errBody.slice(0, 180);
    throw err;
  }

  const pageData = await response.json();
  if (!Array.isArray(pageData)) {
    throw new Error('Formato de respuesta inesperado al consultar productos.');
  }

  const totalHeader = parseInt(response.headers.get('x-wp-total') || '', 10);
  const totalPagesHeader = parseInt(response.headers.get('x-wp-totalpages') || '', 10);
  const total = !isNaN(totalHeader) ? totalHeader : pageData.length;
  const totalPages = !isNaN(totalPagesHeader) ? totalPagesHeader : total > 0 ? Math.ceil(total / perPage) : 0;

  const mapped = pageData.map((item: any) => mapRawProduct(item, vendorId));
  const catInfo = await fetchVendorCategories(vendorId);
  externalRequests += catInfo.externalCalls;
  externalDurationMs += catInfo.externalMs;

  return {
    products: mapped,
    total,
    totalPages,
    page,
    perPage,
    search,
    source: 'live_dokan_store',
    categories: catInfo.categories,
    externalRequests,
    externalDurationMs,
  };
}

// 2. Paginated, Authenticated, Strictly Isolated Products Endpoint
app.get('/api/woocommerce/products', async (req, res) => {
  const start = performance.now();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      authRequired: true,
      message: 'Acceso no autorizado. Inicia sesión para consultar tu inventario.',
    });
  }

  // Strict multi-vendor isolation: NEVER allow reading another vendor's catalog
  if (req.query.vendor_id !== undefined) {
    const requestedVendorId = parseInt(String(req.query.vendor_id), 10);
    if (!isNaN(requestedVendorId) && requestedVendorId !== session.vendorId) {
      recordOperationMetric({
        endpoint: '/api/woocommerce/products',
        opType: 'products_list_forbidden',
        vendorId: session.vendorId,
        durationMs: Math.round(performance.now() - start),
        externalRequests: 0,
        externalDurationMs: 0,
        productsCount: 0,
        httpStatus: 403,
        cacheStatus: 'n/a',
        error: `Attempted cross-vendor read for vendor #${requestedVendorId}`,
      });
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para consultar el inventario de otra tienda.',
      });
    }
  }

  const vendorId = session.vendorId;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.per_page || '50'), 10) || 50));
  const search = String(req.query.search || '').trim();
  const isForcedRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  const cacheKey = buildProductCacheKey(vendorId, page, perPage, search);
  const cached = getCachedProductPage(cacheKey);

  // Return fresh cache hit directly
  if (!isForcedRefresh && cached.status === 'hit' && cached.data) {
    const vendorObj = await getOrFetchSingleVendor(vendorId, session);
    recordOperationMetric({
      endpoint: '/api/woocommerce/products',
      opType: 'products_list',
      vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests: 0,
      externalDurationMs: 0,
      productsCount: cached.data.products.length,
      httpStatus: 200,
      cacheStatus: 'hit',
    });
    return res.json({
      success: true,
      ...cached.data,
      count: cached.data.products.length,
      vendors: [vendorObj],
      cache: { status: 'hit', ageMs: cached.ageMs, ttlMs: PRODUCTS_FRESH_TTL_MS },
    });
  }

  // Stale-while-revalidate: serve stale cache immediately and refresh once in background via single-flight
  if (!isForcedRefresh && cached.status === 'stale' && cached.data) {
    runSingleFlightProductQuery(`${cacheKey}:bg`, async () => {
      const fresh = await fetchDokanStorePage(session, vendorId, page, perPage, search);
      const payload = {
        products: fresh.products,
        total: fresh.total,
        totalPages: fresh.totalPages,
        page: fresh.page,
        perPage: fresh.perPage,
        search: fresh.search,
        source: fresh.source,
        categories: fresh.categories,
      };
      setCachedProductPage(cacheKey, vendorId, payload);
      return payload;
    }).promise.catch((err) => console.warn('[SWR] Background refresh warning:', err?.message));

    const vendorObj = await getOrFetchSingleVendor(vendorId, session);
    recordOperationMetric({
      endpoint: '/api/woocommerce/products',
      opType: 'products_list',
      vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests: 0,
      externalDurationMs: 0,
      productsCount: cached.data.products.length,
      httpStatus: 200,
      cacheStatus: 'stale',
    });
    return res.json({
      success: true,
      ...cached.data,
      count: cached.data.products.length,
      vendors: [vendorObj],
      cache: { status: 'stale', ageMs: cached.ageMs, ttlMs: PRODUCTS_FRESH_TTL_MS, revalidating: true },
    });
  }

  // Cache miss or manual forced refresh -> single-flight deduplication prevents stampedes
  const flightKey = isForcedRefresh ? `${cacheKey}:force` : cacheKey;
  let extReqs = 0;
  let extMs = 0;

  try {
    const { promise, joinedExisting } = runSingleFlightProductQuery(flightKey, async () => {
      const fetched = await fetchDokanStorePage(session, vendorId, page, perPage, search);
      extReqs = fetched.externalRequests;
      extMs = fetched.externalDurationMs;
      const payload = {
        products: fetched.products,
        total: fetched.total,
        totalPages: fetched.totalPages,
        page: fetched.page,
        perPage: fetched.perPage,
        search: fetched.search,
        source: fetched.source,
        categories: fetched.categories,
      };
      setCachedProductPage(cacheKey, vendorId, payload);
      return payload;
    });

    const data = await promise;
    const vendorObj = await getOrFetchSingleVendor(vendorId, session);

    recordOperationMetric({
      endpoint: '/api/woocommerce/products',
      opType: isForcedRefresh ? 'products_list_refresh' : 'products_list',
      vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests: joinedExisting ? 0 : extReqs,
      externalDurationMs: joinedExisting ? 0 : extMs,
      productsCount: data.products.length,
      httpStatus: 200,
      cacheStatus: isForcedRefresh ? 'bypass' : 'miss',
    });

    return res.json({
      success: true,
      ...data,
      count: data.products.length,
      vendors: [vendorObj],
      cache: {
        status: isForcedRefresh ? 'bypass' : 'miss',
        ageMs: 0,
        ttlMs: PRODUCTS_FRESH_TTL_MS,
        deduplicatedInFlight: joinedExisting,
      },
    });
  } catch (err: any) {
    const status = err?.httpStatus || 502;
    recordOperationMetric({
      endpoint: '/api/woocommerce/products',
      opType: 'products_list',
      vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests: extReqs,
      externalDurationMs: extMs,
      productsCount: 0,
      httpStatus: status,
      cacheStatus: 'miss',
      error: err?.message || 'Fetch error',
    });

    return res.status(status).json({
      success: false,
      message: 'No se pudo cargar el inventario desde tu tienda. Intenta nuevamente en unos segundos.',
      errorDetail: sanitizeLogMessage(err?.message || ''),
    });
  }
});

// 2b. Dedicated Vendor Categories Endpoint (cached)
app.get('/api/woocommerce/categories', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Sesión requerida.' });
  }
  const info = await fetchVendorCategories(session.vendorId);
  return res.json({ success: true, categories: info.categories });
});

// 3. Upload Product Image via WordPress REST /wp/v2/media (no xmlrpc hardcoded credentials!)
app.post('/api/woocommerce/upload-image', async (req, res) => {
  const start = performance.now();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Sesión no válida o expirada. Inicia sesión.' });
  }

  const rawBase64 = req.body?.base64 || req.body?.fileData;
  const { filename, productId } = req.body;

  if (!rawBase64 || typeof rawBase64 !== 'string') {
    return res.status(400).json({ success: false, message: 'Se requiere la imagen codificada en base64.' });
  }

  let externalRequests = 0;
  let externalDurationMs = 0;

  try {
    if (productId) {
      const own = await verifySingleProductOwnership(session, Number(productId));
      externalRequests += own.externalCalls;
      externalDurationMs += own.externalMs;
      if (!own.owned) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar la imagen de este producto.',
        });
      }
    }

    const mimeMatch = rawBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : req.body?.mimeType || 'image/jpeg';
    const ext = (mimeType.split('/')[1] || 'jpeg').replace(/[^a-zA-Z0-9]/g, '');
    const safeFileName = (filename || `merqba_prod_${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');

    const base64Data = rawBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Tamaño de imagen inválido (máximo 10MB).' });
    }

    let uploadedMediaUrl = '';
    let uploadedMediaId: number | undefined;
    let uploadMethod = 'local_fallback';

    // Upload natively to WordPress Media Library using authenticated vendor Cookie + X-WP-Nonce
    const vendorHeaders = await getVendorSessionHeaders(session, false);
    if (vendorHeaders?.Cookie && vendorHeaders?.['X-WP-Nonce']) {
      const tMedia = performance.now();
      externalRequests++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const wpMediaRes = await fetch(`${WC_STORE_URL}/wp-json/wp/v2/media`, {
          method: 'POST',
          headers: {
            Cookie: vendorHeaders.Cookie,
            'X-WP-Nonce': vendorHeaders['X-WP-Nonce'],
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${safeFileName}"`,
            Accept: 'application/json',
            'User-Agent': 'MerqbaFA/2.0',
          },
          body: buffer,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        externalDurationMs += Math.round(performance.now() - tMedia);

        if (wpMediaRes.ok) {
          const mediaJson = await wpMediaRes.json();
          if (mediaJson?.source_url) {
            uploadedMediaUrl = mediaJson.source_url;
            uploadedMediaId = Number(mediaJson.id);
            uploadMethod = 'wordpress_rest_media';
          }
        }
      } catch (mediaErr: any) {
        externalDurationMs += Math.round(performance.now() - tMedia);
        console.warn('WP REST media upload notice:', mediaErr?.message);
      }
    }

    if (!uploadedMediaUrl) {
      const localSavedPath = path.join(uploadsDir, safeFileName);
      fs.writeFileSync(localSavedPath, buffer);
      uploadedMediaUrl = `/uploads/${safeFileName}`;
    }

    // Attach to product as Featured Image (_thumbnail_id via position: 0) ONLY if WordPress generated a public URL/ID
    if (productId && uploadMethod === 'wordpress_rest_media' && (uploadedMediaUrl.startsWith('http') || uploadedMediaId)) {
      const dokanImages = buildFeaturedImagesPayload(uploadedMediaUrl, uploadedMediaId, true);
      const wcImages = buildFeaturedImagesPayload(uploadedMediaUrl, uploadedMediaId, false);

      let attached = false;
      if (vendorHeaders && dokanImages) {
        const tAttach = performance.now();
        externalRequests++;
        try {
          const dokanAttach = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/products/${productId}`, {
            method: 'PUT',
            headers: vendorHeaders,
            body: JSON.stringify({ images: dokanImages }),
          });
          externalDurationMs += Math.round(performance.now() - tAttach);
          if (dokanAttach.ok) {
            const dokanJson = await dokanAttach.json().catch(() => null);
            const isFeaturedConfirmed =
              Array.isArray(dokanJson?.images) &&
              dokanJson.images.some((img: any) => img?.is_featured === true);
            attached = isFeaturedConfirmed;
          }
        } catch {
          externalDurationMs += Math.round(performance.now() - tAttach);
        }
      }

      const adminHeaders = getWcAdminHeaders();
      if (!attached && adminHeaders && wcImages) {
        const tAttachWc = performance.now();
        externalRequests++;
        try {
          const wcAttach = await fetch(buildWcApiUrl(`/wp-json/wc/v3/products/${productId}`), {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ images: wcImages }),
          });
          externalDurationMs += Math.round(performance.now() - tAttachWc);
          attached = wcAttach.ok;
        } catch {
          externalDurationMs += Math.round(performance.now() - tAttachWc);
        }
      }

      if (attached) {
        patchProductInVendorCache(session.vendorId, Number(productId), {
          imageUrl: uploadedMediaUrl,
          ...(uploadedMediaId ? { imageId: uploadedMediaId } : {}),
        });
      }
    }

    recordOperationMetric({
      endpoint: '/api/woocommerce/upload-image',
      opType: 'upload_image',
      vendorId: session.vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: productId ? 1 : 0,
      httpStatus: 200,
      cacheStatus: 'n/a',
    });

    return res.json({
      success: true,
      url: uploadedMediaUrl,
      id: uploadedMediaId,
      uploadMethod,
      message:
        uploadMethod === 'wordpress_rest_media'
          ? 'Imagen guardada correctamente en tu tienda.'
          : 'Imagen guardada localmente como vista previa.',
    });
  } catch (err: any) {
    recordOperationMetric({
      endpoint: '/api/woocommerce/upload-image',
      opType: 'upload_image',
      vendorId: session.vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: 0,
      httpStatus: 500,
      cacheStatus: 'n/a',
      error: err?.message,
    });
    return res.status(500).json({
      success: false,
      message: 'Error al procesar la imagen: ' + (err?.message || 'Error desconocido'),
    });
  }
});

// 4. Chunked, Ownership-Verified Batch Sync (/api/woocommerce/batch)
app.post('/api/woocommerce/batch', async (req, res) => {
  const start = performance.now();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, authRequired: true, error: 'Acceso no autorizado. Inicia sesión.' });
  }

  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, savedToWooCommerce: false, message: 'No se recibieron productos modificados.' });
  }

  let externalRequests = 0;
  let externalDurationMs = 0;

  // Enforce server-side ownership verification against WordPress/cache (never trust p.vendorId from browser!)
  const updateCandidateIds = products
    .filter((p: any) => p.isNew !== true && Number(p.id) > 0)
    .map((p: any) => Number(p.id));

  const ownCheck = await verifyBatchOwnership(session, updateCandidateIds);
  externalRequests += ownCheck.externalCalls;
  externalDurationMs += ownCheck.externalMs;

  if (!ownCheck.allOwned) {
    recordOperationMetric({
      endpoint: '/api/woocommerce/batch',
      opType: 'batch_forbidden',
      vendorId: session.vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: products.length,
      httpStatus: 403,
      cacheStatus: 'n/a',
      error: `Unauthorized product #${ownCheck.unauthorizedId}`,
    });
    return res.status(403).json({
      success: false,
      savedToWooCommerce: false,
      message: `No tienes permiso para modificar el producto #${ownCheck.unauthorizedId}.`,
    });
  }

  const createItems = products
    .filter((p: any) => p.isNew === true)
    .map((p: any) => ({
      name: p.name,
      regular_price: String(p.regularPrice !== undefined ? p.regularPrice : p.price),
      sale_price: p.salePrice !== undefined && p.salePrice !== null && p.salePrice !== '' ? String(p.salePrice) : undefined,
      manage_stock: true,
      stock_quantity: p.stockQuantity,
      stock_status: p.stockQuantity > 0 ? 'instock' : 'outofstock',
      sku: p.sku,
      images: buildFeaturedImagesPayload(p.imageUrl, p.imageId, false),
      categories: p.category ? [{ name: p.category }] : undefined,
      meta_data: [{ key: '_dokan_vendor_id', value: String(session.vendorId) }],
    }));

  const updateItems = products
    .filter((p: any) => p.isNew !== true && Number(p.id) > 0)
    .map((p: any) => {
      const payloadItem: Record<string, any> = { id: Number(p.id) };
      if (p.name !== undefined) payloadItem.name = p.name;
      const finalRegular =
        p.regularPrice !== undefined && p.regularPrice !== null && p.regularPrice !== ''
          ? String(p.regularPrice)
          : p.price !== undefined && p.price !== null && p.price !== ''
          ? String(p.price)
          : undefined;
      if (finalRegular !== undefined) payloadItem.regular_price = finalRegular;
      if ('salePrice' in p) {
        payloadItem.sale_price =
          p.salePrice !== undefined && p.salePrice !== null && p.salePrice !== '' ? String(p.salePrice) : '';
      }
      if (p.stockStatus !== undefined || p.stockQuantity !== undefined) {
        const isInstock = p.stockStatus === 'instock' || (p.stockStatus === undefined && Number(p.stockQuantity) > 0);
        const qty = isInstock ? (Number(p.stockQuantity) > 0 ? Number(p.stockQuantity) : 10) : 0;
        payloadItem.manage_stock = true;
        payloadItem.stock_quantity = qty;
        payloadItem.stock_status = isInstock ? 'instock' : 'outofstock';
      }
      const batchImages = buildFeaturedImagesPayload(p.imageUrl, p.imageId, false);
      if (batchImages) {
        payloadItem.images = batchImages;
      }
      return payloadItem;
    });

  const adminHeaders = getWcAdminHeaders();
  if (!adminHeaders) {
    return res.status(503).json({
      success: false,
      savedToWooCommerce: false,
      message: 'Configuración de sincronización en lote no disponible en el servidor.',
    });
  }

  const MAX_CHUNK_SIZE = 50; // Safe chunk size under WooCommerce's 100-item hard cap
  const totalOperations = createItems.length + updateItems.length;
  const succeededIds: number[] = [];
  const failedItems: Array<{ id: number; error: string }> = [];
  const cachePatches: Array<{ id: number; fields: Record<string, any> }> = [];
  let createdCount = 0;
  let lastErrorDetail = '';

  const chunks: Array<{ create?: any[]; update?: any[] }> = [];
  for (let i = 0; i < updateItems.length; i += MAX_CHUNK_SIZE) {
    chunks.push({ update: updateItems.slice(i, i + MAX_CHUNK_SIZE) });
  }
  for (let i = 0; i < createItems.length; i += MAX_CHUNK_SIZE) {
    chunks.push({ create: createItems.slice(i, i + MAX_CHUNK_SIZE) });
  }

  for (const chunkPayload of chunks) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    const tBatch = performance.now();
    externalRequests++;

    try {
      const response = await fetch(buildWcApiUrl('/wp-json/wc/v3/products/batch'), {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(chunkPayload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      externalDurationMs += Math.round(performance.now() - tBatch);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        lastErrorDetail = `HTTP ${response.status}: ${sanitizeLogMessage(errText).slice(0, 180)}`;
        for (const u of chunkPayload.update || []) {
          failedItems.push({ id: Number(u.id), error: lastErrorDetail });
        }
        continue;
      }

      const responseData = await response.json();
      const updatedResults = Array.isArray(responseData?.update) ? responseData.update : [];
      const createdResults = Array.isArray(responseData?.create) ? responseData.create : [];

      for (const item of updatedResults) {
        const itemId = Number(item?.id);
        if (item?.error) {
          failedItems.push({ id: itemId, error: item.error.message || 'Error al actualizar ítem' });
        } else if (itemId > 0) {
          succeededIds.push(itemId);
          const reg = item.regular_price !== undefined && item.regular_price !== '' ? parseFloat(item.regular_price) : undefined;
          const sale = item.sale_price !== undefined && item.sale_price !== '' ? parseFloat(item.sale_price) : undefined;
          const pr = item.price !== undefined && item.price !== '' ? parseFloat(item.price) : sale ?? reg;
          const patchFields: Record<string, any> = {};
          if (item.name) patchFields.name = item.name;
          if (reg !== undefined && !isNaN(reg)) patchFields.regularPrice = reg;
          if (pr !== undefined && !isNaN(pr)) patchFields.price = pr;
          patchFields.salePrice = sale !== undefined && !isNaN(sale) ? sale : undefined;
          if (item.stock_status) patchFields.stockStatus = item.stock_status;
          if (item.stock_quantity !== undefined && item.stock_quantity !== null) patchFields.stockQuantity = Number(item.stock_quantity);
          cachePatches.push({ id: itemId, fields: patchFields });
        }
      }

      for (const cr of createdResults) {
        if (cr?.error) {
          failedItems.push({ id: 0, error: cr.error.message || 'Error al crear producto en lote' });
        } else if (cr?.id) {
          createdCount++;
          recordVendorProductOwnership(session.vendorId, [Number(cr.id)]);
        }
      }
    } catch (err: any) {
      clearTimeout(timeout);
      externalDurationMs += Math.round(performance.now() - tBatch);
      lastErrorDetail = sanitizeLogMessage(err?.message || 'Timeout de red');
      for (const u of chunkPayload.update || []) {
        failedItems.push({ id: Number(u.id), error: lastErrorDetail });
      }
    }
  }

  // Coherent vendor-only cache update (never invalidates other vendors!)
  if (cachePatches.length > 0) {
    patchBatchInVendorCache(session.vendorId, cachePatches);
  }
  if (createdCount > 0) {
    invalidateVendorProductCache(session.vendorId);
  }

  const allSucceeded = failedItems.length === 0 && succeededIds.length + createdCount > 0;
  const partialSuccess = failedItems.length > 0 && succeededIds.length + createdCount > 0;
  const httpStatus = allSucceeded ? 200 : partialSuccess ? 207 : 502;

  recordOperationMetric({
    endpoint: '/api/woocommerce/batch',
    opType: 'batch_sync',
    vendorId: session.vendorId,
    durationMs: Math.round(performance.now() - start),
    externalRequests,
    externalDurationMs,
    productsCount: totalOperations,
    httpStatus,
    cacheStatus: 'n/a',
    error: failedItems.length > 0 ? `${failedItems.length} failed: ${lastErrorDetail}` : undefined,
  });

  if (allSucceeded) {
    return res.json({
      success: true,
      statusCode: 200,
      savedToWooCommerce: true,
      partialSuccess: false,
      succeededIds,
      failedItems: [],
      message: `${succeededIds.length + createdCount} productos guardados correctamente en tu tienda.`,
    });
  }

  return res.status(httpStatus).json({
    success: false,
    statusCode: httpStatus,
    savedToWooCommerce: false,
    partialSuccess,
    succeededIds,
    failedItems,
    message: partialSuccess
      ? `${succeededIds.length + createdCount} guardados, pero ${failedItems.length} productos fallaron al sincronizarse.`
      : 'No se pudieron guardar los cambios en la tienda. Verifica tu conexión e inténtalo de nuevo.',
    errorDetail: lastErrorDetail || failedItems[0]?.error,
  });
});

// 3a. Update Single Product (Per-Product Lock + Idempotency + Minimal Delta + Vendor-Scoped Cache Patch)
async function handleSingleProductUpdate(req: express.Request, res: express.Response) {
  const start = performance.now();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      savedToWooCommerce: false,
      authRequired: true,
      message: 'Tu sesión expiró. Inicia sesión nuevamente para guardar cambios en tu tienda.',
    });
  }

  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ success: false, savedToWooCommerce: false, message: 'ID de producto inválido' });
  }

  const { name, price, regularPrice, salePrice, stockStatus, stockQuantity, imageUrl, imageId } = req.body;
  const payload: Record<string, any> = {};

  if (name !== undefined && typeof name === 'string' && name.trim()) {
    payload.name = name.trim();
  }

  const finalRegular =
    regularPrice !== undefined && regularPrice !== null && regularPrice !== ''
      ? String(regularPrice)
      : price !== undefined && price !== null && price !== ''
      ? String(price)
      : undefined;

  if (finalRegular !== undefined) {
    payload.regular_price = finalRegular;
  }

  if ('salePrice' in req.body) {
    if (salePrice !== undefined && salePrice !== null && salePrice !== '') {
      payload.sale_price = String(salePrice);
    } else {
      payload.sale_price = '';
    }
  }

  if (stockStatus !== undefined) {
    const isInstock = stockStatus === 'instock';
    const finalQty = isInstock ? (Number(stockQuantity) > 0 ? Number(stockQuantity) : 10) : 0;
    payload.manage_stock = true;
    payload.stock_status = isInstock ? 'instock' : 'outofstock';
    payload.stock_quantity = finalQty;
  } else if (stockQuantity !== undefined) {
    const qty = Math.max(0, Number(stockQuantity));
    payload.manage_stock = true;
    payload.stock_quantity = qty;
    payload.stock_status = qty > 0 ? 'instock' : 'outofstock';
  }

  const wcFeaturedImages = buildFeaturedImagesPayload(imageUrl, imageId, false);
  const dokanFeaturedImages = buildFeaturedImagesPayload(imageUrl, imageId, true);
  if (wcFeaturedImages) {
    payload.images = wcFeaturedImages;
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({
      success: false,
      savedToWooCommerce: false,
      message: 'No se recibieron campos válidos para actualizar.',
    });
  }

  // Short-lived idempotency check to discard duplicate double-submissions
  const idempotencyKey = `${session.vendorId}:${productId}:${JSON.stringify(payload)}`;
  const cachedDup = getRecentIdempotentResponse(idempotencyKey, 2000);
  if (cachedDup) {
    return res.json({ ...cachedDup, deduplicated: true });
  }

  return withProductLock(productId, async () => {
    let externalRequests = 0;
    let externalDurationMs = 0;

    // Verify ownership strictly before writing
    const own = await verifySingleProductOwnership(session, productId);
    externalRequests += own.externalCalls;
    externalDurationMs += own.externalMs;

    if (!own.owned) {
      const code = own.notFound ? 404 : 403;
      recordOperationMetric({
        endpoint: '/api/woocommerce/products/:id',
        opType: 'product_update_denied',
        vendorId: session.vendorId,
        durationMs: Math.round(performance.now() - start),
        externalRequests,
        externalDurationMs,
        productsCount: 1,
        httpStatus: code,
        cacheStatus: 'n/a',
        error: own.notFound ? 'Product not found' : 'Ownership rejected',
      });
      return res.status(code).json({
        success: false,
        savedToWooCommerce: false,
        message: own.notFound
          ? `El producto #${productId} no existe en la tienda.`
          : `No tienes permiso para modificar el producto #${productId}.`,
      });
    }

    let saved = false;
    let responseBody: any = null;
    let lastErrorDetail = '';

    // 1. Try Dokan Lite native vendor endpoint first (uses vendor session cookie+nonce, zero admin credentials)
    const vendorHeaders = await getVendorSessionHeaders(session, false);
    if (vendorHeaders) {
      const dokanController = new AbortController();
      const dokanTimeout = setTimeout(() => dokanController.abort(), 9000);
      const tDokan = performance.now();
      externalRequests++;
      try {
        const dokanBodyPayload = dokanFeaturedImages
          ? { ...payload, images: dokanFeaturedImages }
          : payload;
        const dokanRes = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/products/${productId}`, {
          method: 'PUT',
          headers: vendorHeaders,
          body: JSON.stringify(dokanBodyPayload),
          signal: dokanController.signal,
        });
        clearTimeout(dokanTimeout);
        externalDurationMs += Math.round(performance.now() - tDokan);
        if (dokanRes.ok) {
          responseBody = await dokanRes.json().catch(() => null);
          const imageRequested = Boolean(dokanFeaturedImages);
          const featuredConfirmed =
            !imageRequested ||
            (Array.isArray(responseBody?.images) &&
              responseBody.images.some((img: any) => img?.is_featured === true));
          saved = featuredConfirmed;
        } else {
          lastErrorDetail = `Dokan HTTP ${dokanRes.status}`;
        }
      } catch (e: any) {
        clearTimeout(dokanTimeout);
        externalDurationMs += Math.round(performance.now() - tDokan);
        lastErrorDetail = sanitizeLogMessage(e?.message || '');
      }
    }

    // 2. Fallback to WC REST API (already ownership-verified above, guarantees _thumbnail_id via position: 0)
    if (!saved) {
      const adminHeaders = getWcAdminHeaders();
      if (adminHeaders) {
        const wcController = new AbortController();
        const wcTimeout = setTimeout(() => wcController.abort(), 9000);
        const tWc = performance.now();
        externalRequests++;
        try {
          const wcRes = await fetch(buildWcApiUrl(`/wp-json/wc/v3/products/${productId}`), {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify(payload),
            signal: wcController.signal,
          });
          clearTimeout(wcTimeout);
          externalDurationMs += Math.round(performance.now() - tWc);
          if (wcRes.ok) {
            saved = true;
            responseBody = await wcRes.json().catch(() => responseBody);
          } else {
            const txt = await wcRes.text().catch(() => '');
            lastErrorDetail = `WC HTTP ${wcRes.status}: ${sanitizeLogMessage(txt).slice(0, 160)}`;
          }
        } catch (e: any) {
          clearTimeout(wcTimeout);
          externalDurationMs += Math.round(performance.now() - tWc);
          lastErrorDetail = sanitizeLogMessage(e?.message || '');
        }
      }
    }

    if (!saved) {
      recordOperationMetric({
        endpoint: '/api/woocommerce/products/:id',
        opType: 'product_update',
        vendorId: session.vendorId,
        durationMs: Math.round(performance.now() - start),
        externalRequests,
        externalDurationMs,
        productsCount: 1,
        httpStatus: 502,
        cacheStatus: 'n/a',
        error: lastErrorDetail,
      });
      return res.status(502).json({
        success: false,
        productId,
        savedToWooCommerce: false,
        errorDetail: lastErrorDetail,
        message: `No se pudo actualizar el producto #${productId} en tu tienda.`,
      });
    }

    const confirmedRegular =
      responseBody?.regular_price !== undefined && responseBody?.regular_price !== ''
        ? parseFloat(responseBody.regular_price)
        : finalRegular
        ? parseFloat(finalRegular)
        : undefined;
    const confirmedSale =
      responseBody?.sale_price !== undefined && responseBody?.sale_price !== ''
        ? parseFloat(responseBody.sale_price)
        : undefined;
    const confirmedPrice =
      responseBody?.price !== undefined && responseBody?.price !== ''
        ? parseFloat(responseBody.price)
        : confirmedSale !== undefined
        ? confirmedSale
        : confirmedRegular;
    const confirmedStatus = responseBody?.stock_status || payload.stock_status;
    const confirmedQty =
      responseBody?.stock_quantity !== undefined && responseBody?.stock_quantity !== null
        ? Number(responseBody.stock_quantity)
        : payload.stock_quantity;

    // Update ONLY this product in vendor cache (no global clear, no catalog refetch!)
    const cachePatch: Record<string, any> = {};
    if (payload.name) cachePatch.name = payload.name;
    if (confirmedPrice !== undefined && !isNaN(confirmedPrice)) cachePatch.price = confirmedPrice;
    if (confirmedRegular !== undefined && !isNaN(confirmedRegular)) cachePatch.regularPrice = confirmedRegular;
    cachePatch.salePrice = confirmedSale;
    if (confirmedStatus) cachePatch.stockStatus = confirmedStatus;
    if (confirmedQty !== undefined && !isNaN(confirmedQty)) cachePatch.stockQuantity = confirmedQty;
    if (payload.images?.[0]?.src) cachePatch.imageUrl = payload.images[0].src;

    patchProductInVendorCache(session.vendorId, productId, cachePatch);

    const successPayload = {
      success: true,
      productId,
      price: confirmedPrice,
      regularPrice: confirmedRegular,
      salePrice: confirmedSale,
      stockStatus: confirmedStatus,
      stockQuantity: confirmedQty,
      savedToWooCommerce: true,
      message: `Producto #${productId} actualizado con éxito en tu tienda.`,
    };

    setRecentIdempotentResponse(idempotencyKey, successPayload);

    recordOperationMetric({
      endpoint: '/api/woocommerce/products/:id',
      opType: 'product_update',
      vendorId: session.vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: 1,
      httpStatus: 200,
      cacheStatus: 'n/a',
    });

    return res.json(successPayload);
  });
}

app.put('/api/woocommerce/products/:id', handleSingleProductUpdate);
app.post('/api/woocommerce/products/:id', handleSingleProductUpdate);
app.post('/api/woocommerce/products/:id/stock', handleSingleProductUpdate);

// 3b. Create Single Product (requires session, binds vendorId strictly from session, NO fake success fallback)
app.post('/api/woocommerce/products', async (req, res) => {
  const start = performance.now();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      authRequired: true,
      message: 'Inicia sesión para crear productos en tu tienda.',
    });
  }

  const newProductData = req.body;
  if (!newProductData || !newProductData.name || !String(newProductData.name).trim()) {
    return res.status(400).json({ success: false, message: 'El nombre del producto es obligatorio.' });
  }

  const vendorId = session.vendorId;
  const isInstock = newProductData.stockStatus !== 'outofstock';
  const qty = isInstock ? (Number(newProductData.stockQuantity) > 0 ? Number(newProductData.stockQuantity) : 10) : 0;

  const dokanCreateImages = buildFeaturedImagesPayload(newProductData.imageUrl, newProductData.imageId, true);
  const wcCreateImages = buildFeaturedImagesPayload(newProductData.imageUrl, newProductData.imageId, false);

  const payload: any = {
    name: String(newProductData.name).trim(),
    type: 'simple',
    regular_price: String(newProductData.regularPrice ?? newProductData.price ?? 0),
    sale_price:
      newProductData.salePrice !== undefined && newProductData.salePrice !== null && newProductData.salePrice !== ''
        ? String(newProductData.salePrice)
        : undefined,
    manage_stock: true,
    stock_status: isInstock ? 'instock' : 'outofstock',
    stock_quantity: qty,
    sku: newProductData.sku || `SKU-${Date.now().toString().slice(-6)}`,
    images: wcCreateImages,
    categories: newProductData.category ? [{ name: newProductData.category }] : undefined,
    description: newProductData.description || '',
    meta_data: [{ key: '_dokan_vendor_id', value: String(vendorId) }],
  };

  let externalRequests = 0;
  let externalDurationMs = 0;
  let createdJson: any = null;
  let lastErrorDetail = '';

  // 1. Try Dokan Lite native vendor endpoint first (author = authenticated vendor)
  const vendorHeaders = await getVendorSessionHeaders(session, false);
  if (vendorHeaders) {
    const dokanCtrl = new AbortController();
    const dokanTimeout = setTimeout(() => dokanCtrl.abort(), 12000);
    const tDokan = performance.now();
    externalRequests++;
    try {
      const dokanPayload = dokanCreateImages ? { ...payload, images: dokanCreateImages } : payload;
      const dokanRes = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/products`, {
        method: 'POST',
        headers: vendorHeaders,
        body: JSON.stringify(dokanPayload),
        signal: dokanCtrl.signal,
      });
      clearTimeout(dokanTimeout);
      externalDurationMs += Math.round(performance.now() - tDokan);
      if (dokanRes.ok) {
        createdJson = await dokanRes.json().catch(() => null);
        // If Dokan created the product without setting featured image (_thumbnail_id), ensure via wc/v3
        if (
          createdJson?.id &&
          wcCreateImages &&
          (!Array.isArray(createdJson?.images) || !createdJson.images.some((img: any) => img?.is_featured === true))
        ) {
          const adminHeadersFix = getWcAdminHeaders();
          if (adminHeadersFix) {
            externalRequests++;
            const fixRes = await fetch(buildWcApiUrl(`/wp-json/wc/v3/products/${createdJson.id}`), {
              method: 'PUT',
              headers: adminHeadersFix,
              body: JSON.stringify({ images: wcCreateImages }),
            }).catch(() => null);
            if (fixRes?.ok) {
              const fixed = await fixRes.json().catch(() => null);
              if (fixed?.images) createdJson.images = fixed.images;
            }
          }
        }
      } else {
        lastErrorDetail = `Dokan HTTP ${dokanRes.status}`;
      }
    } catch (e: any) {
      clearTimeout(dokanTimeout);
      externalDurationMs += Math.round(performance.now() - tDokan);
      lastErrorDetail = sanitizeLogMessage(e?.message || '');
    }
  }

  // 2. Fallback to WC REST API with server-enforced vendorId metadata
  if (!createdJson) {
    const adminHeaders = getWcAdminHeaders();
    if (adminHeaders) {
      const wcCtrl = new AbortController();
      const wcTimeout = setTimeout(() => wcCtrl.abort(), 12000);
      const tWc = performance.now();
      externalRequests++;
      try {
        const wcRes = await fetch(buildWcApiUrl('/wp-json/wc/v3/products'), {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify(payload),
          signal: wcCtrl.signal,
        });
        clearTimeout(wcTimeout);
        externalDurationMs += Math.round(performance.now() - tWc);
        if (wcRes.ok) {
          createdJson = await wcRes.json().catch(() => null);
        } else {
          const txt = await wcRes.text().catch(() => '');
          lastErrorDetail = `WC HTTP ${wcRes.status}: ${sanitizeLogMessage(txt).slice(0, 160)}`;
        }
      } catch (e: any) {
        clearTimeout(wcTimeout);
        externalDurationMs += Math.round(performance.now() - tWc);
        lastErrorDetail = sanitizeLogMessage(e?.message || '');
      }
    }
  }

  if (!createdJson) {
    recordOperationMetric({
      endpoint: '/api/woocommerce/products',
      opType: 'product_create',
      vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: 1,
      httpStatus: 502,
      cacheStatus: 'n/a',
      error: lastErrorDetail,
    });
    return res.status(502).json({
      success: false,
      message: 'No se pudo crear el producto en tu tienda. Revisa los datos e inténtalo de nuevo.',
      errorDetail: lastErrorDetail,
    });
  }

  const createdWcProduct = createdJson;
  const mappedProduct = mapRawProduct(createdWcProduct, vendorId);
  recordVendorProductOwnership(vendorId, [mappedProduct.id]);
  invalidateVendorProductCache(vendorId);

  recordOperationMetric({
    endpoint: '/api/woocommerce/products',
    opType: 'product_create',
    vendorId,
    durationMs: Math.round(performance.now() - start),
    externalRequests,
    externalDurationMs,
    productsCount: 1,
    httpStatus: 201,
    cacheStatus: 'n/a',
  });

  return res.status(201).json({
    success: true,
    product: mappedProduct,
    message: 'Producto creado exitosamente en tu tienda.',
  });
});

// 3c. Delete Product (strict ownership verification + real confirmation, NO fake success fallback)
app.delete('/api/woocommerce/products/:id', async (req, res) => {
  const start = performance.now();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, authRequired: true, message: 'Acceso no autorizado.' });
  }

  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: 'ID de producto inválido.' });
  }

  return withProductLock(productId, async () => {
    let externalRequests = 0;
    let externalDurationMs = 0;

    const own = await verifySingleProductOwnership(session, productId);
    externalRequests += own.externalCalls;
    externalDurationMs += own.externalMs;

    if (!own.owned) {
      const code = own.notFound ? 404 : 403;
      recordOperationMetric({
        endpoint: '/api/woocommerce/products/:id',
        opType: 'product_delete_denied',
        vendorId: session.vendorId,
        durationMs: Math.round(performance.now() - start),
        externalRequests,
        externalDurationMs,
        productsCount: 1,
        httpStatus: code,
        cacheStatus: 'n/a',
        error: own.notFound ? 'Product not found' : 'Ownership rejected',
      });
      return res.status(code).json({
        success: false,
        message: own.notFound
          ? `El producto #${productId} no existe.`
          : `No tienes permiso para eliminar el producto #${productId}.`,
      });
    }

    let response: Response | null = null;
    let lastErrorDetail = '';

    // 1. Try Dokan Lite vendor DELETE endpoint first
    const vendorHeaders = await getVendorSessionHeaders(session, false);
    if (vendorHeaders) {
      const dokanCtrl = new AbortController();
      const dokanTimeout = setTimeout(() => dokanCtrl.abort(), 9000);
      const tDokan = performance.now();
      externalRequests++;
      try {
        const dokanRes = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/products/${productId}`, {
          method: 'DELETE',
          headers: vendorHeaders,
          signal: dokanCtrl.signal,
        });
        clearTimeout(dokanTimeout);
        externalDurationMs += Math.round(performance.now() - tDokan);
        if (dokanRes.ok) {
          response = dokanRes;
        } else {
          lastErrorDetail = `Dokan DELETE HTTP ${dokanRes.status}`;
        }
      } catch (e: any) {
        clearTimeout(dokanTimeout);
        externalDurationMs += Math.round(performance.now() - tDokan);
        lastErrorDetail = sanitizeLogMessage(e?.message || '');
      }
    }

    // 2. Fallback to ownership-verified WC DELETE
    if (!response || !response.ok) {
      const adminHeaders = getWcAdminHeaders();
      if (adminHeaders) {
        const wcCtrl = new AbortController();
        const wcTimeout = setTimeout(() => wcCtrl.abort(), 9000);
        const tWc = performance.now();
        externalRequests++;
        try {
          const wcRes = await fetch(buildWcApiUrl(`/wp-json/wc/v3/products/${productId}?force=true`), {
            method: 'DELETE',
            headers: adminHeaders,
            signal: wcCtrl.signal,
          });
          clearTimeout(wcTimeout);
          externalDurationMs += Math.round(performance.now() - tWc);
          if (wcRes.ok) {
            response = wcRes;
          } else {
            lastErrorDetail = `WC DELETE HTTP ${wcRes.status}`;
          }
        } catch (e: any) {
          clearTimeout(wcTimeout);
          externalDurationMs += Math.round(performance.now() - tWc);
          lastErrorDetail = sanitizeLogMessage(e?.message || '');
        }
      }
    }

    if (!response || !response.ok) {
      recordOperationMetric({
        endpoint: '/api/woocommerce/products/:id',
        opType: 'product_delete',
        vendorId: session.vendorId,
        durationMs: Math.round(performance.now() - start),
        externalRequests,
        externalDurationMs,
        productsCount: 1,
        httpStatus: 502,
        cacheStatus: 'n/a',
        error: lastErrorDetail,
      });
      return res.status(502).json({
        success: false,
        message: `No se pudo eliminar el producto #${productId} de tu tienda.`,
        errorDetail: lastErrorDetail,
      });
    }

    removeProductFromVendorCache(session.vendorId, productId);
    recordOperationMetric({
      endpoint: '/api/woocommerce/products/:id',
      opType: 'product_delete',
      vendorId: session.vendorId,
      durationMs: Math.round(performance.now() - start),
      externalRequests,
      externalDurationMs,
      productsCount: 1,
      httpStatus: 200,
      cacheStatus: 'n/a',
    });

    return res.json({
      success: true,
      statusCode: response.status,
      message: `Producto #${productId} eliminado permanentemente de tu tienda.`,
    });
  });
});

// 4. Incremental Webhook Dispatch with Real HMAC-SHA256 Signature & Delivery Deduplication
const processedWebhookDeliveries = new Map<string, number>();

app.post('/api/webhook/dispatch', async (req, res) => {
  const start = performance.now();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Sesión no autorizada para enviar eventos.' });
  }

  const { url, payload, deliveryId } = req.body;
  const targetUrl = typeof url === 'string' ? url.trim() : '';

  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'No hay una URL externa configurada para notificaciones.',
    });
  }

  if (deliveryId && processedWebhookDeliveries.has(String(deliveryId))) {
    return res.json({
      success: true,
      statusCode: 200,
      deduplicated: true,
      latencyMs: 0,
      message: 'Evento ya entregado previamente (idempotente).',
    });
  }

  // Override vendor metadata server-side to guarantee authenticity
  const rawBody = JSON.stringify({
    ...payload,
    vendor: {
      ...(payload?.vendor || {}),
      id: session.vendorId,
    },
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmacSignature = crypto
    .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  let externalDurationMs = 0;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const tExt = performance.now();

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Source': WC_STORE_URL,
        'X-Merqba-App': 'Merqba FA',
        'X-Merqba-Vendor-Id': String(session.vendorId),
        'X-Merqba-Timestamp': timestamp,
        'X-Merqba-Delivery-Id': String(deliveryId || crypto.randomUUID()),
        'X-Merqba-Signature': `sha256=${hmacSignature}`,
      },
      body: rawBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    externalDurationMs = Math.round(performance.now() - tExt);

    if (response.ok && deliveryId) {
      if (processedWebhookDeliveries.size > 500) {
        const cutoff = Date.now() - 10 * 60 * 1000;
        for (const [k, ts] of processedWebhookDeliveries.entries()) {
          if (ts < cutoff) processedWebhookDeliveries.delete(k);
        }
      }
      processedWebhookDeliveries.set(String(deliveryId), Date.now());
    }

    const totalMs = Math.round(performance.now() - start);
    recordOperationMetric({
      endpoint: '/api/webhook/dispatch',
      opType: 'webhook_incremental',
      vendorId: session.vendorId,
      durationMs: totalMs,
      externalRequests: 1,
      externalDurationMs,
      productsCount: Array.isArray(payload?.products) ? payload.products.length : 0,
      httpStatus: response.status,
      cacheStatus: 'n/a',
      error: response.ok ? undefined : `Webhook HTTP ${response.status}`,
    });

    return res.status(response.ok ? 200 : 502).json({
      success: response.ok,
      statusCode: response.status,
      latencyMs: externalDurationMs,
      signatureAlg: 'HMAC-SHA256',
      message: response.ok ? 'Notificación incremental entregada correctamente.' : `El receptor respondió con HTTP ${response.status}`,
    });
  } catch (err: any) {
    const totalMs = Math.round(performance.now() - start);
    recordOperationMetric({
      endpoint: '/api/webhook/dispatch',
      opType: 'webhook_incremental',
      vendorId: session.vendorId,
      durationMs: totalMs,
      externalRequests: 1,
      externalDurationMs: totalMs,
      productsCount: Array.isArray(payload?.products) ? payload.products.length : 0,
      httpStatus: 502,
      cacheStatus: 'n/a',
      error: err?.message,
    });

    return res.status(502).json({
      success: false,
      statusCode: 502,
      latencyMs: totalMs,
      message: 'No se pudo entregar la notificación al destino configurado.',
    });
  }
});

// 5. Vendor Individual Exchange Rate API
const MERQBA_VENDOR_RATE_ENDPOINT = `${WC_STORE_URL}/wp-json/merqba/v1/vendor-rate`;

async function getFoxMinRate(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${WC_STORE_URL}/wp-json/woocs/v3/currency`, {
      headers: { 'User-Agent': 'MerqbaFA/2.0', Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) {
      const currencies = await response.json();
      if (currencies?.CUP?.rate) {
        const val = parseFloat(currencies.CUP.rate);
        if (!isNaN(val) && val > 0) return val;
      }
    }
  } catch (err: any) {
    console.warn('FOX rates fetch notice:', err?.message);
  }
  return null;
}

interface VendorRateFetchResult {
  rate: number | null;
  minRate: number | null;
  configured: boolean;
  message?: string;
  rawStatus?: number;
}

async function getVendorRateFromWordPress(session: ActiveSession): Promise<VendorRateFetchResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const headers = (await getVendorSessionHeaders(session, false)) || {
      Accept: 'application/json',
      'User-Agent': 'MerqbaFA/2.0',
    };

    const response = await fetch(MERQBA_VENDOR_RATE_ENDPOINT, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    let parsedRate: number | null = null;
    let parsedMinRate: number | null = null;
    let isConfigured = false;
    let serverMsg: string | undefined;

    if (response.ok) {
      const data = await response.json();
      if (typeof data === 'number') {
        parsedRate = data;
      } else if (typeof data === 'string' && !isNaN(parseFloat(data))) {
        parsedRate = parseFloat(data);
      } else if (data && typeof data === 'object') {
        const r = data.rate ?? data.vendor_rate ?? data.current_rate ?? data.own_rate ?? data.tasa;
        if (r !== undefined && r !== null && r !== '' && !isNaN(parseFloat(String(r))) && parseFloat(String(r)) > 0) {
          parsedRate = parseFloat(String(r));
        }
        const m = data.minimum_rate ?? data.min_rate ?? data.minRate ?? data.min ?? data.tasa_minima;
        if (m !== undefined && m !== null && m !== '' && !isNaN(parseFloat(String(m))) && parseFloat(String(m)) > 0) {
          parsedMinRate = parseFloat(String(m));
        }
        isConfigured = data.configured !== undefined ? Boolean(data.configured) : parsedRate !== null && parsedRate > 0;
        serverMsg = data.message;
      }
    }

    if (parsedMinRate === null) {
      parsedMinRate = await getFoxMinRate();
    }

    return {
      rate: parsedRate,
      minRate: parsedMinRate,
      configured: isConfigured || (parsedRate !== null && parsedRate > 0),
      message: serverMsg,
      rawStatus: response.status,
    };
  } catch (err: any) {
    console.warn(`[merqba/v1/vendor-rate] GET exception for vendor #${session.vendorId}:`, err?.message);
    return {
      rate: null,
      minRate: await getFoxMinRate(),
      configured: false,
      message: 'Error de conexión al consultar la tasa.',
    };
  }
}

async function updateVendorRateInWordPress(
  session: ActiveSession,
  newRate: number
): Promise<{ success: boolean; rate: number | null; minRate: number | null; message: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const headers = (await getVendorSessionHeaders(session, true)) || {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MerqbaFA/2.0',
    };

    const response = await fetch(MERQBA_VENDOR_RATE_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rate: newRate }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const resJson = await response.json().catch(() => null);
    if (!response.ok || (resJson && resJson.success === false)) {
      return {
        success: false,
        rate: null,
        minRate: await getFoxMinRate(),
        message: resJson?.message || `No se pudo actualizar la tasa (código HTTP ${response.status})`,
      };
    }

    const confirmedRate =
      resJson && resJson.rate !== undefined && resJson.rate !== null && !isNaN(parseFloat(String(resJson.rate)))
        ? parseFloat(String(resJson.rate))
        : newRate;
    const confirmedMin =
      resJson && resJson.minimum_rate && !isNaN(parseFloat(String(resJson.minimum_rate)))
        ? parseFloat(String(resJson.minimum_rate))
        : await getFoxMinRate();

    return {
      success: true,
      rate: confirmedRate,
      minRate: confirmedMin,
      message: resJson?.message || `Tasa de cambio de ${confirmedRate} CUP/USD guardada y confirmada exitosamente.`,
    };
  } catch (err: any) {
    return {
      success: false,
      rate: null,
      minRate: await getFoxMinRate(),
      message: 'Error de conexión al intentar guardar la tasa: ' + err?.message,
    };
  }
}

app.get('/api/vendor/exchange-rate', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'No hay una sesión de vendedor activa. Por favor inicia sesión con tu cuenta de Merqba.',
    });
  }

  const vendorId = session.vendorId;
  const vendorInfo = await getOrFetchSingleVendor(vendorId, session);

  try {
    const rateData = await getVendorRateFromWordPress(session);
    return res.json({
      success: true,
      vendorId,
      vendorName: vendorInfo.storeName || vendorInfo.name,
      minRate: rateData.minRate,
      currentRate: rateData.rate,
      hasConfiguredRate: rateData.configured,
      currencyFrom: 'USD',
      currencyTo: 'CUP',
      message: rateData.message || 'Tasa consultada correctamente.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Error de servidor al consultar la tasa de cambio.',
    });
  }
});

app.post('/api/vendor/exchange-rate', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado. Inicia sesión con una cuenta de vendedor válida para modificar tu tasa.',
    });
  }

  const { rate } = req.body;
  if (rate === undefined || rate === null || rate === '') {
    return res.status(400).json({
      success: false,
      message: 'Por favor introduce un valor numérico para la nueva tasa de cambio.',
    });
  }

  const parsedRate = parseFloat(String(rate));
  if (isNaN(parsedRate) || parsedRate <= 0) {
    return res.status(400).json({
      success: false,
      message: 'La tasa de cambio debe ser un número válido mayor que cero.',
    });
  }

  try {
    const currentRateInfo = await getVendorRateFromWordPress(session);
    const minRate = currentRateInfo.minRate;

    if (minRate === null || isNaN(minRate) || minRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo obtener la tasa mínima permitida. No es posible validar o guardar la tasa en este momento.',
        minRate: null,
      });
    }

    if (parsedRate < minRate) {
      return res.status(400).json({
        success: false,
        message: `La tasa introducida (${parsedRate} CUP) no puede ser inferior a la tasa mínima global permitida (${minRate} CUP).`,
        minRate,
      });
    }

    const saveResult = await updateVendorRateInWordPress(session, parsedRate);
    if (!saveResult.success) {
      return res.status(400).json({
        success: false,
        message: saveResult.message,
        minRate,
      });
    }

    const vendorInfo = await getOrFetchSingleVendor(session.vendorId, session);
    return res.json({
      success: true,
      message: saveResult.message || `Tasa de cambio de ${saveResult.rate} CUP/USD guardada para ${vendorInfo.storeName}.`,
      vendorId: session.vendorId,
      rate: saveResult.rate,
      minRate: saveResult.minRate || minRate,
      savedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al guardar la tasa de cambio.',
    });
  }
});

// 5c. Protected Observability & Diagnostics Endpoint (requires active session, zero secrets exposed)
app.get('/api/admin/diagnostics', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'No autorizado.' });
  }

  const mem = process.memoryUsage();
  return res.json({
    success: true,
    vendorId: session.vendorId,
    connection: {
      storeUrl: WC_STORE_URL,
      hasStoreCredentials: Boolean(WC_CONSUMER_KEY && WC_CONSUMER_SECRET),
    },
    runtime: {
      uptimeSeconds: Math.round(process.uptime()),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    cache: getCacheOverview(session.vendorId),
    metrics: getDiagnosticsSummary(session.vendorId),
    generatedAt: new Date().toISOString(),
  });
});

// 6. Vite middleware in dev / static dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Merqba FA] Server running on http://0.0.0.0:${PORT} connecting to ${WC_STORE_URL}`);
    fetchAllDokanVendors().catch(() => {});
  });
}

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Merqba FA] Unhandled rejection caught:', sanitizeLogMessage(String(reason?.message || reason || 'unknown')));
});

process.on('uncaughtException', (err: any) => {
  console.error('[Merqba FA] Uncaught exception:', sanitizeLogMessage(String(err?.message || err || 'unknown')));
});

startServer().catch((err) => {
  console.error('[Merqba FA] Fatal error starting server:', sanitizeLogMessage(String(err?.message || err)));
  process.exit(1);
});
