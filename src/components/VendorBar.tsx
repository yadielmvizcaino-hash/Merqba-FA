import React from 'react';
import { Store, Star, PackageCheck, AlertTriangle, Layers, UserCheck, ShieldCheck } from 'lucide-react';
import { DokanVendor, Product } from '../types';

interface VendorBarProps {
  vendor: DokanVendor;
  products: Product[];
  onOpenVendorLogin: () => void;
}

export const VendorBar: React.FC<VendorBarProps> = ({ vendor, products, onOpenVendorLogin }) => {
  const inStockCount = products.filter((p) => p.stockStatus === 'instock' && p.stockQuantity > 0).length;
  const outOfStockCount = products.filter((p) => p.stockStatus === 'outofstock' || p.stockQuantity === 0).length;
  const modifiedCount = products.filter((p) => p.isModifiedLocally).length;

  return (
    <div className="bg-white border-b border-[#E2E8F0] px-3 sm:px-6 lg:px-8 py-3 shadow-xs">
      <div className="max-w-[2400px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Vendor Banner Info */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#EAEDFF] text-[#43167C] rounded-lg shrink-0">
            <Store className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Merqba FA • Panel de Vendedor
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#ECFDF5] text-[#065F46] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                <ShieldCheck className="w-3 h-3 text-[#10B981]" />
                Autenticado
              </span>
              <span className="flex items-center gap-1 text-[11px] text-[#475569]">
                <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                <span className="font-bold text-[#0F172A]">{vendor.rating}</span>
                <span>({vendor.ratingCount} valoraciones)</span>
              </span>
            </div>

            <p className="text-xs text-[#475569] mt-0.5">
              Filtrado activo: <strong className="text-[#0F172A] font-semibold">{vendor.storeName}</strong> (ID #{vendor.id}) • Solo tus productos son visibles y editables.
            </p>
          </div>
        </div>

        {/* Quick Statistics chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs shrink-0">
            <Layers className="w-4 h-4 text-[#5B3294]" />
            <span className="text-[#475569]">Total:</span>
            <span className="font-bold text-[#0F172A] tabular-nums">{products.length}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-xs text-[#065F46] shrink-0">
            <PackageCheck className="w-4 h-4 text-[#10B981]" />
            <span>En Stock:</span>
            <span className="font-bold tabular-nums">{inStockCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] shrink-0">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <span>Agotados:</span>
            <span className="font-bold tabular-nums">{outOfStockCount}</span>
          </div>

          {modifiedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] shrink-0 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping"></span>
              <span>Por guardar:</span>
              <span className="font-bold tabular-nums">{modifiedCount}</span>
            </div>
          )}

          <button
            onClick={onOpenVendorLogin}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#5B3294] hover:bg-[#F3E8FF] rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ml-auto border border-[#E9D5FF]"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Cambiar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
