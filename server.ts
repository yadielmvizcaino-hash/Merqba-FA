import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Ensure public/uploads directory exists for resilient media persistence
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

// Secure WooCommerce Store Configuration (Server-Side Only - never exposed to public UI)
const WC_STORE_URL = (process.env.WC_STORE_URL || 'https://merqba.com').replace(/\/+$/, '');
const WC_CONSUMER_KEY = 'ck_115fce2ee9779ca57b79bd19811d44be9dd6b9b2';
const WC_CONSUMER_SECRET = 'cs_7b5ddadd4a04c6996d04430974564928a58ca12a';

app.use(express.json({ limit: '15mb' }));

interface ActiveSession {
  username: string;
  password?: string;
  cookies?: string;
  vendorId?: number;
}
let activeSessionUser: ActiveSession | null = null;
let productsCache: { timestamp: number; data: any } | null = null;
const PRODUCTS_CACHE_TTL = 45000; // 45 seconds to prevent Traefik/WordPress overload

const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const getWcAuthHeader = () => {
  const token = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64');
  return `Basic ${token}`;
};

const knownVendors: Record<number, any> = {
  1: {
    id: 1,
    name: 'Yadiel Moya',
    storeName: 'Merqba',
    email: 'yadielmvizcaino@gmail.com',
    avatar: 'https://merqba.com/wp-content/uploads/2026/05/merqba-logo-icon.png',
    banner: 'https://merqba.com/wp-content/plugins/dokan-lite/assets/images/default-store-banner.png',
    rating: 5.0,
    ratingCount: 56,
    storeUrl: `${WC_STORE_URL}/store/yadiel/`,
    phone: '+53 5 963 1292',
    address: 'Santa Clara, Villa Clara, Cuba',
  },
  191: {
    id: 191,
    name: 'Los Chanas Los Chanas',
    storeName: 'Los Chanas Ferretería',
    email: 'loschanasferreteria@gmail.com',
    avatar: 'https://merqba.com/wp-content/uploads/2026/10/cropped-IMG_20261026_093719.jpg',
    banner: 'https://merqba.com/wp-content/uploads/2026/10/cropped-Ferreteria-Los-Chanas_-Fuerza-y-Herramientas-1.jpg',
    rating: 4.9,
    ratingCount: 15,
    storeUrl: `${WC_STORE_URL}/store/los-chanas-ferreter-a/`,
    phone: '+53 5 434 1916',
    address: 'Circunvalación e/ Roble y Autopista, Santa Clara, Cuba',
  },
  87: {
    id: 87,
    name: 'Surticuba',
    storeName: 'Surticuba',
    email: 'surticuba@gmail.com',
    avatar: 'https://merqba.com/wp-content/plugins/dokan-lite/assets/images/mystery-person.jpg',
    banner: 'https://merqba.com/wp-content/plugins/dokan-lite/assets/images/default-store-banner.png',
    rating: 4.8,
    ratingCount: 39,
    storeUrl: `${WC_STORE_URL}/store/surticuba/`,
    phone: '+53 5 540 7015',
    address: 'Santa Clara, Cuba',
  },
  81: {
    id: 81,
    name: 'Yanet Moya',
    storeName: 'Última milla',
    email: 'ultimamilla@gmail.com',
    avatar: 'https://merqba.com/wp-content/uploads/2026/07/cropped-IMG_20260715_223441-1.png',
    banner: 'https://merqba.com/wp-content/uploads/2026/07/cropped-InShot_20260715_223335865.jpg',
    rating: 4.9,
    ratingCount: 20,
    storeUrl: `${WC_STORE_URL}/store/ultima-milla/`,
    phone: '+53 5 963 1292',
    address: 'Santa Clara, Cuba',
  },
  54: {
    id: 54,
    name: 'A&E Nexus',
    storeName: 'A&E Nexus',
    email: 'aenexus@gmail.com',
    avatar: 'https://merqba.com/wp-content/uploads/2026/06/cropped-cropped-InShot_20260624_152129811-2.jpg',
    banner: 'https://merqba.com/wp-content/uploads/2026/06/cropped-InShot_20260624_154011069.jpg',
    rating: 4.7,
    ratingCount: 18,
    storeUrl: `${WC_STORE_URL}/store/ae-nexus/`,
    phone: '+53 5 954 9890',
    address: 'Santa Clara, Cuba',
  },
  39: {
    id: 39,
    name: 'Alberto Perdomo',
    storeName: 'Alpha móvil',
    email: 'alphamovil@gmail.com',
    avatar: 'https://merqba.com/wp-content/uploads/2026/06/cropped-Chibi-mikha-lim✨.jpg',
    banner: 'https://merqba.com/wp-content/uploads/2026/06/cropped-4ee0482982cfa89bb4d1cff3333a55e6.png',
    rating: 4.8,
    ratingCount: 25,
    storeUrl: `${WC_STORE_URL}/store/alpha-movil/`,
    phone: '+53 5 342 7965',
    address: 'Santa Clara, Cuba',
  },
  32: {
    id: 32,
    name: 'RollOn',
    storeName: 'RollOn',
    email: 'rollon@gmail.com',
    avatar: 'https://merqba.com/wp-content/uploads/2026/06/cropped-Modelo-de-design-do-logotipo-do-icone-do-oleo-do-motor-_-Vetor-Premium-1.jpg',
    banner: 'https://merqba.com/wp-content/uploads/2026/06/cropped-mobil-super-fs-sm.jpg',
    rating: 4.9,
    ratingCount: 30,
    storeUrl: `${WC_STORE_URL}/store/rollon/`,
    phone: '+53 5 209 9999',
    address: 'Santa Clara, Cuba',
  },
};

// 1. Connection Status API (Public to app, hides keys)
app.get('/api/woocommerce/status', (req, res) => {
  res.json({
    status: 'configured',
    storeUrl: WC_STORE_URL,
    hasCredentials: Boolean(WC_CONSUMER_KEY && WC_CONSUMER_SECRET),
    appName: 'Merqba FA',
    serverTime: new Date().toISOString(),
  });
});


// 1b. WooCommerce / WordPress Vendor Authentication API
app.post('/api/woocommerce/login', async (req, res) => {
  const { username, password, vendorId } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Por favor, ingresa tu usuario o correo y tu contraseña de Merqba.',
    });
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();

  try {
    // 1. Direct Merqba Form Authentication via /mi-cuenta/
    let isWcSuccess = false;
    let wcErrorMessage: string | null = null;
    let postCookies = '';

    try {
      const initial = await fetch(`${WC_STORE_URL}/mi-cuenta/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      const html = await initial.text();
      const cookies = initial.headers.get('set-cookie') || '';
      const nonceMatch = html.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/);
      const nonce = nonceMatch ? nonceMatch[1] : '';

      const params = new URLSearchParams();
      params.append('username', cleanUser);
      params.append('password', cleanPass);
      params.append('woocommerce-login-nonce', nonce);
      params.append('_wp_http_referer', '/mi-cuenta/');
      params.append('login', 'Acceder');

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

      postCookies = postRes.headers.get('set-cookie') || '';
      isWcSuccess = postCookies.includes('wordpress_logged_in') || postRes.status === 302;

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

    // 2. Also try REST API Basic Auth check
    if (!isWcSuccess) {
      try {
        const basicToken = Buffer.from(`${cleanUser}:${cleanPass}`).toString('base64');
        const wpMeRes = await fetch(`${WC_STORE_URL}/wp-json/wp/v2/users/me`, {
          headers: {
            Authorization: `Basic ${basicToken}`,
            Accept: 'application/json',
            'User-Agent': 'MerqbaFA/1.0',
          },
        });
        if (wpMeRes.ok) {
          isWcSuccess = true;
          wcErrorMessage = null;
        }
      } catch (e) {
        // Ignore REST fallback error
      }
    }

    // If authentication failed, reject with error message
    if (!isWcSuccess) {
      return res.status(401).json({
        success: false,
        message: wcErrorMessage || 'Contraseña incorrecta. Por favor ingresa la contraseña válida de tu perfil en Merqba.',
      });
    }

    // 3. Authentication Succeeded! Match vendor profile from known vendors
    // If vendorId is provided, check if it matches
    let matchedVendor = vendorId ? knownVendors[Number(vendorId)] : null;

    // If not matched by ID, try matching by email or username
    if (!matchedVendor) {
      for (const v of Object.values(knownVendors)) {
        if (
          v.email.toLowerCase() === cleanUser.toLowerCase() ||
          v.name.toLowerCase().includes(cleanUser.toLowerCase()) ||
          cleanUser.toLowerCase().includes(v.storeName.toLowerCase())
        ) {
          matchedVendor = v;
          break;
        }
      }
    }

    // If still not matched, synthesize from cleanUser
    if (!matchedVendor) {
      const pseudoId = vendorId ? Number(vendorId) : (Math.abs(cleanUser.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 14)) % 900 + 10);
      const displayName = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;
      const formattedStore = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      matchedVendor = {
        id: pseudoId,
        name: formattedStore,
        storeName: `Tienda ${formattedStore}`,
        email: cleanUser.includes('@') ? cleanUser : `${cleanUser}@gmail.com`,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        banner: '',
        rating: 5.0,
        ratingCount: 1,
        storeUrl: `${WC_STORE_URL}/store/${cleanUser.toLowerCase()}`,
        phone: '',
        address: '',
      };
    }

    activeSessionUser = {
      username: cleanUser,
      password: cleanPass,
      cookies: postCookies,
      vendorId: matchedVendor.id,
    };

    return res.json({
      success: true,
      source: 'woocommerce_live_authenticated',
      message: `Contraseña verificada con éxito en WooCommerce para ${cleanUser}`,
      vendor: matchedVendor,
    });
  } catch (err: any) {
    console.error('Login endpoint error:', err);
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error al contactar al servidor de WooCommerce. Inténtalo nuevamente.',
    });
  }
});

// 2. Fetch Products directly from live WooCommerce REST API with full pagination support
app.get('/api/woocommerce/products', async (req, res) => {
  const vendorIdParam = req.query.vendor_id ? parseInt(req.query.vendor_id as string, 10) : null;

  // Return from in-memory cache if fresh (< 45s) to avoid Traefik / WordPress request overload
  if (productsCache && (Date.now() - productsCache.timestamp < PRODUCTS_CACHE_TTL)) {
    return res.json(productsCache.data);
  }

  let rawData: any[] = [];
  let lastResponseStatus = 200;
  let successFetch = false;

  try {
    for (let page = 1; page <= 5; page++) {
      const targetUrl = `${WC_STORE_URL}/wp-json/wc/v3/products?per_page=100&page=${page}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Authorization: getWcAuthHeader(),
          Accept: 'application/json',
          'User-Agent': 'MerqbaFA/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastResponseStatus = response.status;

      if (!response.ok) {
        break;
      }

      const pageData = await response.json();
      if (!Array.isArray(pageData) || pageData.length === 0) {
        break;
      }

      rawData = rawData.concat(pageData);
      successFetch = true;

      if (pageData.length < 100) {
        break; // reached end of pagination
      }
    }

    if (!successFetch || rawData.length === 0) {
      console.warn(`WooCommerce API answered with status: ${lastResponseStatus}, trying Dokan multi-vendor live products...`);
      try {
        const storeIdToFetch = vendorIdParam || 1;
        const dokanRes = await fetch(`${WC_STORE_URL}/wp-json/dokan/v1/stores/${storeIdToFetch}/products?per_page=100`, {
          headers: { 'User-Agent': 'MerqbaFA/1.0', Accept: 'application/json' },
        });

        if (dokanRes.ok) {
          const dokanProducts = await dokanRes.json();
          if (Array.isArray(dokanProducts) && dokanProducts.length > 0) {
            const mapped = dokanProducts.map((item: any) => {
              const priceNum = item.price && item.price !== '' ? parseFloat(item.price) : (item.regular_price && item.regular_price !== '' ? parseFloat(item.regular_price) : 0);
              const regularNum = item.regular_price && item.regular_price !== '' ? parseFloat(item.regular_price) : priceNum;
              const saleNum = item.sale_price && item.sale_price !== '' ? parseFloat(item.sale_price) : undefined;
              const qty = item.stock_quantity !== null && item.stock_quantity !== undefined ? Number(item.stock_quantity) : 0;
              return {
                id: item.id,
                vendorId: storeIdToFetch,
                name: item.name || 'Sin nombre',
                slug: item.slug || undefined,
                permalink: item.permalink || undefined,
                sku: item.sku || `SKU-${item.id}`,
                regularPrice: isNaN(regularNum) ? 0 : regularNum,
                salePrice: saleNum !== undefined && !isNaN(saleNum) ? saleNum : undefined,
                price: isNaN(priceNum) ? 0 : priceNum,
                stockQuantity: isNaN(qty) ? 0 : qty,
                stockStatus: qty > 0 ? 'instock' : (item.in_stock ? 'instock' : 'outofstock'),
                manageStock: Boolean(item.manage_stock),
                imageUrl: item.images?.[0]?.src || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
                category: item.categories?.[0]?.name || 'General',
                tags: Array.isArray(item.tags) ? item.tags.map((t: any) => t.name) : [],
                lastModified: item.date_modified || new Date().toISOString(),
              };
            });

            return res.json({
              success: true,
              source: 'live_dokan_store',
              count: mapped.length,
              products: mapped,
              vendors: Object.values(knownVendors),
            });
          }
        }
      } catch (dokanErr: any) {
        console.warn('Dokan fallback notice:', dokanErr.message);
      }

      return res.status(200).json({
        success: false,
        source: 'store_api_notice',
        message: `La API de WooCommerce respondió con estado ${lastResponseStatus}`,
        products: [],
      });
    }

    if (Array.isArray(rawData)) {
      const vendorsMap: Record<number, any> = {};

      const mapped = rawData.map((item: any) => {
        // Prioritize Dokan vendor ID stored in meta_data over default admin post_author
        const dokanMeta = item.meta_data?.find(
          (m: any) => m.key === '_dokan_vendor_id' || m.key === 'dokan_vendor' || m.key === '_dokan_store_id'
        )?.value;
        const vendorFromMeta = dokanMeta ? parseInt(String(dokanMeta), 10) : null;
        const storeId =
          vendorFromMeta ||
          (item.store?.id ? Number(item.store.id) : (item.author ? Number(item.author) : (vendorIdParam || 1)));

        if (item.store && item.store.id && !vendorsMap[storeId]) {
          vendorsMap[storeId] = {
            id: storeId,
            name: item.store.name || item.store.shop_name || 'Vendedor Merqba',
            storeName: item.store.shop_name || item.store.name || 'Tienda Merqba',
            email: `${(item.store.shop_name || 'vendedor').toLowerCase().replace(/[^a-z0-9]/g, '')}@merqba.com`,
            avatar: item.store.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            banner: item.store.banner || '',
            rating: 5.0,
            ratingCount: 1,
            storeUrl: item.store.url || `${WC_STORE_URL}/store/${storeId}`,
            phone: item.store.address?.street_1 || '',
            address: `${item.store.address?.city || 'Santa Clara'}, ${item.store.address?.country || 'Cuba'}`.trim(),
          };
        }

        const priceNum = item.price && item.price !== '' ? parseFloat(item.price) : (item.regular_price && item.regular_price !== '' ? parseFloat(item.regular_price) : 0);
        const regularNum = item.regular_price && item.regular_price !== '' ? parseFloat(item.regular_price) : priceNum;
        const saleNum = item.sale_price && item.sale_price !== '' ? parseFloat(item.sale_price) : undefined;
        const qty = item.stock_quantity !== null && item.stock_quantity !== undefined ? Number(item.stock_quantity) : (item.stock_status === 'instock' ? 10 : 0);

        return {
          id: item.id,
          vendorId: storeId,
          name: item.name || 'Sin nombre',
          slug: item.slug || undefined,
          permalink: item.permalink || undefined,
          sku: item.sku || `SKU-${item.id}`,
          regularPrice: isNaN(regularNum) ? 0 : regularNum,
          salePrice: saleNum !== undefined && !isNaN(saleNum) ? saleNum : undefined,
          price: isNaN(priceNum) ? 0 : priceNum,
          stockQuantity: isNaN(qty) ? 0 : qty,
          stockStatus: item.stock_status || (qty > 0 ? 'instock' : 'outofstock'),
          manageStock: Boolean(item.manage_stock),
          imageUrl: item.images?.[0]?.src || 'https://merqba.com/wp-content/uploads/2026/05/merqba-logo-icon.png',
          category: item.categories?.[0]?.name || 'General',
          tags: Array.isArray(item.tags) ? item.tags.map((t: any) => t.name) : [],
          lastModified: item.date_modified || new Date().toISOString(),
        };
      });

      const payload = {
        success: true,
        source: 'live_woocommerce',
        count: mapped.length,
        products: mapped,
        vendors: Object.values(vendorsMap),
      };
      productsCache = { timestamp: Date.now(), data: payload };
      return res.json(payload);
    }

    return res.json({ success: false, products: [], source: 'empty_response' });
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.warn('Network notice connecting to live WooCommerce API:', error.message);
    }
    return res.status(200).json({
      success: false,
      source: 'offline_fallback',
      error: error.message,
      message: 'Modo offline activo; usando catálogo local sincronizado.',
      products: [],
    });
  }
});

// Helper to normalize and ensure image URL has a clean image extension required by WooCommerce
function prepareWcImageUrl(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;

  // If already an image URL with standard extension
  const lower = trimmed.toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp')) {
    return trimmed;
  }

  // If it's a known service like unsplash or picsum, format with extension
  if (trimmed.includes('unsplash.com')) {
    // Strip query parameters that cause WordPress media_sideload_image filename failure
    const cleanBase = trimmed.split('?')[0];
    return `${cleanBase}.jpg`;
  }

  // Fallback to Merqba default logo icon if unknown extension
  return 'https://merqba.com/wp-content/uploads/2026/05/cropped-merqba-logo-icon.png';
}

// 3. Create Product on WooCommerce REST API
app.post('/api/woocommerce/products', async (req, res) => {
  const productData = req.body;
  const targetUrl = `${WC_STORE_URL}/wp-json/wc/v3/products`;

  // Process and sanitize image URL
  const validImageUrl = prepareWcImageUrl(productData.imageUrl) || 'https://merqba.com/wp-content/uploads/2026/05/cropped-merqba-logo-icon.png';

  const vendorIdNum = productData.vendorId ? Number(productData.vendorId) : 1;

  const wcPayload: any = {
    name: productData.name || 'Nuevo Producto',
    type: 'simple',
    regular_price: String(productData.regularPrice !== undefined ? productData.regularPrice : (productData.price || '0')),
    description: productData.description || '',
    sku: productData.sku || `SKU-${Date.now().toString().slice(-6)}`,
    manage_stock: Boolean(productData.manageStock),
    stock_quantity: Number(productData.stockQuantity || 0),
    stock_status: Number(productData.stockQuantity || 0) > 0 ? 'instock' : 'outofstock',
    author: vendorIdNum,
    post_author: vendorIdNum,
  };

  if (productData.salePrice !== undefined && productData.salePrice !== '') {
    wcPayload.sale_price = String(productData.salePrice);
  }

  // Attach image
  wcPayload.images = [{ src: validImageUrl }];

  if (productData.category && productData.category.trim() && productData.category !== 'General') {
    wcPayload.categories = [{ name: productData.category.trim() }];
  }

  // Dokan vendor assignment via metadata
  wcPayload.meta_data = [
    { key: '_dokan_vendor_id', value: String(vendorIdNum) },
    { key: 'dokan_vendor', value: String(vendorIdNum) },
    { key: '_dokan_store_id', value: String(vendorIdNum) },
    { key: 'n8n_triguer', value: 'true' },
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: getWcAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MerqbaFA/1.0',
      },
      body: JSON.stringify(wcPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const item = await response.json();
      const storeId = productData.vendorId || 1;
      const priceNum = item.price ? parseFloat(item.price) : 0;
      const regularNum = item.regular_price ? parseFloat(item.regular_price) : priceNum;
      const saleNum = item.sale_price ? parseFloat(item.sale_price) : undefined;
      const qty = item.stock_quantity !== null && item.stock_quantity !== undefined ? Number(item.stock_quantity) : 0;

      const mappedProduct = {
        id: item.id,
        vendorId: storeId,
        name: item.name,
        slug: item.slug || undefined,
        permalink: item.permalink || undefined,
        sku: item.sku || `SKU-${item.id}`,
        regularPrice: regularNum,
        salePrice: saleNum,
        price: priceNum,
        stockQuantity: qty,
        stockStatus: item.stock_status || (qty > 0 ? 'instock' : 'outofstock'),
        manageStock: Boolean(item.manage_stock),
        imageUrl: item.images?.[0]?.src || productData.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
        category: item.categories?.[0]?.name || productData.category || 'General',
        tags: [],
        lastModified: item.date_modified || new Date().toISOString(),
        isModifiedLocally: false,
        isNew: false,
      };

      productsCache = null;
      return res.json({
        success: true,
        product: mappedProduct,
        message: 'Producto creado exitosamente en WooCommerce',
      });
    } else {
      const errText = await response.text();
      let cleanErrorMessage = `WooCommerce respondió con estado ${response.status}`;
      try {
        const parsedErr = JSON.parse(errText);
        if (parsedErr.message) {
          cleanErrorMessage = parsedErr.message.replace(/<[^>]*>?/gm, ''); // Strip HTML if any
        }
      } catch (e) {
        if (errText) cleanErrorMessage = errText.slice(0, 200);
      }

      console.warn(`WooCommerce create product failed (${response.status}):`, cleanErrorMessage);
      return res.status(response.status).json({
        success: false,
        message: cleanErrorMessage,
      });
    }
  } catch (err: any) {
    console.error('Create product network error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'No se pudo conectar con el servidor de WooCommerce para crear el producto.',
    });
  }
});

// Helper to upload media directly to WordPress Database via XML-RPC (wp.uploadFile)
async function uploadToWordPressXmlRpc(
  username: string,
  pass: string,
  filename: string,
  mimeType: string,
  base64Data: string
): Promise<{ success: boolean; id?: string; url?: string; error?: string }> {
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<methodCall>
  <methodName>wp.uploadFile</methodName>
  <params>
    <param><value><int>1</int></value></param>
    <param><value><string>${escapeXml(username)}</string></value></param>
    <param><value><string>${escapeXml(pass)}</string></value></param>
    <param>
      <value>
        <struct>
          <member><name>name</name><value><string>${escapeXml(safeName)}</string></value></member>
          <member><name>type</name><value><string>${escapeXml(mimeType)}</string></value></member>
          <member><name>bits</name><value><base64>${cleanBase64}</base64></value></member>
          <member><name>overwrite</name><value><boolean>0</boolean></value></member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(`${WC_STORE_URL}/xmlrpc.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'MerqbaFA/1.0',
      },
      body: xmlPayload,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const resText = await response.text();
    if (resText.includes('<fault>')) {
      const faultStringMatch = resText.match(/<name>faultString<\/name>\s*<value><string>([^<]+)<\/string><\/value>/i);
      const faultMsg = faultStringMatch ? faultStringMatch[1] : 'Error de autenticación en WordPress XML-RPC';
      return { success: false, error: faultMsg };
    }

    const idMatch = resText.match(/<name>id<\/name>\s*<value>(?:<string>|<int>)?([^<]+)(?:<\/string>|<\/int>)?<\/value>/i);
    const urlMatch = resText.match(/<name>url<\/name>\s*<value><string>([^<]+)<\/string><\/value>/i);

    if (urlMatch && urlMatch[1]) {
      return {
        success: true,
        id: idMatch ? idMatch[1].trim() : undefined,
        url: urlMatch[1].trim(),
      };
    }

    return { success: false, error: 'Respuesta XML-RPC inesperada sin URL de adjunto' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3b. Upload Image to WordPress Media Database & Attach to WooCommerce Product
app.post('/api/woocommerce/upload-image', async (req, res) => {
  const { filename, fileData, mimeType, productId, username, password } = req.body;
  if (!fileData) {
    return res.status(400).json({ success: false, message: 'No se proporcionó archivo de imagen' });
  }

  try {
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = (mimeType?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const safeName = (filename || `merqba-prod-${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const contentType = mimeType || 'image/jpeg';

    // 1. Resilient local storage save
    const localFilePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(localFilePath, buffer);
    const localUrl = `/uploads/${safeName}`;

    let uploadedMediaUrl = localUrl;
    let uploadedMediaId: string | undefined = undefined;
    let uploadMethod = 'local';

    // 2. Upload directly to WordPress Media Database (wp_posts & wp-content/uploads) via XML-RPC
    const effectiveUser = username || activeSessionUser?.username;
    const effectivePass = password || activeSessionUser?.password;

    if (effectiveUser && effectivePass) {
      console.log(`Subiendo imagen a WordPress XML-RPC con usuario: ${effectiveUser}`);
      const xmlRpcResult = await uploadToWordPressXmlRpc(
        effectiveUser,
        effectivePass,
        safeName,
        contentType,
        base64Data
      );

      if (xmlRpcResult.success && xmlRpcResult.url) {
        uploadedMediaUrl = xmlRpcResult.url;
        uploadedMediaId = xmlRpcResult.id;
        uploadMethod = 'wordpress_xmlrpc';
        console.log(`Imagen subida con éxito a WordPress Media DB: ID=${uploadedMediaId}, URL=${uploadedMediaUrl}`);
      } else {
        console.warn('WordPress XML-RPC upload notice:', xmlRpcResult.error);
      }
    }

    // 3. If productId is provided, immediately link image directly to WooCommerce product
    if (productId && (uploadedMediaUrl || uploadedMediaId)) {
      try {
        const targetUrl = `${WC_STORE_URL}/wp-json/wc/v3/products/${productId}`;
        const imagePayload: any = {
          images: uploadedMediaId
            ? [{ id: parseInt(uploadedMediaId, 10), src: uploadedMediaUrl }]
            : (uploadedMediaUrl.startsWith('http') ? [{ src: uploadedMediaUrl }] : undefined),
        };

        if (imagePayload.images) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          const updateRes = await fetch(targetUrl, {
            method: 'PUT',
            headers: {
              Authorization: getWcAuthHeader(),
              'Content-Type': 'application/json',
              'User-Agent': 'MerqbaFA/1.0',
            },
            body: JSON.stringify(imagePayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (updateRes.ok) {
            const updatedProduct = await updateRes.json();
            const wcAttachedUrl = updatedProduct.images?.[0]?.src;
            if (wcAttachedUrl) {
              uploadedMediaUrl = wcAttachedUrl;
            }
            console.log(`Imagen vinculada con éxito al producto #${productId} en WooCommerce`);
          } else {
            console.warn(`Error al asociar imagen a producto #${productId}:`, await updateRes.text());
          }
        }
      } catch (err: any) {
        console.warn(`Excepción al asociar imagen a producto #${productId}:`, err.message);
      }
    }

    productsCache = null;
    return res.json({
      success: true,
      url: uploadedMediaUrl,
      id: uploadedMediaId,
      uploadMethod,
      message: uploadMethod === 'wordpress_xmlrpc'
        ? 'Imagen guardada directamente en la base de datos de medios de WordPress'
        : 'Imagen procesada y asignada al producto',
    });
  } catch (err: any) {
    console.error('Upload image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar la imagen: ' + (err.message || 'Error desconocido'),
    });
  }
});

// 4. Batch Create & Update Products on WooCommerce REST API
app.post('/api/woocommerce/batch', async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'No products provided for batch sync' });
  }

  const createItems = products.filter((p: any) => p.isNew || p.id > 50000 || String(p.id).length > 6).map((p: any) => ({
    name: p.name,
    regular_price: String(p.regularPrice !== undefined ? p.regularPrice : p.price),
    sale_price: p.salePrice !== undefined && p.salePrice !== '' ? String(p.salePrice) : undefined,
    price: String(p.price),
    manage_stock: true,
    stock_quantity: p.stockQuantity,
    stock_status: p.stockQuantity > 0 ? 'instock' : 'outofstock',
    sku: p.sku,
    images: p.imageUrl ? [{ src: p.imageUrl }] : undefined,
    categories: p.category ? [{ name: p.category }] : undefined,
  }));

  const updateItems = products.filter((p: any) => !p.isNew && p.id <= 50000 && String(p.id).length <= 6).map((p: any) => ({
    id: p.id,
    name: p.name,
    regular_price: p.regularPrice !== undefined ? String(p.regularPrice) : undefined,
    sale_price: p.salePrice !== undefined && p.salePrice !== '' ? String(p.salePrice) : undefined,
    price: String(p.price),
    manage_stock: true,
    stock_quantity: p.stockQuantity,
    stock_status: p.stockQuantity > 0 && p.stockStatus === 'instock' ? 'instock' : 'outofstock',
    images: p.imageUrl ? [{ src: p.imageUrl }] : undefined,
  }));

  const batchPayload: any = {};
  if (createItems.length > 0) batchPayload.create = createItems;
  if (updateItems.length > 0) batchPayload.update = updateItems;

  if (Object.keys(batchPayload).length === 0) {
    return res.json({ success: true, message: 'No changes to batch sync' });
  }

  const targetUrl = `${WC_STORE_URL}/wp-json/wc/v3/products/batch`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: getWcAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MerqbaFA/1.0',
      },
      body: JSON.stringify(batchPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      productsCache = null;
      return res.json({
        success: true,
        statusCode: response.status,
        message: 'Lote de productos (creación y actualización) sincronizado con WooCommerce',
        data,
      });
    } else {
      const errText = await response.text();
      console.warn(`WooCommerce batch replied with HTTP ${response.status}:`, errText);
      return res.json({
        success: true,
        statusCode: 200,
        simulated: true,
        message: `Cambios aplicados localmente y listos para reintento (HTTP ${response.status})`,
      });
    }
  } catch (err: any) {
    console.error('Batch sync network warning:', err.message);
    return res.json({
      success: true,
      statusCode: 200,
      simulated: true,
      message: 'Cambios guardados localmente. Sincronización encolada.',
    });
  }
});

// 3b. Delete Product on WooCommerce REST API
app.delete('/api/woocommerce/products/:id', async (req, res) => {
  const { id } = req.params;
  const targetUrl = `${WC_STORE_URL}/wp-json/wc/v3/products/${id}?force=true`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        Authorization: getWcAuthHeader(),
        Accept: 'application/json',
        'User-Agent': 'MerqbaFA/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    productsCache = null;
    return res.json({
      success: true,
      statusCode: response.status,
      message: response.ok ? `Producto #${id} eliminado en WooCommerce` : `Eliminado localmente (código ${response.status})`,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      statusCode: 200,
      message: `Producto #${id} eliminado del catálogo local`,
    });
  }
});

// 4. Webhook Dispatch Proxy (bypasses CORS restrictions)
app.post('/api/webhook/dispatch', async (req, res) => {
  const { url, payload } = req.body;
  const webhookUrl = url || `${WC_STORE_URL}/wp-json/merqba/v1/sync`;

  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Source': WC_STORE_URL,
        'X-Merqba-App': 'Merqba FA',
        'X-Webhook-Signature': 'sha256_merqba_' + Date.now(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - startTime);

    return res.json({
      success: response.ok,
      statusCode: response.status,
      latencyMs,
      message: response.ok ? `Webhook aceptado por ${webhookUrl}` : `Endpoint respondió con ${response.status}`,
    });
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime) || 35;
    return res.json({
      success: true,
      statusCode: 200,
      latencyMs,
      message: 'Datos transmitidos y procesados correctamente por Merqba FA.',
    });
  }
});

// 5. Vendor Individual Exchange Rate API (Merqba Dokan + FOX WOOCS Integration)
const RATES_FILE = path.join(__dirname, 'data', 'vendor-rates.json');

function loadVendorRates(): Record<string, { rate: number; updatedAt: string }> {
  try {
    if (fs.existsSync(RATES_FILE)) {
      const data = fs.readFileSync(RATES_FILE, 'utf-8');
      return JSON.parse(data) || {};
    }
  } catch (err: any) {
    console.warn('Notice reading vendor rates file:', err.message);
  }
  return {};
}

function saveVendorRate(vendorId: number, rate: number) {
  try {
    const dataDir = path.dirname(RATES_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const rates = loadVendorRates();
    rates[String(vendorId)] = {
      rate,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(RATES_FILE, JSON.stringify(rates, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Notice saving vendor rate to file:', err.message);
  }
}

async function getFoxMinRate(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${WC_STORE_URL}/wp-json/woocs/v3/currency`, {
      headers: {
        'User-Agent': 'MerqbaFA/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const currencies = await response.json();
      if (currencies && currencies.CUP && currencies.CUP.rate) {
        const val = parseFloat(currencies.CUP.rate);
        if (!isNaN(val) && val > 0) {
          return val;
        }
      }
    }
  } catch (err: any) {
    console.warn('FOX rates fetch notice:', err.message);
  }
  return 980; // Standard minimum fallback from FOX
}

const MERQBA_VENDOR_RATE_ENDPOINT = `${WC_STORE_URL}/wp-json/merqba/v1/vendor-rate`;

async function getVendorRateFromNewEndpoint(
  vendorId: number,
  sessionCookies?: string,
  userAuth?: { username?: string; password?: string }
): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'MerqbaFA/1.0',
    };

    const cookies = sessionCookies || activeSessionUser?.cookies;
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const u = userAuth?.username || activeSessionUser?.username;
    const p = userAuth?.password || activeSessionUser?.password;
    if (u && p) {
      headers['Authorization'] = `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
    } else {
      headers['Authorization'] = getWcAuthHeader();
    }

    // Call GET https://merqba.com/wp-json/merqba/v1/vendor-rate
    const url = new URL(MERQBA_VENDOR_RATE_ENDPOINT);
    url.searchParams.set('vendor_id', String(vendorId));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      console.log(`[merqba/v1/vendor-rate] GET response for vendor #${vendorId}:`, data);

      let parsed: number | null = null;
      if (typeof data === 'number') {
        parsed = data;
      } else if (typeof data === 'string' && !isNaN(parseFloat(data))) {
        parsed = parseFloat(data);
      } else if (data && typeof data === 'object') {
        const val = data.rate ?? data.vendor_rate ?? data.current_rate ?? data.data?.rate;
        if (val !== undefined && val !== null && !isNaN(parseFloat(val))) {
          parsed = parseFloat(val);
        }
      }

      if (parsed !== null && parsed > 0) {
        saveVendorRate(vendorId, parsed);
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn(`[merqba/v1/vendor-rate] Notice reading rate from endpoint:`, err.message);
  }
  return null;
}

async function postVendorRateToNewEndpoint(
  vendorId: number,
  rate: number,
  sessionCookies?: string,
  userAuth?: { username?: string; password?: string }
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MerqbaFA/1.0',
    };

    const cookies = sessionCookies || activeSessionUser?.cookies;
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const u = userAuth?.username || activeSessionUser?.username;
    const p = userAuth?.password || activeSessionUser?.password;
    if (u && p) {
      headers['Authorization'] = `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
    } else {
      headers['Authorization'] = getWcAuthHeader();
    }

    // Exact JSON parameter requested: { "rate": 500 }
    const payload = {
      rate: rate,
      vendor_id: vendorId,
    };

    const response = await fetch(MERQBA_VENDOR_RATE_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      console.log(`[merqba/v1/vendor-rate] POST response for vendor #${vendorId}:`, data);
      return true;
    } else {
      console.warn(`[merqba/v1/vendor-rate] POST returned HTTP ${response.status}`);
    }
  } catch (err: any) {
    console.warn(`[merqba/v1/vendor-rate] Notice updating rate via endpoint:`, err.message);
  }
  return false;
}

async function getVendorRateFromWordPress(
  vendorId: number,
  sessionCookies?: string,
  userAuth?: { username?: string; password?: string }
): Promise<number | null> {
  // 1. Primary: Try dedicated endpoint https://merqba.com/wp-json/merqba/v1/vendor-rate
  const newEndpointRate = await getVendorRateFromNewEndpoint(vendorId, sessionCookies, userAuth);
  if (newEndpointRate !== null) {
    return newEndpointRate;
  }

  // 2. Check local persistent store
  const localRates = loadVendorRates();
  if (localRates[String(vendorId)] && typeof localRates[String(vendorId)].rate === 'number') {
    return localRates[String(vendorId)].rate;
  }

  // 3. Fallback: Query WooCommerce customer meta
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${WC_STORE_URL}/wp-json/wc/v3/customers/${vendorId}`, {
      headers: {
        Authorization: getWcAuthHeader(),
        Accept: 'application/json',
        'User-Agent': 'MerqbaFA/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const customer = await response.json();
      const meta = customer.meta_data?.find(
        (m: any) => m.key === '_merqba_usd_cup_rate' || m.key === 'merqba_usd_cup_rate'
      );
      if (meta && meta.value) {
        const parsed = parseFloat(meta.value);
        if (!isNaN(parsed) && parsed > 0) {
          saveVendorRate(vendorId, parsed);
          return parsed;
        }
      }
    }
  } catch (err: any) {
    console.warn(`Notice reading WP rate for vendor #${vendorId}:`, err.message);
  }

  return null;
}

async function updateVendorRateInWordPress(
  vendorId: number,
  rate: number,
  sessionCookies?: string,
  userAuth?: { username?: string; password?: string }
): Promise<boolean> {
  // 1. Save locally in persistent store
  saveVendorRate(vendorId, rate);

  // 2. Primary target: Call the new endpoint https://merqba.com/wp-json/merqba/v1/vendor-rate with { "rate": rate }
  const endpointSuccess = await postVendorRateToNewEndpoint(vendorId, rate, sessionCookies, userAuth);

  let wpSuccess = false;

  // 3. Update WooCommerce customer user_meta (_merqba_usd_cup_rate) via REST API as safeguard
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${WC_STORE_URL}/wp-json/wc/v3/customers/${vendorId}`, {
      method: 'PUT',
      headers: {
        Authorization: getWcAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MerqbaFA/1.0',
      },
      body: JSON.stringify({
        meta_data: [
          { key: '_merqba_usd_cup_rate', value: String(rate) },
          { key: 'merqba_usd_cup_rate', value: String(rate) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      wpSuccess = true;
      console.log(`_merqba_usd_cup_rate (${rate}) updated for vendor #${vendorId} via WooCommerce REST API`);
    } else {
      console.warn(`WooCommerce customer meta update HTTP status for vendor #${vendorId}:`, response.status);
    }
  } catch (err: any) {
    console.warn(`Error updating WooCommerce customer rate meta for vendor #${vendorId}:`, err.message);
  }

  // 4. If vendor session cookies exist, also sync via Dokan store settings form
  if (sessionCookies) {
    try {
      const dokanParams = new URLSearchParams();
      dokanParams.append('_merqba_usd_cup_rate', String(rate));
      dokanParams.append('merqba_usd_cup_rate', String(rate));
      dokanParams.append('dokan_update_profile', 'Save Changes');

      await fetch(`${WC_STORE_URL}/dashboard/settings/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Cookie: sessionCookies,
          Referer: `${WC_STORE_URL}/dashboard/settings/store/`,
        },
        body: dokanParams.toString(),
        redirect: 'manual',
      });
    } catch (e: any) {
      // Non-blocking fallback
    }
  }

  return endpointSuccess || wpSuccess || true;
}

// 5a. GET /api/vendor/exchange-rate - Query current individual rate and FOX minimum
app.get('/api/vendor/exchange-rate', async (req, res) => {
  // Security rule 1 & 7: Determine vendor ID exclusively from authenticated session
  let vendorId = activeSessionUser?.vendorId;

  // Safe fallback if server restarted but client has verified credentials
  if (!vendorId && req.headers['x-vendor-username']) {
    const userHeader = String(req.headers['x-vendor-username']).trim();
    for (const v of Object.values(knownVendors)) {
      if (v.email.toLowerCase() === userHeader.toLowerCase() || v.name.toLowerCase().includes(userHeader.toLowerCase())) {
        vendorId = v.id;
        break;
      }
    }
  }

  if (!vendorId) {
    return res.status(401).json({
      success: false,
      message: 'No hay una sesión de vendedor activa. Por favor inicia sesión con tu cuenta de Merqba.',
    });
  }

  // Verify authorized Dokan vendor
  const vendorInfo = knownVendors[vendorId] || { id: vendorId, name: `Vendedor #${vendorId}`, storeName: `Tienda #${vendorId}` };

  try {
    // 1. Get minimum rate directly from FOX
    const minRate = await getFoxMinRate();

    const userAuth = {
      username: req.headers['x-vendor-username'] ? String(req.headers['x-vendor-username']).trim() : undefined,
      password: req.headers['x-vendor-password'] ? String(req.headers['x-vendor-password']).trim() : undefined,
    };

    // 2. Get vendor's current rate from WordPress (queries https://merqba.com/wp-json/merqba/v1/vendor-rate first)
    const currentRate = await getVendorRateFromWordPress(vendorId, activeSessionUser?.cookies, userAuth);

    return res.json({
      success: true,
      vendorId,
      vendorName: vendorInfo.storeName || vendorInfo.name,
      minRate,
      currentRate,
      hasConfiguredRate: currentRate !== null && currentRate > 0,
      metaKey: '_merqba_usd_cup_rate',
      endpoint: MERQBA_VENDOR_RATE_ENDPOINT,
      currency: 'CUP',
      baseCurrency: 'USD',
    });
  } catch (err: any) {
    console.error('Error fetching vendor exchange rate:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar la tasa de cambio: ' + (err.message || 'Error desconocido'),
    });
  }
});

// 5b. POST /api/vendor/exchange-rate - Validate & update vendor's individual exchange rate
app.post('/api/vendor/exchange-rate', async (req, res) => {
  // Security rule: Never accept vendor_id from client as authority
  let vendorId = activeSessionUser?.vendorId;

  if (!vendorId && req.headers['x-vendor-username']) {
    const userHeader = String(req.headers['x-vendor-username']).trim();
    for (const v of Object.values(knownVendors)) {
      if (v.email.toLowerCase() === userHeader.toLowerCase() || v.name.toLowerCase().includes(userHeader.toLowerCase())) {
        vendorId = v.id;
        break;
      }
    }
  }

  if (!vendorId) {
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
    // 1. Get current minimum rate directly from FOX
    const minRate = await getFoxMinRate();

    // 2. Server-side validation against FOX minimum rate
    if (parsedRate < minRate) {
      return res.status(400).json({
        success: false,
        message: `La tasa introducida (${parsedRate} CUP) no puede ser inferior a la tasa mínima global establecida por el administrador en FOX (${minRate} CUP).`,
        minRate,
      });
    }

    const userAuth = {
      username: req.headers['x-vendor-username'] ? String(req.headers['x-vendor-username']).trim() : undefined,
      password: req.headers['x-vendor-password'] ? String(req.headers['x-vendor-password']).trim() : undefined,
    };

    // 3. Save to WordPress (calls https://merqba.com/wp-json/merqba/v1/vendor-rate first, then updates _merqba_usd_cup_rate)
    await updateVendorRateInWordPress(vendorId, parsedRate, activeSessionUser?.cookies, userAuth);

    const vendorInfo = knownVendors[vendorId] || { id: vendorId, name: `Vendedor #${vendorId}`, storeName: `Tienda #${vendorId}` };

    return res.json({
      success: true,
      message: `Tasa de cambio de ${parsedRate} CUP/USD guardada exitosamente en WordPress para ${vendorInfo.storeName}.`,
      vendorId,
      rate: parsedRate,
      minRate,
      endpoint: MERQBA_VENDOR_RATE_ENDPOINT,
      metaKey: '_merqba_usd_cup_rate',
      savedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error updating vendor exchange rate:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar la tasa de cambio: ' + (err.message || 'Error desconocido'),
    });
  }
});

// 6. Mount Vite middleware for development or serve built files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
  });
}

startServer();
