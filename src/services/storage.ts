import { Product, DokanVendor, StoreConfig, WebhookLog } from '../types';
import { INITIAL_PRODUCTS, INITIAL_VENDORS, DEFAULT_CONFIG } from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'merchant_pulse_products_v1',
  VENDORS: 'merchant_pulse_vendors_v1',
  CURRENT_VENDOR_ID: 'merchant_pulse_current_vendor_id',
  CONFIG: 'merchant_pulse_store_config',
  WEBHOOK_LOGS: 'merchant_pulse_webhook_logs',
};

export const getStoredProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.some((p: any) => p.vendorId === 14 || p.vendorId === 22 || p.vendorId === 35 || !p.vendorId)) {
      const migrated = parsed.map((p: any) => ({
        ...p,
        vendorId: p.vendorId === 14 || !p.vendorId ? 1 : (p.vendorId === 22 ? 87 : 191),
      }));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(migrated));
      return migrated;
    }
    return parsed;
  } catch (e) {
    console.error('Error loading products from localStorage', e);
    return INITIAL_PRODUCTS;
  }
};

export const saveStoredProducts = (products: Product[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Error saving products to localStorage', e);
  }
};

export const getStoredVendors = (): DokanVendor[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENDORS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(INITIAL_VENDORS));
      return INITIAL_VENDORS;
    }
    const parsed = JSON.parse(raw);
    // If old mock vendors exist (e.g. ID 14), upgrade to real vendors
    if (Array.isArray(parsed) && parsed.some((v: any) => v.id === 14)) {
      localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(INITIAL_VENDORS));
      return INITIAL_VENDORS;
    }
    return parsed;
  } catch (e) {
    console.error('Error loading vendors from localStorage', e);
    return INITIAL_VENDORS;
  }
};

export const saveStoredVendors = (vendors: DokanVendor[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));
  } catch (e) {
    console.error('Error saving vendors to localStorage', e);
  }
};

export const getCurrentVendorId = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_VENDOR_ID);
    if (raw) {
      const parsed = parseInt(raw, 10);
      // Migrate away from old mock ID 14
      if (!isNaN(parsed) && parsed !== 14) return parsed;
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_VENDOR_ID, '1');
    return 1;
  } catch (e) {
    return 1;
  }
};

export const setCurrentVendorId = (id: number): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_VENDOR_ID, id.toString());
  } catch (e) {
    console.error('Error saving current vendor id', e);
  }
};

export const getStoredConfig = (): StoreConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(DEFAULT_CONFIG));
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
};

export const saveStoredConfig = (config: StoreConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving config', e);
  }
};

export const getStoredWebhookLogs = (): WebhookLog[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WEBHOOK_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const addStoredWebhookLog = (log: WebhookLog): void => {
  try {
    const logs = getStoredWebhookLogs();
    const updated = [log, ...logs].slice(0, 30); // keep last 30
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_LOGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving webhook log', e);
  }
};

export const resetAllData = (): { products: Product[]; vendors: DokanVendor[]; config: StoreConfig } => {
  localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
  localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(INITIAL_VENDORS));
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(DEFAULT_CONFIG));
  localStorage.setItem(STORAGE_KEYS.CURRENT_VENDOR_ID, INITIAL_VENDORS[0].id.toString());
  localStorage.removeItem(STORAGE_KEYS.WEBHOOK_LOGS);
  return {
    products: [],
    vendors: INITIAL_VENDORS,
    config: DEFAULT_CONFIG,
  };
};
