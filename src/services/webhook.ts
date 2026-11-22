import { Product, DokanVendor, StoreConfig, WebhookLog } from '../types';
import { addStoredWebhookLog } from './storage';

export interface DispatchWebhookResult {
  success: boolean;
  statusCode: number;
  message: string;
  latencyMs: number;
  payload: any;
  log?: WebhookLog;
  skipped?: boolean;
}

export type IncrementalAction = 'updated' | 'created' | 'deleted';

interface QueuedProductEvent {
  action: IncrementalAction;
  product: Partial<Product> & { id: number };
  queuedAt: number;
}

const MAX_RETRIES = 2;
const DEFAULT_DEBOUNCE_MS = 800;

const pendingQueue = new Map<number, QueuedProductEvent>();
let queueDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
const completedOperationIds = new Set<string>();

function getAuthHeaders(): Record<string, string> {
  const token =
    sessionStorage.getItem('merqba_session_token') ||
    localStorage.getItem('merqba_session_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['x-session-token'] = token;
  return headers;
}

export const generateIncrementalWebhookPayload = (
  vendor: DokanVendor,
  events: QueuedProductEvent[],
  config: StoreConfig,
  triggerType: 'manual_button' | 'realtime_change' | 'sync_refresh' = 'realtime_change'
) => {
  return {
    event: 'merqba.vendor_products.incremental_sync',
    trigger: triggerType,
    marketplace: 'Merqba FA',
    app: 'Merqba FA',
    timestamp: new Date().toISOString(),
    store: {
      url: config.storeUrl,
      currency: config.currency,
      currency_symbol: config.currencySymbol,
    },
    vendor: {
      id: vendor.id,
      store_name: vendor.storeName,
      vendor_name: vendor.name,
      store_url: vendor.storeUrl,
    },
    metrics: {
      changed_products_count: events.length,
    },
    // Incremental: ONLY modified, created or deleted products (never the full catalog)
    products: events.map((ev) => ({
      id: ev.product.id,
      action: ev.action,
      name: ev.product.name,
      sku: ev.product.sku,
      price: ev.product.price,
      regular_price: ev.product.regularPrice,
      sale_price: ev.product.salePrice ?? null,
      stock_quantity: ev.product.stockQuantity,
      stock_status: ev.product.stockStatus,
      updated_at: ev.product.lastModified || new Date().toISOString(),
    })),
  };
};

async function sendWithRetry(
  targetUrl: string,
  payload: any,
  deliveryId: string
): Promise<{ ok: boolean; statusCode: number; latencyMs: number; message: string; signatureAlg?: string }> {
  let attempt = 0;
  let lastStatus = 502;
  let lastMessage = 'Error al enviar notificación';
  let latencyMs = 0;

  while (attempt <= MAX_RETRIES) {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/webhook/dispatch', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ url: targetUrl, payload, deliveryId }),
      });
      latencyMs = Math.round(performance.now() - t0);
      const data = await res.json().catch(() => ({}));
      lastStatus = data.statusCode || res.status;

      if (res.ok && data.success) {
        return {
          ok: true,
          statusCode: lastStatus,
          latencyMs: data.latencyMs || latencyMs,
          message: data.message || 'Sincronización incremental completada',
          signatureAlg: data.signatureAlg,
        };
      }
      lastMessage = data.message || `El servidor respondió HTTP ${lastStatus}`;
      // Do not retry 4xx client errors
      if (lastStatus >= 400 && lastStatus < 500 && lastStatus !== 429) {
        break;
      }
    } catch (err: any) {
      latencyMs = Math.round(performance.now() - t0);
      lastMessage = err?.message || 'Error de conexión';
    }

    attempt++;
    if (attempt <= MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt - 1)));
    }
  }

  return {
    ok: false,
    statusCode: lastStatus,
    latencyMs,
    message: lastMessage,
  };
}

export const dispatchProductsWebhook = async (
  vendor: DokanVendor,
  changedProducts: Array<Partial<Product> & { id: number }>,
  config: StoreConfig,
  triggerType: 'manual_button' | 'realtime_change' | 'sync_refresh' = 'manual_button',
  action: IncrementalAction = 'updated'
): Promise<DispatchWebhookResult> => {
  const webhookUrl = (config.webhookUrl || '').trim();

  // Skip silently if no valid external webhook URL is configured or no products changed
  if (!webhookUrl || (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) || changedProducts.length === 0) {
    return {
      success: true,
      skipped: true,
      statusCode: 204,
      message: 'Sin destino webhook activo o sin cambios incrementales para notificar.',
      latencyMs: 0,
      payload: null,
    };
  }

  const events: QueuedProductEvent[] = changedProducts.map((p) => ({
    action,
    product: p,
    queuedAt: Date.now(),
  }));

  const deliveryId = `del_${vendor.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (completedOperationIds.has(deliveryId)) {
    return {
      success: true,
      skipped: true,
      statusCode: 200,
      message: 'Operación ya procesada.',
      latencyMs: 0,
      payload: null,
    };
  }

  const payload = generateIncrementalWebhookPayload(vendor, events, config, triggerType);
  const result = await sendWithRetry(webhookUrl, payload, deliveryId);

  if (result.ok) {
    completedOperationIds.add(deliveryId);
    if (completedOperationIds.size > 200) {
      const first = completedOperationIds.values().next().value;
      if (first) completedOperationIds.delete(first);
    }
  }

  const log: WebhookLog = {
    id: deliveryId,
    timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    url: webhookUrl,
    event: 'merqba.vendor_products.incremental_sync',
    status: result.ok ? 'success' : 'failed',
    statusCode: result.statusCode,
    latencyMs: result.latencyMs,
    productsSentCount: changedProducts.length,
    payload,
    responseMessage: result.message,
  };

  addStoredWebhookLog(log);

  return {
    success: result.ok,
    statusCode: result.statusCode,
    message: result.message,
    latencyMs: result.latencyMs,
    payload,
    log,
  };
};

// Deduplicated incremental queue with configurable debounce
export function enqueueIncrementalWebhook(
  vendor: DokanVendor,
  product: Partial<Product> & { id: number },
  action: IncrementalAction,
  config: StoreConfig,
  onComplete?: (log: WebhookLog) => void,
  debounceMs = DEFAULT_DEBOUNCE_MS
): void {
  const webhookUrl = (config.webhookUrl || '').trim();
  if (!config.realtimeSync || !webhookUrl || (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://'))) {
    return;
  }

  // Deduplicate: overwrite older pending event for the same productId
  pendingQueue.set(product.id, {
    action,
    product,
    queuedAt: Date.now(),
  });

  if (queueDebounceTimer) {
    clearTimeout(queueDebounceTimer);
  }

  queueDebounceTimer = setTimeout(async () => {
    if (isFlushing || pendingQueue.size === 0) return;
    isFlushing = true;

    const batchEvents = Array.from(pendingQueue.values());
    pendingQueue.clear();

    try {
      const deliveryId = `q_${vendor.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const payload = generateIncrementalWebhookPayload(vendor, batchEvents, config, 'realtime_change');
      const res = await sendWithRetry(webhookUrl, payload, deliveryId);

      // Re-queue failed items up to once if desired without infinite loops
      const log: WebhookLog = {
        id: deliveryId,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        url: webhookUrl,
        event: 'merqba.vendor_products.incremental_sync',
        status: res.ok ? 'success' : 'failed',
        statusCode: res.statusCode,
        latencyMs: res.latencyMs,
        productsSentCount: batchEvents.length,
        payload,
        responseMessage: res.message,
      };
      addStoredWebhookLog(log);
      if (onComplete) onComplete(log);
    } finally {
      isFlushing = false;
    }
  }, debounceMs);
}
