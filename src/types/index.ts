export interface DokanVendor {
  id: number;
  name: string;
  storeName: string;
  email: string;
  avatar: string;
  banner: string;
  rating: number;
  ratingCount: number;
  storeUrl: string;
  phone: string;
  address: string;
}

export type StockStatus = 'instock' | 'outofstock' | 'onbackorder';

export interface Product {
  id: number;
  vendorId: number;
  name: string;
  sku: string;
  regularPrice: number;
  salePrice?: number;
  price: number;
  stockQuantity: number;
  stockStatus: StockStatus;
  manageStock: boolean;
  imageUrl: string;
  category: string;
  tags?: string[];
  lastModified?: string;
  isModifiedLocally?: boolean;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  url: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  statusCode: number;
  latencyMs: number;
  productsSentCount: number;
  payload: any;
  responseMessage: string;
}

export interface StoreConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  webhookUrl: string;
  realtimeSync: boolean;
  currency: string;
  currencySymbol: string;
}

export type StatusFilter = 'all' | 'instock' | 'outofstock' | 'lowstock' | 'modified';
export type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc' | 'id-asc' | 'id-desc';
