import React, { useState, useRef } from 'react';
import {
  Camera,
  Check,
  Edit2,
  Minus,
  Plus,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { Product, StoreConfig } from '../types';

interface ProductCardProps {
  product: Product;
  config: StoreConfig;
  onUpdateProduct: (updated: Product) => void;
  onOpenQuickEdit: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  config,
  onUpdateProduct,
  onOpenQuickEdit,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(product.name);

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState(product.price.toString());

  const [isEditingStock, setIsEditingStock] = useState(false);
  const [tempStock, setTempStock] = useState(product.stockQuantity.toString());

  const isOutOfStock = product.stockStatus === 'outofstock' || product.stockQuantity === 0;

  // Save title edit
  const handleSaveTitle = () => {
    if (tempTitle.trim() && tempTitle !== product.name) {
      onUpdateProduct({
        ...product,
        name: tempTitle.trim(),
        isModifiedLocally: true,
        lastModified: new Date().toISOString(),
      });
    } else {
      setTempTitle(product.name);
    }
    setIsEditingTitle(false);
  };

  // Save price edit
  const handleSavePrice = () => {
    const parsed = parseFloat(tempPrice);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== product.price) {
      onUpdateProduct({
        ...product,
        price: parsed,
        regularPrice: parsed,
        isModifiedLocally: true,
        lastModified: new Date().toISOString(),
      });
    } else {
      setTempPrice(product.price.toString());
    }
    setIsEditingPrice(false);
  };

  // Save stock edit from direct input
  const handleSaveStock = () => {
    const parsed = parseInt(tempStock, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      const newStatus = parsed === 0 ? 'outofstock' : 'instock';
      onUpdateProduct({
        ...product,
        stockQuantity: parsed,
        stockStatus: newStatus,
        isModifiedLocally: true,
        lastModified: new Date().toISOString(),
      });
    } else {
      setTempStock(product.stockQuantity.toString());
    }
    setIsEditingStock(false);
  };

  // Stepper increment/decrement
  const handleStockDelta = (delta: number) => {
    const nextQty = Math.max(0, product.stockQuantity + delta);
    const nextStatus = nextQty === 0 ? 'outofstock' : 'instock';
    setTempStock(nextQty.toString());
    onUpdateProduct({
      ...product,
      stockQuantity: nextQty,
      stockStatus: nextStatus,
      isModifiedLocally: true,
      lastModified: new Date().toISOString(),
    });
  };

  // Interruptor de stock (Toggle Switch 44x26px)
  const handleToggleStockStatus = () => {
    if (product.stockStatus === 'instock' && product.stockQuantity > 0) {
      onUpdateProduct({
        ...product,
        stockStatus: 'outofstock',
        stockQuantity: 0,
        isModifiedLocally: true,
        lastModified: new Date().toISOString(),
      });
      setTempStock('0');
    } else {
      const restoredQty = product.stockQuantity > 0 ? product.stockQuantity : 10;
      onUpdateProduct({
        ...product,
        stockStatus: 'instock',
        stockQuantity: restoredQty,
        isModifiedLocally: true,
        lastModified: new Date().toISOString(),
      });
      setTempStock(restoredQty.toString());
    }
  };

  // Casilla de stock (Checkbox)
  const handleCheckboxStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      const restored = product.stockQuantity > 0 ? product.stockQuantity : 10;
      onUpdateProduct({
        ...product,
        stockStatus: 'instock',
        stockQuantity: restored,
        isModifiedLocally: true,
        lastModified: new Date().toISOString(),
      });
      setTempStock(restored.toString());
    } else {
      onUpdateProduct({
        ...product,
        stockStatus: 'outofstock',
        stockQuantity: 0,
        isModifiedLocally: true,
        lastModified: new Date().toISOString(),
      });
      setTempStock('0');
    }
  };

  // Image upload from device gallery
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateProduct({
            ...product,
            imageUrl: event.target.result as string,
            isModifiedLocally: true,
            lastModified: new Date().toISOString(),
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <article
      className={`group relative bg-white rounded-xl border transition-all shadow-xs ${
        isOutOfStock
          ? 'border-[#FECACA] bg-[#FFFBFB]'
          : product.isModifiedLocally
          ? 'border-[#D7BAFF] ring-1 ring-[#5B3294]/30'
          : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
      } p-3 sm:p-4`}
    >
      {/* Hidden file input for device gallery upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Subir imagen para ${product.name}`}
      />

      {/* Modified pill indicator */}
      {product.isModifiedLocally && (
        <div className="absolute -top-2.5 right-3 bg-[#43167C] text-[#EDDCFF] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-ping"></span>
          Cambio local pendiente
        </div>
      )}

      {/* Main card row: optimized for Full HD+ (2400x1080) and dense mobile */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
        {/* Left Cluster: Photo thumbnail + (Directly to the right: Title, ID/SKU badges, Price) */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Photo Thumbnail */}
          <div className="relative shrink-0 group/img">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9] shadow-2xs">
              <img
                src={product.imageUrl}
                alt={product.name}
                className={`w-full h-full object-cover transition-transform group-hover/img:scale-105 ${
                  isOutOfStock ? 'grayscale opacity-75' : ''
                }`}
              />

              {/* In-Stock / Out-of-Stock micro-badge */}
              <span
                className={`absolute top-1 left-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-xs ${
                  isOutOfStock ? 'bg-[#EF4444] text-white' : 'bg-[#10B981] text-white'
                }`}
              >
                {isOutOfStock ? 'Agotado' : 'En Stock'}
              </span>

              {/* Gallery Upload Overlay button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer p-1 text-center"
                title="Subir foto desde la galería del dispositivo"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-semibold leading-tight">Cambiar foto</span>
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 w-full text-[10px] text-[#5B3294] font-semibold flex items-center justify-center gap-1 hover:underline cursor-pointer sm:hidden"
            >
              <Upload className="w-3 h-3" />
              <span>Galería</span>
            </button>
          </div>

          {/* AREA DIRECTLY TO THE RIGHT OF THE PHOTO: Product Name, Metadata & Price */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Product Name moved directly here */}
            <div>
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                    autoFocus
                    className="w-full text-xs sm:text-sm font-bold text-[#0F172A] bg-[#FAF8FF] border border-[#5B3294] rounded px-2 py-1 focus:outline-none ring-2 ring-[#5B3294]/20"
                  />
                  <button
                    onClick={handleSaveTitle}
                    className="p-1.5 bg-[#5B3294] text-white rounded hover:bg-[#43167C] cursor-pointer"
                    title="Guardar nombre"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-1 group/title">
                  <h3
                    onClick={() => {
                      setTempTitle(product.name);
                      setIsEditingTitle(true);
                    }}
                    className="text-xs sm:text-sm md:text-base font-bold text-[#0F172A] hover:text-[#5B3294] cursor-pointer line-clamp-2 leading-snug tracking-tight"
                    title="Clic para editar nombre del producto"
                  >
                    {product.name}
                  </h3>
                  <button
                    onClick={() => {
                      setTempTitle(product.name);
                      setIsEditingTitle(true);
                    }}
                    className="opacity-40 group-hover/title:opacity-100 p-1 text-[#475569] hover:text-[#5B3294] cursor-pointer shrink-0"
                    title="Editar nombre"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Metadata chips: ID, SKU, Category */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="font-bold bg-[#F1F5F9] text-[#0F172A] px-1.5 py-0.5 rounded border border-[#E2E8F0] tabular-nums">
                ID: #{product.id}
              </span>
              <span className="text-[#64748B] font-mono text-[10px] sm:text-[11px]">
                SKU: {product.sku}
              </span>
              <span className="text-[#5B3294] font-medium bg-[#F5F3FF] px-1.5 py-0.5 rounded text-[10px] sm:text-[11px]">
                {product.category}
              </span>
            </div>

            {/* Price & Details Link */}
            <div className="flex items-center gap-3 flex-wrap pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#64748B]">Precio:</span>
                {isEditingPrice ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-[#0F172A]">{config.currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSavePrice()}
                      autoFocus
                      className="w-20 text-xs sm:text-sm font-bold text-[#0F172A] bg-[#FAF8FF] border border-[#5B3294] rounded px-1.5 py-0.5 focus:outline-none ring-1 ring-[#5B3294]/20 tabular-nums"
                    />
                    <button
                      onClick={handleSavePrice}
                      className="p-1 bg-[#10B981] text-white rounded hover:bg-[#006C49] cursor-pointer"
                      title="Confirmar precio"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setTempPrice(product.price.toString());
                      setIsEditingPrice(true);
                    }}
                    className="flex items-center gap-1 text-sm sm:text-base font-extrabold text-[#0F172A] hover:text-[#5B3294] px-1.5 py-0.5 rounded hover:bg-[#F1F5F9] cursor-pointer tabular-nums"
                    title="Clic para editar precio"
                  >
                    <span>{config.currencySymbol}{product.price.toFixed(2)}</span>
                    <Edit2 className="w-3 h-3 text-[#94A3B8]" />
                  </button>
                )}
              </div>

              {product.salePrice && (
                <span className="text-xs text-[#94A3B8] line-through tabular-nums">
                  {config.currencySymbol}{product.regularPrice.toFixed(2)}
                </span>
              )}

              <button
                onClick={() => onOpenQuickEdit(product)}
                className="text-xs text-[#5B3294] hover:text-[#43167C] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer ml-auto sm:ml-2"
              >
                <span>Detalles</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Cluster: Quantity Stepper, Interruptor de Stock & Casilla de Stock */}
        <div className="flex sm:flex-row lg:flex-row items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#F1F5F9] shrink-0">
          {/* Stock Stepper `[-]` `[input]` `[+]` */}
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-0.5">
              Cantidad en Stock
            </span>

            <div className="flex items-center border border-[#CBD5E1] rounded-lg bg-[#F8FAFC] overflow-hidden shadow-2xs h-9">
              <button
                onClick={() => handleStockDelta(-1)}
                disabled={product.stockQuantity <= 0}
                className="w-9 h-9 flex items-center justify-center text-[#475569] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] transition-colors disabled:opacity-30 cursor-pointer"
                title="Reducir stock (-1)"
                aria-label="Restar una unidad"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {isEditingStock ? (
                <input
                  type="number"
                  min="0"
                  value={tempStock}
                  onChange={(e) => setTempStock(e.target.value)}
                  onBlur={handleSaveStock}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveStock()}
                  autoFocus
                  className="w-12 text-center text-xs font-bold text-[#0F172A] bg-white border-y-0 border-x border-[#CBD5E1] focus:outline-none tabular-nums"
                />
              ) : (
                <button
                  onClick={() => {
                    setTempStock(product.stockQuantity.toString());
                    setIsEditingStock(true);
                  }}
                  className={`w-12 text-center text-xs sm:text-sm font-bold tabular-nums cursor-pointer hover:bg-white transition-colors ${
                    isOutOfStock ? 'text-[#EF4444]' : 'text-[#0F172A]'
                  }`}
                  title="Clic para ingresar cantidad exacta"
                >
                  {product.stockQuantity}
                </button>
              )}

              <button
                onClick={() => handleStockDelta(1)}
                className="w-9 h-9 flex items-center justify-center text-[#475569] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] transition-colors cursor-pointer"
                title="Aumentar stock (+1)"
                aria-label="Sumar una unidad"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Casilla de stock (Checkbox) & Interruptor de stock (Toggle) */}
          <div className="flex items-center gap-3">
            {/* Casilla de stock */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium text-[#475569] hover:text-[#0F172A]">
              <input
                type="checkbox"
                checked={!isOutOfStock}
                onChange={handleCheckboxStockChange}
                className="w-4 h-4 rounded text-[#10B981] focus:ring-[#10B981] border-[#CBD5E1] cursor-pointer"
              />
              <span className="text-xs font-semibold">Disponible</span>
            </label>

            {/* Interruptor de stock (Toggle switch 44x26px) */}
            <button
              type="button"
              onClick={handleToggleStockStatus}
              role="switch"
              aria-checked={!isOutOfStock}
              className={`relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5B3294] ${
                !isOutOfStock ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'
              }`}
              title={!isOutOfStock ? 'Interruptor: En Stock (clic para agotar)' : 'Interruptor: Agotado (clic para activar)'}
            >
              <span
                className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  !isOutOfStock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
