import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Product, StoreConfig } from '../types';

interface DeleteConfirmationModalProps {
  product: Product | null;
  config: StoreConfig;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (product: Product) => void;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  product,
  config,
  isOpen,
  onClose,
  onConfirmDelete,
  isDeleting = false,
}) => {
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#FECACA] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#FEF2F2] border-b border-[#FECACA] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FEE2E2] text-[#DC2626] rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#991B1B]">Eliminar Producto</h2>
              <p className="text-[11px] text-[#B91C1C]">Confirma si deseas borrar este artículo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#991B1B] hover:text-[#7F1D1D] rounded-lg hover:bg-[#FEE2E2] transition-colors cursor-pointer"
            title="Cancelar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Product Mini Preview */}
          <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-16 h-16 rounded-lg object-cover border border-[#CBD5E1] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                ID: #{product.id} • SKU: {product.sku}
              </span>
              <h3 className="font-bold text-xs sm:text-sm text-[#0F172A] line-clamp-2 leading-tight mt-0.5">
                {product.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs sm:text-sm font-extrabold text-[#0F172A]">
                  {config.currencySymbol}{product.price.toFixed(2)}
                </span>
                <span className="text-[10px] font-semibold text-[#64748B]">
                  • Stock: {product.stockQuantity} unid.
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#475569] leading-relaxed">
            ¿Estás seguro de que deseas eliminar permanentemente este producto de tu catálogo? Esta acción no se puede deshacer.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 border border-[#CBD5E1] text-[#475569] text-xs font-semibold rounded-lg hover:bg-[#F8FAFC] cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => onConfirmDelete(product)}
              disabled={isDeleting}
              className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Eliminando...' : 'Sí, Eliminar Producto'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
