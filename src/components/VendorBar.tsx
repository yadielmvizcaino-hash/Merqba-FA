import React from 'react';
import { PackageCheck, AlertTriangle, Layers, UserCheck, LogOut } from 'lucide-react';
import { DokanVendor, Product } from '../types';

interface VendorBarProps {
  vendor?: DokanVendor;
  products: Product[];
  onOpenVendorLogin: () => void;
  onLogout?: () => void;
}

export const VendorBar: React.FC<VendorBarProps> = ({ products, onOpenVendorLogin, onLogout }) => {
  const inStockCount = products.filter((p) => p.stockStatus === 'instock' && p.stockQuantity > 0).length;
  const outOfStockCount = products.filter((p) => p.stockStatus === 'outofstock' || p.stockQuantity === 0).length;
  const modifiedCount = products.filter((p) => p.isModifiedLocally).length;

  return (
    <div className="bg-white border-b border-[#E2E8F0] px-3 sm:px-6 lg:px-8 py-2.5 shadow-xs">
      <div className="max-w-[2400px] mx-auto flex items-center justify-between gap-3">
        {/* Quick Statistics chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs shrink-0">
            <Layers className="w-4 h-4 text-[#EA580C]" />
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
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFF7ED] border border-[#FDBA74] rounded-lg text-xs text-[#C2410C] shrink-0 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#FF5A00] animate-ping"></span>
              <span>Por guardar:</span>
              <span className="font-bold tabular-nums">{modifiedCount}</span>
            </div>
          )}

          <button
            onClick={onOpenVendorLogin}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#EA580C] hover:bg-[#FFF7ED] rounded-lg font-bold transition-colors cursor-pointer shrink-0 ml-auto border border-[#FED7AA]"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Cambiar</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors cursor-pointer shrink-0 border border-red-200"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
