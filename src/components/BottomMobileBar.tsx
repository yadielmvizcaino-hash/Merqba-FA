import React from 'react';
import { Send, Download } from 'lucide-react';
import { Product, StoreConfig } from '../types';

interface BottomMobileBarProps {
  products: Product[];
  config: StoreConfig;
  pendingCount: number;
  filteredCount: number;
  isDispatching: boolean;
  onApplyChanges: () => void;
  onSync: () => void;
  onDownloadCsv: () => void;
}

export const BottomMobileBar: React.FC<BottomMobileBarProps> = ({
  products,
  config,
  pendingCount,
  filteredCount,
  isDispatching,
  onApplyChanges,
  onSync,
  onDownloadCsv,
}) => {
  const totalValue = products.reduce((acc, p) => acc + p.price * p.stockQuantity, 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-[0_-4px_12px_rgba(15,23,42,0.06)] px-3 py-2 sm:hidden">
      <div className="flex items-center justify-between gap-2">
        {/* Metric summary */}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-[#64748B] flex items-center gap-1 font-semibold uppercase tracking-wider truncate">
            <span>Inventario</span>
            <span>•</span>
            <span className="text-[#0F172A]">{products.length} SKUs</span>
          </div>
          <div className="text-xs font-black text-[#0F172A] tabular-nums truncate">
            Valor: {config.currencySymbol}{totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Export CSV quick button for mobile audits */}
        <button
          onClick={onDownloadCsv}
          disabled={filteredCount === 0}
          className="flex items-center justify-center gap-1 px-2.5 py-2 text-[#0F172A] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl text-xs font-bold transition-all cursor-pointer h-10 disabled:opacity-40 shrink-0"
          title="Descargar CSV para auditoría offline"
          aria-label="Exportar CSV"
        >
          <Download className="w-4 h-4 text-[#EA580C]" />
          <span className="hidden xs:inline text-[11px]">CSV</span>
        </button>

        {/* Action Button: Disparar Webhook / Aplicar Cambios */}
        <button
          onClick={onApplyChanges}
          disabled={isDispatching}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer h-10 shrink-0 ${
            pendingCount > 0
              ? 'bg-gradient-to-r from-[#FF5A00] to-[#FFA000] ring-2 ring-[#FFA000]/50 active:scale-95 shadow-[#FF5A00]/25'
              : 'bg-gradient-to-r from-[#FF5A00] to-[#FF8C00] active:opacity-90'
          } disabled:opacity-60`}
        >
          <Send className={`w-3.5 h-3.5 ${isDispatching ? 'animate-bounce' : ''}`} />
          <span>Aplicar</span>
          {pendingCount > 0 && (
            <span className="bg-[#0B0E14] text-[#FFA000] border border-[#FFA000]/40 text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums">
              {pendingCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
