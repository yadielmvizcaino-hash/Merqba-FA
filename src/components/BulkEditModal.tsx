import React, { useState } from 'react';
import { X, Layers, Check, DollarSign, Package, Tag, AlertCircle } from 'lucide-react';
import { Product, StoreConfig } from '../types';

export interface BulkEditChanges {
  updatePrice: boolean;
  priceValue?: number;
  priceMode: 'fixed' | 'percent_increase' | 'percent_decrease';
  updateSalePrice: boolean;
  salePriceValue?: number | null; // null to remove sale price
  updateStock: boolean;
  stockQuantity?: number;
  updateStatus: boolean;
  stockStatus?: 'instock' | 'outofstock';
  updateCategory: boolean;
  category?: string;
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  categories: string[];
  config: StoreConfig;
  onApplyBulkChanges: (changes: BulkEditChanges) => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  categories,
  config,
  onApplyBulkChanges,
}) => {
  if (!isOpen || selectedProducts.length === 0) return null;

  // Form states
  const [updatePrice, setUpdatePrice] = useState(true);
  const [priceMode, setPriceMode] = useState<'fixed' | 'percent_increase' | 'percent_decrease'>('fixed');
  const [priceValue, setPriceValue] = useState<string>(
    selectedProducts[0]?.price ? selectedProducts[0].price.toString() : '10'
  );

  const [updateSalePrice, setUpdateSalePrice] = useState(false);
  const [salePriceAction, setSalePriceAction] = useState<'set' | 'remove'>('set');
  const [salePriceValue, setSalePriceValue] = useState<string>('');

  const [updateStock, setUpdateStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState<string>('10');

  const [updateStatus, setUpdateStatus] = useState(false);
  const [stockStatus, setStockStatus] = useState<'instock' | 'outofstock'>('instock');

  const [updateCategory, setUpdateCategory] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string>(selectedProducts[0]?.category || 'General');
  const [newCatInput, setNewCatInput] = useState<string>('');
  const [isCreatingNewCat, setIsCreatingNewCat] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const changes: BulkEditChanges = {
      updatePrice,
      priceMode,
      priceValue: updatePrice ? parseFloat(priceValue) || 0 : undefined,
      updateSalePrice,
      salePriceValue: updateSalePrice
        ? salePriceAction === 'remove'
          ? null
          : parseFloat(salePriceValue) || undefined
        : undefined,
      updateStock,
      stockQuantity: updateStock ? parseInt(stockQuantity, 10) || 0 : undefined,
      updateStatus,
      stockStatus: updateStatus ? stockStatus : undefined,
      updateCategory,
      category: updateCategory ? (isCreatingNewCat && newCatInput.trim() ? newCatInput.trim() : selectedCat) : undefined,
    };

    onApplyBulkChanges(changes);
    onClose();
  };

  // Calculate unique prices currently among selected items
  const uniquePrices = Array.from(new Set(selectedProducts.map((p) => p.price)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-[#FF5A00] to-[#FFA000] rounded-xl text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Edición en Masa de Productos</span>
                <span className="bg-[#FF5A00] text-white text-xs px-2 py-0.5 rounded-full font-black">
                  {selectedProducts.length} seleccionados
                </span>
              </h2>
              <p className="text-[11px] text-[#FFA000]">
                Actualiza precio, stock y categoría en lote para múltiples productos a la vez
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Selected items quick preview pills */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-[#64748B] mb-2 font-semibold">
              <span>Productos que serán modificados ({selectedProducts.length}):</span>
              {uniquePrices.length > 0 && (
                <span className="text-[#0F172A]">
                  Precios actuales: {uniquePrices.map((p) => `${config.currencySymbol}${p.toFixed(2)}`).join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {selectedProducts.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#CBD5E1] rounded-lg shrink-0 text-[11px] max-w-[200px]"
                >
                  <img src={p.imageUrl} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                  <span className="truncate text-[#0F172A] font-medium">{p.name}</span>
                  <span className="text-[#EA580C] font-bold shrink-0">{config.currencySymbol}{p.price}</span>
                </div>
              ))}
              {selectedProducts.length > 8 && (
                <div className="px-2 py-1 bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] rounded-lg shrink-0 text-[11px] font-bold">
                  +{selectedProducts.length - 8} más
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Price update (The main request of the user) */}
          <div className={`p-4 rounded-xl border transition-all ${updatePrice ? 'bg-[#FFFBF7] border-[#FF5A00]/50 ring-1 ring-[#FF5A00]/20' : 'bg-white border-[#E2E8F0]'}`}>
            <label className="flex items-center gap-2 font-bold text-[#0F172A] cursor-pointer select-none mb-3">
              <input
                type="checkbox"
                checked={updatePrice}
                onChange={(e) => setUpdatePrice(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-[#CBD5E1] cursor-pointer"
              />
              <DollarSign className="w-4 h-4 text-[#FF5A00]" />
              <span className="text-sm text-[#0F172A]">Actualizar Precio Regular</span>
            </label>

            {updatePrice && (
              <div className="space-y-3 pl-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#64748B] font-medium">Modo de cambio:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPriceMode('fixed')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border ${
                        priceMode === 'fixed'
                          ? 'bg-[#FF5A00] text-white border-[#FF5A00]'
                          : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      Mismo precio fijo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceMode('percent_increase')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border ${
                        priceMode === 'percent_increase'
                          ? 'bg-[#FF5A00] text-white border-[#FF5A00]'
                          : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      Aumentar %
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceMode('percent_decrease')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border ${
                        priceMode === 'percent_decrease'
                          ? 'bg-[#FF5A00] text-white border-[#FF5A00]'
                          : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      Rebajar %
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">
                      {priceMode === 'fixed' ? config.currencySymbol : '%'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      placeholder={priceMode === 'fixed' ? '0.00' : '10'}
                      required={updatePrice}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/25 tabular-nums"
                    />
                  </div>

                  <span className="text-xs text-[#64748B]">
                    {priceMode === 'fixed'
                      ? `Todos los ${selectedProducts.length} productos seleccionados tendrán un precio de ${config.currencySymbol}${priceValue || 0}`
                      : priceMode === 'percent_increase'
                      ? `Aumentará un ${priceValue || 0}% sobre el precio individual de cada producto`
                      : `Disminuirá un ${priceValue || 0}% sobre el precio individual de cada producto`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Sale price (optional) */}
          <div className={`p-4 rounded-xl border transition-all ${updateSalePrice ? 'bg-[#FFFBF7] border-[#FF5A00]/50 ring-1 ring-[#FF5A00]/20' : 'bg-white border-[#E2E8F0]'}`}>
            <label className="flex items-center gap-2 font-bold text-[#0F172A] cursor-pointer select-none mb-3">
              <input
                type="checkbox"
                checked={updateSalePrice}
                onChange={(e) => setUpdateSalePrice(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-[#CBD5E1] cursor-pointer"
              />
              <Tag className="w-4 h-4 text-[#EA580C]" />
              <span className="text-sm text-[#0F172A]">Modificar Precio de Oferta / Rebaja</span>
            </label>

            {updateSalePrice && (
              <div className="space-y-3 pl-6">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-[#475569]">
                    <input
                      type="radio"
                      name="saleAction"
                      checked={salePriceAction === 'set'}
                      onChange={() => setSalePriceAction('set')}
                      className="text-[#FF5A00] focus:ring-[#FF5A00]"
                    />
                    <span>Establecer precio de oferta:</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-[#475569] ml-4">
                    <input
                      type="radio"
                      name="saleAction"
                      checked={salePriceAction === 'remove'}
                      onChange={() => setSalePriceAction('remove')}
                      className="text-[#FF5A00] focus:ring-[#FF5A00]"
                    />
                    <span>Quitar oferta (restablecer a precio normal)</span>
                  </label>
                </div>

                {salePriceAction === 'set' && (
                  <div className="relative max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">
                      {config.currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={salePriceValue}
                      onChange={(e) => setSalePriceValue(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] tabular-nums"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Stock Quantity & Status */}
          <div className={`p-4 rounded-xl border transition-all ${updateStock || updateStatus ? 'bg-[#FFFBF7] border-[#FF5A00]/50 ring-1 ring-[#FF5A00]/20' : 'bg-white border-[#E2E8F0]'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <label className="flex items-center gap-2 font-bold text-[#0F172A] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={updateStock}
                  onChange={(e) => setUpdateStock(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-[#CBD5E1] cursor-pointer"
                />
                <Package className="w-4 h-4 text-[#10B981]" />
                <span className="text-sm text-[#0F172A]">Modificar Cantidad de Stock</span>
              </label>

              <label className="flex items-center gap-2 font-bold text-[#0F172A] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-[#CBD5E1] cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-[#475569]">Cambiar Estado (Disponible / Agotado)</span>
              </label>
            </div>

            <div className="space-y-3 pl-6">
              {updateStock && (
                <div className="flex items-center gap-3">
                  <div className="w-28">
                    <input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] tabular-nums"
                    />
                  </div>
                  <span className="text-xs text-[#64748B]">
                    unidades de stock asignadas a cada uno de los {selectedProducts.length} productos
                  </span>
                </div>
              )}

              {updateStatus && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStockStatus('instock')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                      stockStatus === 'instock'
                        ? 'bg-[#10B981] text-white border-[#10B981] shadow-xs'
                        : 'bg-white text-[#065F46] border-[#A7F3D0]'
                    }`}
                  >
                    Marcar como En Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockStatus('outofstock')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                      stockStatus === 'outofstock'
                        ? 'bg-[#EF4444] text-white border-[#EF4444] shadow-xs'
                        : 'bg-white text-[#991B1B] border-[#FECACA]'
                    }`}
                  >
                    Marcar como Agotado
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Category assignment */}
          <div className={`p-4 rounded-xl border transition-all ${updateCategory ? 'bg-[#FFFBF7] border-[#FF5A00]/50 ring-1 ring-[#FF5A00]/20' : 'bg-white border-[#E2E8F0]'}`}>
            <label className="flex items-center gap-2 font-bold text-[#0F172A] cursor-pointer select-none mb-3">
              <input
                type="checkbox"
                checked={updateCategory}
                onChange={(e) => setUpdateCategory(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-[#CBD5E1] cursor-pointer"
              />
              <Tag className="w-4 h-4 text-[#6366F1]" />
              <span className="text-sm text-[#0F172A]">Asignar Categoría a Todos</span>
            </label>

            {updateCategory && (
              <div className="space-y-3 pl-6">
                {!isCreatingNewCat ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCat}
                      onChange={(e) => setSelectedCat(e.target.value)}
                      className="px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] font-semibold focus:outline-none focus:border-[#FF5A00] flex-1 max-w-[260px]"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsCreatingNewCat(true)}
                      className="px-2.5 py-2 text-xs font-bold text-[#FF5A00] hover:bg-[#FFF7ED] rounded-lg transition-colors cursor-pointer border border-[#FED7AA]"
                    >
                      + Nueva categoría
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Nombre de la nueva categoría..."
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      className="px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00] flex-1 max-w-[260px]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewCat(false)}
                      className="px-2.5 py-2 text-xs text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer border border-[#CBD5E1]"
                    >
                      Usar existente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!updatePrice && !updateSalePrice && !updateStock && !updateStatus && !updateCategory && (
            <div className="flex items-center gap-2 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Por favor marca al menos una casilla (Precio, Stock o Categoría) para aplicar cambios.</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
            <span className="text-xs text-[#64748B]">
              Los cambios se guardan localmente y se pueden sincronizar con &apos;Aplicar Cambios&apos;.
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#CBD5E1] text-[#475569] text-xs font-semibold rounded-lg hover:bg-[#F8FAFC] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!updatePrice && !updateSalePrice && !updateStock && !updateStatus && !updateCategory}
                className="px-5 py-2 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar a los {selectedProducts.length} productos</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
