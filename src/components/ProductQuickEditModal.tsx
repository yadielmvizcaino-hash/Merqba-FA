import React, { useState, useRef } from 'react';
import { X, Upload, Camera, Check, Tag, DollarSign, Layers, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react';
import { Product, StoreConfig } from '../types';

interface ProductQuickEditModalProps {
  product: Product | null;
  config: StoreConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProduct: Product) => void;
  onDelete?: (product: Product) => void;
}

export const ProductQuickEditModal: React.FC<ProductQuickEditModalProps> = ({
  product,
  config,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !product) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const productSlug =
    product.slug ||
    product.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const productUrl =
    product.permalink && product.permalink.startsWith('http')
      ? product.permalink.replace(/\/+$/, '')
      : `${config.storeUrl.replace(/\/+$/, '')}/producto/${productSlug}`;

  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price.toString());
  const [regularPrice, setRegularPrice] = useState(product.regularPrice.toString());
  const [salePrice, setSalePrice] = useState(product.salePrice ? product.salePrice.toString() : '');
  const [stockQuantity, setStockQuantity] = useState(product.stockQuantity.toString());
  const [stockStatus, setStockStatus] = useState(product.stockStatus);
  const [imageUrl, setImageUrl] = useState(product.imageUrl);
  const [sku, setSku] = useState(product.sku);
  const [category, setCategory] = useState(product.category);

  // Gallery file handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStockStatusToggle = () => {
    if (stockStatus === 'instock') {
      setStockStatus('outofstock');
      setStockQuantity('0');
    } else {
      setStockStatus('instock');
      if (parseInt(stockQuantity, 10) <= 0) {
        setStockQuantity('10');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(price) || 0;
    const parsedRegular = parseFloat(regularPrice) || parsedPrice;
    const parsedSale = salePrice ? parseFloat(salePrice) : undefined;
    const parsedQty = parseInt(stockQuantity, 10) || 0;

    onSave({
      ...product,
      name: name.trim() || product.name,
      price: parsedPrice,
      regularPrice: parsedRegular,
      salePrice: parsedSale,
      stockQuantity: parsedQty,
      stockStatus: parsedQty === 0 ? 'outofstock' : stockStatus,
      imageUrl,
      sku: sku.trim() || product.sku,
      category: category.trim() || product.category,
      isModifiedLocally: true,
      lastModified: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#FFA000]">
                Edición Rápida • ID: #{product.id}
              </span>
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 hover:text-[#FFA000] inline-flex items-center gap-1 hover:underline transition-colors"
                title="Ver producto en la tienda oficial Merqba"
              >
                <span>Ver en tienda</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <h2 className="text-base font-bold truncate text-white">{product.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Image Upload section */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Imagen del Producto (Galería del dispositivo)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#CBD5E1] bg-[#F1F5F9] shrink-0">
                <img src={imageUrl} alt="Vista previa" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 border border-[#CBD5E1] hover:border-[#FF5A00] bg-[#F8FAFC] hover:bg-white text-xs font-semibold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4 text-[#FF5A00]" />
                  <span>Subir imagen desde galería</span>
                </button>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Formatos aceptados: JPG, PNG, WEBP.
                </p>
              </div>
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Nombre del Producto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/15"
            />
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Precio de Venta ({config.currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B]">
                  {config.currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Precio Regular ({config.currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B]">
                  {config.currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Stock Quantity & Switch */}
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F172A]">Estado de Inventario</span>
                <p className="text-[11px] text-[#64748B]">Interruptor para sacar o meter al catálogo</p>
              </div>

              {/* Interruptor toggle switch */}
              <button
                type="button"
                onClick={handleStockStatusToggle}
                className={`relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  stockStatus === 'instock' ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    stockStatus === 'instock' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#FED7AA]">
              <label className="text-xs font-bold text-[#0F172A]">
                Cantidad en Stock
              </label>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => {
                  const val = e.target.value;
                  setStockQuantity(val);
                  if (parseInt(val, 10) > 0) {
                    setStockStatus('instock');
                  } else {
                    setStockStatus('outofstock');
                  }
                }}
                className="w-24 text-center px-2 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] tabular-nums"
              />
            </div>
          </div>

          {/* SKU & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                SKU / Código
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#FF5A00]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Categoría
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(product);
                  onClose();
                }}
                className="px-3 py-2 text-[#DC2626] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#CBD5E1] text-[#475569] text-xs font-semibold rounded-lg hover:bg-[#F8FAFC] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
