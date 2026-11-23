/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  getStoredProducts,
  saveStoredProducts,
  getStoredVendors,
  saveStoredVendors,
  getCurrentVendorId,
  setCurrentVendorId,
  getStoredConfig,
  saveStoredConfig,
  getStoredWebhookLogs,
  resetAllData,
} from './services/storage';
import { dispatchProductsWebhook, enqueueIncrementalWebhook } from './services/webhook';
import { Product, DokanVendor, StoreConfig, StatusFilter, SortOption, WebhookLog } from './types';
import { Header } from './components/Header';
import { VendorBar } from './components/VendorBar';
import { FilterBar } from './components/FilterBar';
import { ProductCard } from './components/ProductCard';
import { ProductQuickEditModal } from './components/ProductQuickEditModal';
import { CreateProductModal } from './components/CreateProductModal';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal';
import { ShareProductModal } from './components/ShareProductModal';
import { LoginModal } from './components/LoginModal';
import { StoreConfigModal } from './components/StoreConfigModal';
import { BulkEditModal, BulkEditChanges } from './components/BulkEditModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { BottomMobileBar } from './components/BottomMobileBar';
import { GuidedTour } from './components/GuidedTour';
import { exportProductsToCsv } from './services/csvExport';
import {
  Download,
  PackageSearch,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Zap,
  LogIn,
  LogOut,
  Layers,
  CheckSquare,
  Square,
  Check,
  DollarSign,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function App() {
  const hasAuthCookie = typeof document !== 'undefined' && document.cookie.split(';').some(c => c.trim().startsWith('merqba_auth=true'));
  const getInitialVendorId = () => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const vendorCookie = cookies.find(c => c.trim().startsWith('merqba_vendor_id='));
      if (vendorCookie) {
        const id = parseInt(vendorCookie.split('=')[1], 10);
        if (!isNaN(id)) return id;
      }
    }
    return getCurrentVendorId();
  };

  // Core state
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<DokanVendor[]>([]);
  const [currentVendorId, setActiveVendorId] = useState<number>(getInitialVendorId());
  const [config, setConfig] = useState<StoreConfig>(getStoredConfig());
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);

  // Operational states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Ahora');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');

  // Mass / Bulk Editing state
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [quickPriceInput, setQuickPriceInput] = useState<string>('');

  // Server Pagination & Categories state
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 50;
  const [totalServerProducts, setTotalServerProducts] = useState(0);
  const [totalServerPages, setTotalServerPages] = useState(1);
  const [serverCategories, setServerCategories] = useState<string[]>([]);

  // Modal states
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(!hasAuthCookie);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasAuthCookie);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [sharingProduct, setSharingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Refs for fresh closures, request cancellation, and debouncing
  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const isSyncInFlightRef = useRef<boolean>(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Online / Offline connectivity listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast(
        'success',
        'Conexión Restablecida',
        'Tu dispositivo está en línea nuevamente. Puedes sincronizar o aplicar cambios pendientes.'
      );
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast(
        'info',
        'Modo Offline Activo',
        'Sin internet. Puedes seguir editando nombres, fotos, precios y stock con normalidad; todo se guarda localmente en tu dispositivo.'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize data on mount: verify live server session & do not keep dead auth state
  useEffect(() => {
    if (hasAuthCookie) {
      const loadedProducts = getStoredProducts();
      setProducts(loadedProducts);

      const token =
        sessionStorage.getItem('merqba_session_token') ||
        localStorage.getItem('merqba_session_token');
      const headers: Record<string, string> = {};
      if (token) headers['x-session-token'] = token;

      fetch('/api/woocommerce/status', { headers, credentials: 'include' })
        .then((r) => r.json())
        .then((status) => {
          if (status && status.isAuthenticated === false) {
            document.cookie = 'merqba_auth=; path=/; max-age=0';
            document.cookie = 'merqba_vendor_id=; path=/; max-age=0';
            sessionStorage.removeItem('merqba_session_token');
            localStorage.removeItem('merqba_session_token');
            setIsAuthenticated(false);
            setIsLoginOpen(true);
            addToast(
              'info',
              'Sesión Expirada',
              'Por seguridad, vuelve a iniciar sesión para guardar cambios en tu tienda.'
            );
          } else if (status && status.isAuthenticated === true) {
            if (status.activeVendorId) {
              setActiveVendorId(status.activeVendorId);
              setCurrentVendorId(status.activeVendorId);
            }
            if (loadedProducts.length === 0) {
              fetchProductsPage({ page: 1, search: '', refresh: false, silent: true });
            }
          }
        })
        .catch(() => {});
    } else {
      setProducts([]);
    }
    const loadedVendors = getStoredVendors();
    const activeId = getCurrentVendorId();
    const loadedLogs = getStoredWebhookLogs();

    setVendors(loadedVendors);
    setActiveVendorId(activeId);
    setWebhookLogs(loadedLogs);
    setLastSyncTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  }, [hasAuthCookie]);

  // Debounced save to localStorage so large catalogs don't block UI thread
  useEffect(() => {
    if (!isAuthenticated || products.length === 0) return;
    if (storageSaveTimerRef.current) clearTimeout(storageSaveTimerRef.current);
    storageSaveTimerRef.current = setTimeout(() => {
      saveStoredProducts(products);
    }, 450);
    return () => {
      if (storageSaveTimerRef.current) clearTimeout(storageSaveTimerRef.current);
    };
  }, [products, isAuthenticated]);

  // First-login automatic onboarding tour
  useEffect(() => {
    if (!isAuthenticated || isLoginOpen || isSyncing) return;
    try {
      const tourDone = localStorage.getItem('merqba_onboarding_tour_done_v1');
      if (!tourDone) {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 450);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore storage errors
    }
  }, [isAuthenticated, isLoginOpen, isSyncing]);

  const handleCloseTour = () => {
    setIsTourOpen(false);
    try {
      localStorage.setItem('merqba_onboarding_tour_done_v1', 'true');
    } catch {
      // ignore storage errors
    }
  };

  // Current logged in vendor
  const currentVendor = useMemo(() => {
    return vendors.find((v) => v.id === currentVendorId) || vendors[0] || {
      id: 1,
      name: 'Yadiel Moya',
      storeName: 'Merqba',
      email: 'yadielmvizcaino@gmail.com',
      avatar: 'https://merqba.com/wp-content/uploads/2026/05/merqba-logo-icon.png',
      banner: '',
      rating: 5.0,
      ratingCount: 56,
      storeUrl: 'https://merqba.com',
      phone: '',
      address: '',
    };
  }, [vendors, currentVendorId]);

  // VENDOR ISOLATION: Do not return any products unless authenticated
  const vendorProducts = useMemo(() => {
    if (!isAuthenticated) return [];
    return products.filter((p) => p.vendorId === currentVendor.id);
  }, [products, currentVendor.id, isAuthenticated]);

  // Available categories for this vendor (combines cached server categories + current page)
  const vendorCategories = useMemo(() => {
    const set = new Set<string>(serverCategories);
    vendorProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [vendorProducts, serverCategories]);

  // Filtered & Sorted products list
  const displayProducts = useMemo(() => {
    return vendorProducts
      .filter((product) => {
        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchName = product.name.toLowerCase().includes(query);
          const matchSku = product.sku.toLowerCase().includes(query);
          const matchId = product.id.toString().includes(query);
          if (!matchName && !matchSku && !matchId) return false;
        }

        // Status filter
        if (statusFilter === 'instock') {
          if (product.stockStatus !== 'instock' || product.stockQuantity <= 0) return false;
        } else if (statusFilter === 'outofstock') {
          if (product.stockStatus === 'instock' && product.stockQuantity > 0) return false;
        } else if (statusFilter === 'lowstock') {
          if (product.stockQuantity > 5 || product.stockQuantity <= 0) return false;
        } else if (statusFilter === 'modified') {
          if (!product.isModifiedLocally) return false;
        }

        // Category filter
        if (selectedCategory !== 'all') {
          if (product.category !== selectedCategory) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'name-asc':
            return a.name.localeCompare(b.name);
          case 'name-desc':
            return b.name.localeCompare(a.name);
          case 'price-asc':
            return a.price - b.price;
          case 'price-desc':
            return b.price - a.price;
          case 'stock-asc':
            return a.stockQuantity - b.stockQuantity;
          case 'stock-desc':
            return b.stockQuantity - a.stockQuantity;
          case 'id-desc':
            return b.id - a.id;
          case 'id-asc':
            return a.id - b.id;
          default:
            return 0;
        }
      });
  }, [vendorProducts, searchQuery, statusFilter, selectedCategory, sortOption]);

  // Pending changes count for current vendor
  const pendingChangesCount = useMemo(() => {
    return vendorProducts.filter((p) => p.isModifiedLocally).length;
  }, [vendorProducts]);

  // Selected products for mass/bulk editing
  const selectedProducts = useMemo(() => {
    const selectedSet = new Set(selectedProductIds);
    return vendorProducts.filter((p) => selectedSet.has(p.id));
  }, [vendorProducts, selectedProductIds]);

  // Bulk selection handlers
  const handleToggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedProductIds.length === displayProducts.length && displayProducts.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(displayProducts.map((p) => p.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedProductIds([]);
  };

  // Smart helper: Select all products that share the exact same price
  const handleSelectSamePrice = (targetPrice: number) => {
    const matching = vendorProducts.filter((p) => p.price === targetPrice).map((p) => p.id);
    setSelectedProductIds(matching);
    addToast(
      'info',
      'Productos Seleccionados',
      `Se seleccionaron ${matching.length} productos con precio ${config.currencySymbol}${targetPrice.toFixed(2)} para edición en masa.`
    );
  };

  // Apply bulk changes from modal
  const handleApplyBulkChanges = (changes: BulkEditChanges) => {
    if (selectedProductIds.length === 0) return;

    const targetSet = new Set(selectedProductIds);

    setProducts((prev) =>
      prev.map((p) => {
        if (!targetSet.has(p.id)) return p;

        let newPrice = p.price;
        let newRegular = p.regularPrice;
        let newSale = p.salePrice;
        let newStock = p.stockQuantity;
        let newStatus = p.stockStatus;
        let newCategory = p.category;

        if (changes.updatePrice && changes.priceValue !== undefined) {
          if (changes.priceMode === 'fixed') {
            newPrice = changes.priceValue;
            newRegular = changes.priceValue;
            if (!changes.updateSalePrice) {
              newSale = undefined;
            }
          } else if (changes.priceMode === 'percent_increase') {
            newPrice = Math.round(p.price * (1 + changes.priceValue / 100) * 100) / 100;
            newRegular = Math.round(p.regularPrice * (1 + changes.priceValue / 100) * 100) / 100;
          } else if (changes.priceMode === 'percent_decrease') {
            newPrice = Math.max(0, Math.round(p.price * (1 - changes.priceValue / 100) * 100) / 100);
            newRegular = Math.max(0, Math.round(p.regularPrice * (1 - changes.priceValue / 100) * 100) / 100);
          }
        }

        if (changes.updateSalePrice) {
          if (changes.salePriceValue === null) {
            newSale = undefined;
          } else if (changes.salePriceValue !== undefined) {
            newSale = changes.salePriceValue;
          }
        }

        if (changes.updateStock && changes.stockQuantity !== undefined) {
          newStock = changes.stockQuantity;
          newStatus = newStock > 0 ? 'instock' : 'outofstock';
        }

        if (changes.updateStatus && changes.stockStatus) {
          newStatus = changes.stockStatus;
          if (newStatus === 'outofstock') {
            newStock = 0;
          } else if (newStatus === 'instock' && newStock === 0) {
            newStock = 10;
          }
        }

        if (changes.updateCategory && changes.category) {
          newCategory = changes.category;
        }

        return {
          ...p,
          price: newPrice,
          regularPrice: newRegular,
          salePrice: newSale,
          stockQuantity: newStock,
          stockStatus: newStatus,
          category: newCategory,
          isModifiedLocally: true,
          lastModified: new Date().toISOString(),
        };
      })
    );

    addToast(
      'success',
      'Edición en Masa Aplicada',
      `Se actualizaron ${selectedProductIds.length} productos con éxito.`
    );

    if (config.realtimeSync) {
      const changedSet = new Set(selectedProductIds);
      const updatedTargets = productsRef.current.filter((p) => changedSet.has(p.id));
      for (const item of updatedTargets) {
        enqueueIncrementalWebhook(
          currentVendor,
          item,
          'updated',
          config,
          (log) => setWebhookLogs((prev) => [log, ...prev].slice(0, 30)),
          900
        );
      }
    }
  };

  // Quick inline price update for all selected products
  const handleQuickPriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(quickPriceInput);
    if (isNaN(parsed) || parsed < 0) {
      addToast('error', 'Precio Inválido', 'Por favor ingresa un precio numérico válido.');
      return;
    }

    handleApplyBulkChanges({
      updatePrice: true,
      priceMode: 'fixed',
      priceValue: parsed,
      updateSalePrice: false,
      updateStock: false,
      updateStatus: false,
      updateCategory: false,
    });
    setQuickPriceInput('');
  };

  // Helper to obtain authenticated session headers
  const getAuthHeaders = (): Record<string, string> => {
    const token =
      sessionStorage.getItem('merqba_session_token') ||
      localStorage.getItem('merqba_session_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['x-session-token'] = token;
    }
    return headers;
  };

  const handleUpdateProduct = async (updated: Product) => {
    const previous = productsRef.current.find((item) => item.id === updated.id);

    // 1. Optimistic UI update
    setProducts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );

    // Build minimal delta payload (send only modified fields)
    const deltaPayload: Record<string, any> = {};
    if (!previous || updated.name !== previous.name) deltaPayload.name = updated.name;
    if (!previous || updated.regularPrice !== previous.regularPrice || updated.price !== previous.price) {
      deltaPayload.price = updated.price;
      deltaPayload.regularPrice = updated.regularPrice !== undefined ? updated.regularPrice : updated.price;
    }
    if (!previous || updated.salePrice !== previous.salePrice) {
      deltaPayload.salePrice = updated.salePrice !== undefined ? updated.salePrice : null;
    }
    if (!previous || updated.stockStatus !== previous.stockStatus || updated.stockQuantity !== previous.stockQuantity) {
      deltaPayload.stockStatus = updated.stockStatus;
      deltaPayload.stockQuantity = updated.stockQuantity;
    }
    if (updated.imageUrl && updated.imageUrl.startsWith('http') && (!previous || updated.imageUrl !== previous.imageUrl)) {
      deltaPayload.imageUrl = updated.imageUrl;
      if (updated.imageId) deltaPayload.imageId = updated.imageId;
    }
    if (Object.keys(deltaPayload).length === 0) {
      deltaPayload.price = updated.price;
      deltaPayload.regularPrice = updated.regularPrice !== undefined ? updated.regularPrice : updated.price;
    }

    // 2. Persist single product delta immediately to store
    try {
      const res = await fetch(`/api/woocommerce/products/${updated.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(deltaPayload),
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401 || data?.authRequired) {
        addToast(
          'error',
          'Sesión Expirada',
          'Vuelve a iniciar sesión para guardar el precio en tu tienda.'
        );
        setIsLoginOpen(true);
        return;
      }

      if (res.ok && data && data.savedToWooCommerce) {
        const confirmedProduct: Product = {
          ...updated,
          price: data.price !== undefined ? data.price : updated.price,
          regularPrice: data.regularPrice !== undefined ? data.regularPrice : updated.regularPrice,
          salePrice: data.salePrice,
          stockStatus: data.stockStatus || updated.stockStatus,
          stockQuantity: data.stockQuantity !== undefined ? data.stockQuantity : updated.stockQuantity,
          isModifiedLocally: false,
        };
        setProducts((prev) =>
          prev.map((item) => (item.id === updated.id ? confirmedProduct : item))
        );
        const confirmedPriceDisplay = confirmedProduct.price;
        addToast(
          'success',
          'Precio y Producto Actualizados',
          `"${updated.name.slice(0, 25)}" actualizado en tu tienda (${config.currencySymbol}${Number(confirmedPriceDisplay).toFixed(2)}).`
        );

        // 3. Incremental realtime webhook queue (ONLY this product, never full catalog)
        if (config.realtimeSync) {
          enqueueIncrementalWebhook(
            currentVendor,
            confirmedProduct,
            'updated',
            config,
            (log) => setWebhookLogs((prev) => [log, ...prev].slice(0, 30))
          );
        }
      } else {
        addToast(
          'error',
          'No se pudo actualizar en la tienda',
          data?.message || `"${updated.name.slice(0, 25)}" quedó pendiente localmente. Pulsa "Aplicar Cambios" para reintentar.`
        );
      }
    } catch (err) {
      console.warn('Product update notice:', err);
      addToast(
        'info',
        'Cambio Guardado Localmente',
        `"${updated.name.slice(0, 25)}" guardado localmente. Pulsa "Aplicar Cambios" para sincronizar.`
      );
    }
  };

  // Delete product handler (awaits real confirmation from server with auth headers)
  const handleConfirmDeleteProduct = async (product: Product) => {
    setIsDeletingProduct(true);
    try {
      const res = await fetch(`/api/woocommerce/products/${product.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || data?.authRequired) {
        addToast('error', 'Sesión Expirada', 'Vuelve a iniciar sesión para eliminar productos.');
        setIsLoginOpen(true);
        return;
      }

      if (!res.ok || !data.success) {
        addToast(
          'error',
          'No se pudo eliminar el producto',
          data?.message || 'El servidor no confirmó la eliminación en tu tienda.'
        );
        return;
      }

      const updatedList = products.filter((p) => p.id !== product.id);
      setProducts(updatedList);
      saveStoredProducts(updatedList);
      setTotalServerProducts((prev) => Math.max(0, prev - 1));

      if (config.realtimeSync) {
        enqueueIncrementalWebhook(
          currentVendor,
          product,
          'deleted',
          config,
          (log) => setWebhookLogs((prev) => [log, ...prev].slice(0, 30))
        );
      }

      addToast(
        'success',
        'Producto Eliminado',
        `"${product.name}" ha sido eliminado permanentemente de tu tienda.`
      );
      setProductToDelete(null);
    } catch (err: any) {
      addToast('error', 'Error al Eliminar', err.message || 'Fallo de conexión al eliminar el producto.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Paginated, abort-safe product loader respecting server cache
  const fetchProductsPage = async (opts: { page?: number; search?: string; refresh?: boolean; silent?: boolean } = {}) => {
    const targetPage = opts.page ?? currentPage;
    const targetSearch = opts.search ?? searchQuery;
    const forceRefresh = Boolean(opts.refresh);
    const silent = Boolean(opts.silent);

    // Prevent overlapping manual sync bursts
    if (forceRefresh && isSyncInFlightRef.current) return;

    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeFetchAbortRef.current = controller;
    if (forceRefresh) isSyncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        per_page: String(perPage),
      });
      if (targetSearch.trim()) qs.set('search', targetSearch.trim());
      if (forceRefresh) qs.set('refresh', '1');

      const res = await fetch(`/api/woocommerce/products?${qs.toString()}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
        signal: controller.signal,
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setIsLoginOpen(true);
        return;
      }

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && Array.isArray(data.products)) {
        setProducts((prev) => {
          // Preserve locally modified pending products so edits aren't lost across page loads
          const pendingMap = new Map<number, Product>();
          for (const p of prev) {
            if (p.vendorId === currentVendorId && p.isModifiedLocally) {
              pendingMap.set(p.id, p);
            }
          }
          const mergedPage = data.products.map((srvProd: Product) =>
            pendingMap.has(srvProd.id) ? pendingMap.get(srvProd.id)! : srvProd
          );
          return mergedPage;
        });

        setCurrentPage(data.page || targetPage);
        setTotalServerProducts(typeof data.total === 'number' ? data.total : data.products.length);
        setTotalServerPages(typeof data.totalPages === 'number' && data.totalPages > 0 ? data.totalPages : 1);
        if (Array.isArray(data.categories)) {
          setServerCategories(data.categories);
        }
        if (Array.isArray(data.vendors) && data.vendors.length > 0) {
          setVendors((prevVendors) => {
            const map = new Map<number, DokanVendor>();
            for (const v of prevVendors) map.set(v.id, v);
            for (const v of data.vendors) map.set(v.id, v);
            const merged = Array.from(map.values());
            saveStoredVendors(merged);
            return merged;
          });
        }

        if (!silent) {
          addToast(
            'success',
            forceRefresh ? 'Catálogo Real Sincronizado' : 'Catálogo Cargado',
            `Mostrando ${data.products.length} de ${data.total ?? data.products.length} productos.`
          );
        }
      } else if (!silent) {
        addToast('error', 'Error al Sincronizar', data?.message || 'No se pudo obtener el catálogo de Merqba.');
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (!silent) {
        addToast('error', 'Error al Sincronizar', e.message || 'Fallo de conexión.');
      }
    } finally {
      if (activeFetchAbortRef.current === controller) {
        setLastSyncTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setIsSyncing(false);
        isSyncInFlightRef.current = false;
      }
    }
  };

  // Manual sync button handler (explicit refresh=1 protected by single-flight)
  const handleSync = async (silent = false) => {
    await fetchProductsPage({ page: currentPage, search: searchQuery, refresh: true, silent });
  };

  // Debounced server search ONLY when catalog spans >1 page (small catalogs <=50 items filter locally at 0 API cost)
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (totalServerPages > 1 || currentPage > 1) {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        fetchProductsPage({ page: 1, search: q, refresh: false, silent: true });
      }, 360);
    }
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalServerPages || nextPage === currentPage) return;
    setSelectedProductIds([]);
    fetchProductsPage({ page: nextPage, search: searchQuery, refresh: false, silent: true });
  };

  // Apply pending bulk/local changes (incremental ONLY - never resends unchanged catalog)
  const handleApplyChanges = async () => {
    if (isDispatchingWebhook) return;

    const modifiedProducts = vendorProducts.filter((p) => p.isModifiedLocally);
    if (modifiedProducts.length === 0) {
      addToast(
        'info',
        'Sin Cambios Pendientes',
        'Todos tus productos ya están actualizados y guardados en tu tienda.'
      );
      return;
    }

    setIsDispatchingWebhook(true);
    try {
      const batchRes = await fetch('/api/woocommerce/batch', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ products: modifiedProducts }),
      });
      const batchData = await batchRes.json().catch(() => ({}));

      if (batchRes.status === 401 || batchData?.authRequired) {
        addToast(
          'error',
          'Sesión Expirada',
          'Tu sesión caducó. Inicia sesión nuevamente para aplicar los cambios en la tienda.'
        );
        setIsLoginOpen(true);
        return;
      }

      const succeededSet = new Set<number>(
        Array.isArray(batchData.succeededIds) ? batchData.succeededIds.map(Number) : []
      );

      if (succeededSet.size > 0) {
        setProducts((prev) =>
          prev.map((p) => (p.vendorId === currentVendor.id && succeededSet.has(p.id) ? { ...p, isModifiedLocally: false } : p))
        );
        const syncedItems = modifiedProducts.filter((p) => succeededSet.has(p.id));
        const whResult = await dispatchProductsWebhook(currentVendor, syncedItems, config, 'manual_button', 'updated');
        if (whResult.log) {
          setWebhookLogs((prev) => [whResult.log!, ...prev].slice(0, 30));
        }
      }

      if (batchRes.ok && batchData.savedToWooCommerce) {
        addToast(
          'success',
          '¡Cambios Guardados con Éxito!',
          batchData.message || `${modifiedProducts.length} productos actualizados correctamente.`
        );
      } else {
        addToast(
          'error',
          batchData.partialSuccess ? 'Actualización Parcial' : 'Error al Actualizar en Tienda',
          batchData.message || 'No se pudieron guardar los cambios en la tienda. Inténtalo nuevamente.'
        );
      }
    } catch (err: any) {
      addToast('error', 'Error al Guardar', err.message || 'Fallo de red al aplicar cambios.');
    } finally {
      setIsDispatchingWebhook(false);
    }
  };

  // Handle vendor selection / login (respects valid server cache on page 1)
  const handleSelectVendor = async (vendor: DokanVendor) => {
    setIsAuthenticated(true);
    setActiveVendorId(vendor.id);
    setCurrentVendorId(vendor.id);
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedCategory('all');
    setCurrentPage(1);
    setIsLoginOpen(false);

    await fetchProductsPage({ page: 1, search: '', refresh: false, silent: false });
  };

  // Handle logout
  const handleLogout = () => {
    fetch('/api/woocommerce/logout', { method: 'POST', headers: getAuthHeaders(), credentials: 'include' }).catch(() => {});
    document.cookie = 'merqba_auth=; path=/; max-age=0';
    document.cookie = 'merqba_vendor_id=; path=/; max-age=0';
    sessionStorage.removeItem('merqba_session_token');
    sessionStorage.removeItem('merqba_auth_user');
    try {
      localStorage.removeItem('merqba_session_token');
      localStorage.removeItem('merchant_pulse_products_v1');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setProducts([]);
    setIsLoginOpen(true);
    addToast('info', 'Sesión Cerrada', 'Has cerrado sesión. Ingresa con una cuenta para ver y gestionar productos.');
  };

  // Handle adding custom vendor
  const handleAddCustomVendor = (newVendor: DokanVendor) => {
    const updated = [newVendor, ...vendors];
    setVendors(updated);
    saveStoredVendors(updated);
  };

  // Handle store config update
  const handleSaveConfig = (updated: StoreConfig) => {
    setConfig(updated);
    saveStoredConfig(updated);
    addToast('success', 'Configuración Guardada', 'Configuración de tu tienda actualizada.');
  };

  // Handle catalog reset to defaults
  const handleResetCatalog = () => {
    const reset = resetAllData();
    setProducts(reset.products);
    setVendors(reset.vendors);
    setConfig(reset.config);
    setActiveVendorId(reset.vendors[0].id);
    setWebhookLogs([]);
    addToast('info', 'Catálogo Restaurado', 'Se han restablecido los datos iniciales de prueba.');
  };

  // Open creation modal (without creating dummy products or premature notifications)
  const handleOpenCreateProduct = () => {
    setIsCreateProductOpen(true);
  };

  // Create new product on WooCommerce and add to catalog only after user submits
  const handleSaveNewProduct = async (newProductData: Partial<Product>): Promise<boolean> => {
    try {
      const res = await fetch('/api/woocommerce/products', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(newProductData),
      });

      const data = await res.json();

      if (res.ok && data.success && data.product) {
        const createdProduct: Product = {
          ...data.product,
          isModifiedLocally: false,
          isNew: false,
        };

        // Add the real created product to local state
        setProducts((prev) => [createdProduct, ...prev]);

        // Success notification displayed ONLY after product is created
        addToast(
          'success',
          'Producto Creado con Éxito',
          `"${createdProduct.name}" ha sido creado en tu tienda (ID #${createdProduct.id}).`
        );
        return true;
      } else {
        const errMsg = data.message || 'No se pudo crear el producto. Revisa los datos e intenta de nuevo.';
        addToast('error', 'Error al Crear Producto', errMsg);
        return false;
      }
    } catch (err: any) {
      console.error('Error creating product:', err);
      addToast(
        'error',
        'Error de Conexión',
        'No se pudo conectar con el servidor para crear el producto. Inténtalo nuevamente.'
      );
      return false;
    }
  };

  // Export current filtered product list to CSV for offline audits
  const handleDownloadCsv = () => {
    if (displayProducts.length === 0) {
      addToast('info', 'Sin Productos', 'No hay productos filtrados para exportar en este momento.');
      return;
    }
    const result = exportProductsToCsv(displayProducts, currentVendor, config);
    addToast(
      'success',
      'CSV Exportado para Auditoría',
      `Descargado "${result.filename}" con ${result.count} productos de ${currentVendor.storeName}.`
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col pb-24 sm:pb-12 text-[#0F172A]">
      {/* 1. Header with branding, Dokan info, Sync button & Top-Right Apply Changes button */}
      <Header
        currentVendor={currentVendor}
        config={config}
        pendingChangesCount={pendingChangesCount}
        isSyncing={isSyncing}
        isDispatchingWebhook={isDispatchingWebhook}
        onSync={handleSync}
        onApplyChanges={handleApplyChanges}
        onOpenVendorLogin={() => setIsLoginOpen(true)}
        onOpenStoreConfig={() => setIsConfigOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        lastSyncTime={lastSyncTime}
        isOnline={isOnline}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />

      {isAuthenticated ? (
        <>
          {/* 2. Dokan Vendor Identification & Store Metrics Bar */}
          <VendorBar
            vendor={currentVendor}
            products={vendorProducts}
          />

          {/* 3. Product Filter & Search Bar */}
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={vendorCategories}
            sortOption={sortOption}
            onSortChange={setSortOption}
            totalResults={totalServerProducts > 0 ? totalServerProducts : vendorProducts.length}
            totalFiltered={displayProducts.length}
            onResetFilters={() => {
              handleSearchChange('');
              setStatusFilter('all');
              setSelectedCategory('all');
            }}
          />

          {/* 4. Products List Canvas */}
          <main className="max-w-[2400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 w-full flex-1">
            {/* Selection & Results bar */}
            <div
              data-tour="bulk-create-bar"
              className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-3.5"
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Master Select All Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-[#0F172A] bg-white border border-[#CBD5E1] hover:border-[#FF5A00] px-3 py-1.5 rounded-lg transition-all shadow-2xs">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.length > 0 && selectedProductIds.length === displayProducts.length}
                    onChange={handleSelectAllFiltered}
                    className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-[#CBD5E1] cursor-pointer"
                  />
                  <span>
                    {selectedProductIds.length === 0
                      ? `Seleccionar todos (${displayProducts.length})`
                      : `${selectedProductIds.length} seleccionados de ${displayProducts.length}`}
                  </span>
                </label>

                {/* Bulk Actions when products are selected */}
                {selectedProductIds.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setIsBulkEditOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
                      title="Abrir panel completo de edición en masa"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Edición en Masa ({selectedProductIds.length})</span>
                    </button>

                    {/* Quick inline price setter */}
                    <form
                      onSubmit={handleQuickPriceApply}
                      className="flex items-center gap-1.5 bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-2.5 py-1 shadow-2xs"
                    >
                      <span className="text-[11px] font-bold text-[#C2410C] hidden sm:inline">Precio a todos:</span>
                      <span className="text-xs font-bold text-[#0F172A]">{config.currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={quickPriceInput}
                        onChange={(e) => setQuickPriceInput(e.target.value)}
                        className="w-16 sm:w-20 text-xs font-bold text-[#0F172A] px-1.5 py-0.5 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#FF5A00] tabular-nums"
                      />
                      <button
                        type="submit"
                        className="px-2 py-0.5 bg-[#FF5A00] hover:bg-[#E64C00] text-white text-[11px] font-bold rounded cursor-pointer shadow-xs"
                        title="Aplicar este precio inmediatamente a los productos seleccionados"
                      >
                        Fijar
                      </button>
                    </form>

                    <button
                      onClick={handleClearSelection}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#64748B] hover:text-[#0F172A] hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#CBD5E1]"
                      title="Deseleccionar productos"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Limpiar</span>
                    </button>
                  </div>
                )}

                <div className="text-xs text-[#64748B] hidden xl:inline">
                  Mostrando <strong className="text-[#0F172A]">{displayProducts.length}</strong> de{' '}
                  <strong className="text-[#0F172A]">{vendorProducts.length}</strong> productos de{' '}
                  <strong className="text-[#EA580C]">{currentVendor.storeName}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Download CSV button for offline audits */}
                <button
                  onClick={handleDownloadCsv}
                  disabled={displayProducts.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] active:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] hover:border-[#FF5A00] text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Descargar lista filtrada en archivo CSV para auditoría offline de inventario"
                >
                  <Download className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>Descargar CSV ({displayProducts.length})</span>
                </button>

                <button
                  onClick={handleOpenCreateProduct}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Añadir nuevo producto a tu tienda"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Producto</span>
                </button>
              </div>
            </div>

            {/* Product Cards Grid */}
            {displayProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 3xl:grid-cols-3 gap-3">
                  {displayProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      config={config}
                      isSelected={selectedProductIds.includes(product.id)}
                      isFirstTourTarget={index === 0}
                      onToggleSelect={handleToggleSelectProduct}
                      onSelectSamePrice={handleSelectSamePrice}
                      onUpdateProduct={handleUpdateProduct}
                      onOpenQuickEdit={(p) => setQuickEditProduct(p)}
                      onShareProduct={(p) => setSharingProduct(p)}
                      onDeleteProduct={(p) => setProductToDelete(p)}
                    />
                  ))}
                </div>

                {/* Paginación del catálogo en servidor */}
                {totalServerPages > 1 && (
                  <div className="mt-5 flex items-center justify-between bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 shadow-2xs">
                    <span className="text-xs text-[#64748B]">
                      Página <strong className="text-[#0F172A]">{currentPage}</strong> de{' '}
                      <strong className="text-[#0F172A]">{totalServerPages}</strong> ({totalServerProducts} productos)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || isSyncing}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#0F172A] bg-[#F8FAFC] hover:bg-[#FFF7ED] border border-[#CBD5E1] hover:border-[#FF5A00] rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Anterior</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalServerPages || isSyncing}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#0F172A] bg-[#F8FAFC] hover:bg-[#FFF7ED] border border-[#CBD5E1] hover:border-[#FF5A00] rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span>Siguiente</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center max-w-md mx-auto my-8 space-y-3">
                <div className="w-12 h-12 bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] rounded-full flex items-center justify-center mx-auto">
                  <PackageSearch className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-[#0F172A]">No se encontraron productos</h3>
                <p className="text-xs text-[#64748B]">
                  No hay productos que coincidan con los filtros seleccionados para {currentVendor.storeName}.
                </p>
                <button
                  onClick={() => {
                    handleSearchChange('');
                    setStatusFilter('all');
                    setSelectedCategory('all');
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF5A00] to-[#FF8C00] hover:from-[#E64C00] hover:to-[#E67E00] text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </main>

          {/* 5. Mobile Floating Action Bar */}
          <BottomMobileBar
            products={vendorProducts}
            config={config}
            pendingCount={pendingChangesCount}
            filteredCount={displayProducts.length}
            isDispatching={isDispatchingWebhook}
            onApplyChanges={handleApplyChanges}
            onSync={handleSync}
            onDownloadCsv={handleDownloadCsv}
          />
        </>
      ) : (
        /* Unauthenticated State: No products are loaded until account is logged in */
        <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1 flex flex-col items-center justify-center text-center">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-8 sm:p-10 shadow-xl space-y-5 w-full">
            <div className="w-16 h-16 bg-[#FFF7ED] text-[#EA580C] border-2 border-[#FED7AA] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <LogIn className="w-8 h-8 text-[#FF5A00]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#0F172A]">
                Inicia sesión en Merqba
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                Los productos no se cargarán hasta que ingreses con la cuenta de tu tienda o vendedor de Merqba.
              </p>
            </div>
            <button
              onClick={() => setIsLoginOpen(true)}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar Sesión para Cargar Productos</span>
            </button>
          </div>
        </main>
      )}

      {/* 6. Modals */}
      <CreateProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        vendor={currentVendor}
        categories={vendorCategories}
        config={config}
        onCreateProduct={handleSaveNewProduct}
      />

      <ProductQuickEditModal
        product={quickEditProduct}
        config={config}
        isOpen={!!quickEditProduct}
        onClose={() => setQuickEditProduct(null)}
        onSave={handleUpdateProduct}
        onDelete={(p) => setProductToDelete(p)}
      />

      <DeleteConfirmationModal
        product={productToDelete}
        config={config}
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirmDelete={handleConfirmDeleteProduct}
        isDeleting={isDeletingProduct}
      />

      <ShareProductModal
        product={sharingProduct}
        config={config}
        isOpen={!!sharingProduct}
        onClose={() => setSharingProduct(null)}
        onShowToast={addToast}
      />

      <LoginModal
        isOpen={isLoginOpen}
        isAuthenticated={isAuthenticated}
        onClose={() => {
          if (isAuthenticated) setIsLoginOpen(false);
        }}
        currentVendor={currentVendor}
        vendors={vendors}
        products={products}
        onSelectVendor={(v) => {
          setIsAuthenticated(true);
          handleSelectVendor(v);
        }}
        onAddCustomVendor={handleAddCustomVendor}
        onShowToast={addToast}
      />

      <StoreConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        currentVendor={currentVendor}
        isAuthenticated={isAuthenticated}
        onSaveConfig={handleSaveConfig}
        onResetCatalog={handleResetCatalog}
        onLogout={handleLogout}
        onOpenVendorLogin={() => setIsLoginOpen(true)}
        onShowToast={addToast}
      />

      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedProducts={selectedProducts}
        categories={vendorCategories}
        config={config}
        onApplyBulkChanges={handleApplyBulkChanges}
      />

      {/* Floating Bulk Action Bar when products are selected */}
      {isAuthenticated && selectedProductIds.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0B0E14] text-white border-2 border-[#FF5A00] shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 max-w-[95vw] ring-4 ring-[#FF5A00]/20 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
            <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
              {selectedProductIds.length} {selectedProductIds.length === 1 ? 'seleccionado' : 'seleccionados'}
            </span>
          </div>

          <div className="h-4 w-px bg-[#273142] hidden sm:block" />

          <button
            onClick={() => setIsBulkEditOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Layers className="w-4 h-4" />
            <span>Editar en Masa</span>
          </button>

          <button
            onClick={handleClearSelection}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Deseleccionar todos"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 7. Onboarding Quick Tour */}
      <GuidedTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        hasProducts={displayProducts.length > 0}
      />

      {/* 8. Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
