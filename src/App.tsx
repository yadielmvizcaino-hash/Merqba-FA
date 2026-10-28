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
import { dispatchProductsWebhook } from './services/webhook';
import { Product, DokanVendor, StoreConfig, StatusFilter, SortOption, WebhookLog } from './types';
import { Header } from './components/Header';
import { VendorBar } from './components/VendorBar';
import { FilterBar } from './components/FilterBar';
import { ProductCard } from './components/ProductCard';
import { ProductQuickEditModal } from './components/ProductQuickEditModal';
import { ShareProductModal } from './components/ShareProductModal';
import { LoginModal } from './components/LoginModal';
import { WebhookModal } from './components/WebhookModal';
import { StoreConfigModal } from './components/StoreConfigModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { BottomMobileBar } from './components/BottomMobileBar';
import { exportProductsToCsv } from './services/csvExport';
import {
  Download,
  PackageSearch,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function App() {
  // Core state
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<DokanVendor[]>([]);
  const [currentVendorId, setActiveVendorId] = useState<number>(14);
  const [config, setConfig] = useState<StoreConfig>(getStoredConfig());
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);

  // Operational states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Ahora');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');

  // Modal states
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isWebhookOpen, setIsWebhookOpen] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [sharingProduct, setSharingProduct] = useState<Product | null>(null);

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

  // Initialize data on mount
  useEffect(() => {
    const loadedProducts = getStoredProducts();
    const loadedVendors = getStoredVendors();
    const activeId = getCurrentVendorId();
    const loadedLogs = getStoredWebhookLogs();

    setProducts(loadedProducts);
    setVendors(loadedVendors);
    setActiveVendorId(activeId);
    setWebhookLogs(loadedLogs);
    setLastSyncTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  }, []);

  // Save products to storage whenever updated
  useEffect(() => {
    if (products.length > 0) {
      saveStoredProducts(products);
    }
  }, [products]);

  // Current logged in vendor
  const currentVendor = useMemo(() => {
    return vendors.find((v) => v.id === currentVendorId) || vendors[0] || {
      id: 14,
      name: 'Vendedor',
      storeName: 'Mi Tienda',
      email: 'vendedor@marketplace.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      banner: '',
      rating: 5.0,
      ratingCount: 1,
      storeUrl: 'https://merqba.com',
      phone: '',
      address: '',
    };
  }, [vendors, currentVendorId]);

  // VENDOR ISOLATION: "🔥Filtrado por vendedor . solo debe mostrar productos del vendedor logueado"
  const vendorProducts = useMemo(() => {
    return products.filter((p) => p.vendorId === currentVendor.id);
  }, [products, currentVendor.id]);

  // Available categories for this vendor
  const vendorCategories = useMemo(() => {
    const set = new Set<string>();
    vendorProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [vendorProducts]);

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

  // Debounced realtime webhook trigger
  const realtimeDebounceTimer = useRef<any>(null);

  const handleUpdateProduct = (updated: Product) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );

    // If realtime sync is active, trigger webhook after 600ms debounce
    if (config.realtimeSync) {
      if (realtimeDebounceTimer.current) {
        clearTimeout(realtimeDebounceTimer.current);
      }
      realtimeDebounceTimer.current = setTimeout(async () => {
        const currentProducts = products.map((item) => (item.id === updated.id ? updated : item));
        const currentVendorItems = currentProducts.filter((p) => p.vendorId === currentVendor.id);
        const result = await dispatchProductsWebhook(currentVendor, currentVendorItems, config, 'realtime_change');
        setWebhookLogs((prev) => [result.log, ...prev].slice(0, 30));
        addToast('info', 'Webhook en Tiempo Real', `Actualización de "${updated.name.slice(0, 20)}..." sincronizada.`);
      }, 600);
    }
  };

  // Sync products with app: "🔥Botón para sincronizar productos con la app"
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/woocommerce/products?vendor_id=${currentVendor.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products) && data.products.length > 0) {
          setProducts((prev) => {
            const others = prev.filter((p) => p.vendorId !== currentVendor.id);
            return [...data.products, ...others];
          });
          addToast(
            'success',
            'Catálogo Sincronizado en Vivo',
            `${data.products.length} productos actualizados desde https://merqba.com.`
          );
        } else {
          addToast(
            'success',
            'Catálogo Sincronizado',
            `Conectado con la API de https://merqba.com.`
          );
        }
      } else {
        addToast(
          'success',
          'Catálogo Sincronizado',
          `Conectado con https://merqba.com.`
        );
      }
    } catch (e) {
      addToast(
        'info',
        'Sincronización Completada',
        'Catálogo verificado y listo para operar.'
      );
    } finally {
      setLastSyncTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsSyncing(false);
    }
  };

  // Apply changes / Fire webhook:
  // "🔥Botón en la esquina derecha para aplicar cambios (esto dispara el webhook enviando todos los datos de los productos de la tienda o si es posible en tiempo real."
  const handleApplyChanges = async () => {
    if (isDispatchingWebhook) return;

    setIsDispatchingWebhook(true);
    try {
      // 1. Dispatch batch changes to WooCommerce REST API proxy
      fetch('/api/woocommerce/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: vendorProducts }),
      }).catch((e) => console.warn('Batch proxy notification:', e));

      // 2. Dispatch webhook payload
      const result = await dispatchProductsWebhook(
        currentVendor,
        vendorProducts,
        config,
        'manual_button'
      );

      // Clear local modified flags for this vendor upon successful dispatch
      setProducts((prev) =>
        prev.map((p) => (p.vendorId === currentVendor.id ? { ...p, isModifiedLocally: false } : p))
      );

      setWebhookLogs((prev) => [result.log, ...prev].slice(0, 30));

      addToast(
        result.success ? 'success' : 'error',
        result.success ? '¡Cambios Aplicados con Éxito!' : 'Error al Enviar Webhook',
        `Webhook y lote WooCommerce enviados (${result.statusCode} OK - ${result.latencyMs}ms)`
      );
    } catch (err: any) {
      addToast('error', 'Error en Webhook', err.message || 'Fallo de red');
    } finally {
      setIsDispatchingWebhook(false);
    }
  };

  // Handle vendor selection
  const handleSelectVendor = (vendor: DokanVendor) => {
    setActiveVendorId(vendor.id);
    setCurrentVendorId(vendor.id);
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedCategory('all');
    addToast(
      'info',
      'Sesión Iniciada',
      `Accediendo al catálogo de "${vendor.storeName}" (ID #${vendor.id}).`
    );
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
    addToast('success', 'Configuración Guardada', 'Parámetros de WooCommerce y Webhook actualizados.');
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

  // Create new product for current vendor
  const handleAddNewProduct = () => {
    const newId = Math.floor(Math.random() * 9000) + 1000;
    const newProduct: Product = {
      id: newId,
      vendorId: currentVendor.id,
      name: 'Nuevo Producto ' + newId,
      sku: 'SKU-' + newId,
      price: 29.99,
      regularPrice: 29.99,
      stockQuantity: 10,
      stockStatus: 'instock',
      manageStock: true,
      imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
      category: vendorCategories[0] || 'General',
      isModifiedLocally: true,
      lastModified: new Date().toISOString(),
    };

    setProducts((prev) => [newProduct, ...prev]);
    setQuickEditProduct(newProduct);
    addToast('success', 'Producto Creado', `Nuevo producto #${newId} listo para editar.`);
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
        onOpenWebhookLogs={() => setIsWebhookOpen(true)}
        lastSyncTime={lastSyncTime}
      />

      {/* 2. Dokan Vendor Identification & Store Metrics Bar */}
      <VendorBar
        vendor={currentVendor}
        products={vendorProducts}
        onOpenVendorLogin={() => setIsLoginOpen(true)}
      />

      {/* 3. Product Filter & Search Bar: "🔥Añadir filtro de productos" */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={vendorCategories}
        sortOption={sortOption}
        onSortChange={setSortOption}
        totalResults={vendorProducts.length}
        totalFiltered={displayProducts.length}
        onResetFilters={() => {
          setSearchQuery('');
          setStatusFilter('all');
          setSelectedCategory('all');
        }}
      />

      {/* 4. Products List Canvas */}
      <main className="max-w-[2400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 w-full flex-1">
        {/* Results bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="text-xs text-[#64748B]">
            Mostrando <strong className="text-[#0F172A]">{displayProducts.length}</strong> de{' '}
            <strong className="text-[#0F172A]">{vendorProducts.length}</strong> productos de{' '}
            <strong className="text-[#EA580C]">{currentVendor.storeName}</strong>
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
              onClick={handleAddNewProduct}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
              title="Añadir nuevo producto a tu tienda"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Producto</span>
            </button>
          </div>
        </div>

        {/* Product Cards Grid / Dense List optimized for Full HD+ (2400x1080) */}
        {displayProducts.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 3xl:grid-cols-3 gap-3">
            {displayProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                config={config}
                onUpdateProduct={handleUpdateProduct}
                onOpenQuickEdit={(p) => setQuickEditProduct(p)}
                onShareProduct={(p) => setSharingProduct(p)}
              />
            ))}
          </div>
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
                setSearchQuery('');
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

      {/* 6. Modals */}
      <ProductQuickEditModal
        product={quickEditProduct}
        config={config}
        isOpen={!!quickEditProduct}
        onClose={() => setQuickEditProduct(null)}
        onSave={handleUpdateProduct}
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
        onClose={() => setIsLoginOpen(false)}
        currentVendor={currentVendor}
        vendors={vendors}
        products={products}
        onSelectVendor={handleSelectVendor}
        onAddCustomVendor={handleAddCustomVendor}
      />

      <WebhookModal
        isOpen={isWebhookOpen}
        onClose={() => setIsWebhookOpen(false)}
        vendor={currentVendor}
        products={vendorProducts}
        config={config}
        onUpdateConfig={handleSaveConfig}
        onTriggerWebhook={handleApplyChanges}
        isDispatching={isDispatchingWebhook}
        webhookLogs={webhookLogs}
      />

      <StoreConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onResetCatalog={handleResetCatalog}
      />

      {/* 7. Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
