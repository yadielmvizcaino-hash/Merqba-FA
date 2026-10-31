import React, { useState, useRef } from 'react';
import { X, Upload, Check, DollarSign, PackagePlus, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { Product, StoreConfig, DokanVendor } from '../types';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: DokanVendor;
  categories: string[];
  config: StoreConfig;
  onCreateProduct: (newProductData: Partial<Product>) => Promise<boolean>;
}

export const CreateProductModal: React.FC<CreateProductModalProps> = ({
  isOpen,
  onClose,
  vendor,
  categories,
  config,
  onCreateProduct,
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [stockStatus, setStockStatus] = useState<'instock' | 'outofstock'>('instock');
  const [sku, setSku] = useState(`SKU-${Math.floor(Math.random() * 89999 + 10000)}`);
  const [category, setCategory] = useState(categories[0] || 'General');
  const [customCategory, setCustomCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File upload handler
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

  const handleStockToggle = () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Por favor ingresa el nombre del producto.');
      return;
    }

    const parsedRegular = parseFloat(regularPrice);
    if (isNaN(parsedRegular) || parsedRegular < 0) {
      setErrorMsg('Por favor ingresa un precio regular válido.');
      return;
    }

    const parsedSale = salePrice ? parseFloat(salePrice) : undefined;
    if (parsedSale !== undefined && (isNaN(parsedSale) || parsedSale < 0)) {
      setErrorMsg('El precio de oferta no es válido.');
      return;
    }

    const parsedQty = parseInt(stockQuantity, 10);
    const finalCategory = customCategory.trim() || category;

    const newProductPayload: Partial<Product> = {
      vendorId: vendor.id,
      name: cleanName,
      regularPrice: parsedRegular,
      salePrice: parsedSale,
      price: parsedSale !== undefined && parsedSale > 0 ? parsedSale : parsedRegular,
      stockQuantity: isNaN(parsedQty) ? 0 : parsedQty,
      stockStatus: (isNaN(parsedQty) || parsedQty <= 0) ? 'outofstock' : stockStatus,
      manageStock: true,
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      category: finalCategory,
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop&q=80',
      description: description.trim(),
    };

    setIsSubmitting(true);
    try {
      const success = await onCreateProduct(newProductPayload);
      if (success) {
        // Reset state & close
        setName('');
        setRegularPrice('');
        setSalePrice('');
        setImageUrl('');
        setDescription('');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado al crear el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FF5A00] to-[#FFA000] flex items-center justify-center shadow-xs">
              <PackagePlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Añadir Nuevo Producto</h2>
              <p className="text-[11px] text-slate-400">
                Para: <span className="text-[#FFA000] font-medium">{vendor.storeName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Cerrar sin guardar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Nombre del Producto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Tinte en Crema Profesional Kolor Shot..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/15"
              disabled={isSubmitting}
            />
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Precio Regular <span className="text-red-500">*</span> ({config.currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B]">
                  {config.currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] tabular-nums"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Precio Oferta ({config.currencySymbol}) <span className="text-[10px] text-[#64748B] font-normal">(Opcional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B]">
                  {config.currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Opcional"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] tabular-nums"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Stock Section */}
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F172A]">Estado de Inventario</span>
                <p className="text-[11px] text-[#64748B]">
                  {stockStatus === 'instock' ? 'Producto disponible para compra' : 'Producto marcado como Agotado'}
                </p>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={handleStockToggle}
                disabled={isSubmitting}
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
                required
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                disabled={stockStatus === 'outofstock' || isSubmitting}
                className="w-24 px-2 py-1.5 text-center bg-white border border-[#CBD5E1] rounded-lg text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
              />
            </div>
          </div>

          {/* SKU & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Código SKU
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-XXXXX"
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#FF5A00]"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00]"
                disabled={isSubmitting}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="Otra">Otra...</option>
              </select>
            </div>
          </div>

          {category === 'Otra' && (
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Escribe el nombre de la categoría
              </label>
              <input
                type="text"
                placeholder="Ej: Herramientas, Belleza..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00]"
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Image Section */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Imagen del Producto
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-[#CBD5E1] bg-[#F1F5F9] shrink-0 flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt="Vista previa" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-[#94A3B8]" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
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
                  disabled={isSubmitting}
                  className="w-full py-1.5 px-3 border border-[#CBD5E1] hover:border-[#FF5A00] bg-[#F8FAFC] hover:bg-white text-xs font-semibold text-[#0F172A] rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-[#FF5A00]" />
                  <span>Subir imagen desde dispositivo</span>
                </button>
                <input
                  type="url"
                  placeholder="O pega aquí una URL de imagen (https://...)"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-2.5 py-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] text-[#0F172A] focus:outline-none focus:border-[#FF5A00]"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Descripción del Producto <span className="text-[10px] text-[#64748B] font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre el producto, características, presentación..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00] resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Creando en WooCommerce...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Crear Producto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
