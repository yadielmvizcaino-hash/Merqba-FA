import React from 'react';
import { RefreshCw, Send, Settings, User, Zap } from 'lucide-react';
import { DokanVendor, StoreConfig } from '../types';

interface HeaderProps {
  currentVendor: DokanVendor;
  config: StoreConfig;
  pendingChangesCount: number;
  isSyncing: boolean;
  isDispatchingWebhook: boolean;
  onSync: () => void;
  onApplyChanges: () => void;
  onOpenVendorLogin: () => void;
  onOpenStoreConfig: () => void;
  onOpenWebhookLogs: () => void;
  lastSyncTime: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentVendor,
  config,
  pendingChangesCount,
  isSyncing,
  isDispatchingWebhook,
  onSync,
  onApplyChanges,
  onOpenVendorLogin,
  onOpenStoreConfig,
  onOpenWebhookLogs,
  lastSyncTime,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-sm">
      {/* Top micro diagnostics bar */}
      <div className="bg-[#43167C] text-white px-3 sm:px-6 lg:px-8 py-1 text-[11px] font-medium">
        <div className="max-w-[2400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-[#5B3294] px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-purple-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-sync-pulse"></span>
              Merqba FA • Marketplace
            </span>
            <span className="text-purple-200 hidden sm:inline">|</span>
            <span className="text-purple-100 hidden sm:inline truncate max-w-[200px]">
              {config.storeUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {config.realtimeSync && (
              <span className="flex items-center gap-1 text-[#6CF8BB] text-[10px] font-semibold bg-[#006C49]/40 px-1.5 py-0.5 rounded">
                <Zap className="w-3 h-3" />
                Tiempo Real Activo
              </span>
            )}
            <button
              onClick={onOpenWebhookLogs}
              className="text-purple-200 hover:text-white transition-colors underline flex items-center gap-1 cursor-pointer"
              title="Ver registro de Webhook y Payload"
            >
              Payload / Webhook
            </button>
            <span className="text-purple-300 text-[10px]">Sync: {lastSyncTime}</span>
          </div>
        </div>
      </div>

      {/* Main navigation & actions bar */}
      <div className="max-w-[2400px] mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2">
        {/* Left: Merqba FA Brand & Vendor Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-1.5 sm:gap-2 pr-1.5 sm:pr-3 sm:border-r border-[#E2E8F0] shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#5B3294] to-[#43167C] flex items-center justify-center text-white shadow-xs">
              <span className="font-extrabold text-sm sm:text-base tracking-tight">M</span>
            </div>
            <div>
              <div className="text-xs sm:text-sm md:text-base font-extrabold text-[#0F172A] leading-tight tracking-tight flex items-center gap-0.5">
                <span>Merqba</span>
                <span className="text-[#5B3294] font-black bg-[#EAEDFF] px-1 rounded text-[11px] sm:text-xs">FA</span>
              </div>
              <span className="hidden md:block text-[8px] sm:text-[9px] text-[#64748B] font-bold uppercase tracking-wider">
                Fast Inventory
              </span>
            </div>
          </div>

          {/* Vendor info button */}
          <button
            onClick={onOpenVendorLogin}
            className="relative flex items-center gap-2 text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5B3294] rounded-lg p-1 -m-1 transition-all min-w-0"
            title="Cambiar de Tienda / Vendedor"
          >
            <div className="relative shrink-0">
              <img
                src={currentVendor.avatar}
                alt={currentVendor.name}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-[#5B3294] shadow-xs"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#10B981] border-2 border-white rounded-full"
                title="Vendedor activo y conectado"
              ></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[#0F172A] text-xs sm:text-sm md:text-base leading-tight truncate max-w-[120px] sm:max-w-[200px] md:max-w-[240px]">
                  {currentVendor.storeName}
                </h1>
                <span className="text-[10px] font-bold bg-[#E2E7FF] text-[#43167C] px-1.5 py-0.5 rounded shrink-0">
                  ID: #{currentVendor.id}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#475569] truncate">
                {currentVendor.name} • <span className="text-[#5B3294] font-medium group-hover:underline">Cambiar</span>
              </p>
            </div>
          </button>
        </div>

        {/* Right: Sync & Apply Changes (Webhook) */}
        <div className="flex items-center gap-2">
          {/* Settings / Config Button */}
          <button
            onClick={onOpenStoreConfig}
            className="p-2 text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer border border-[#E2E8F0] h-10 w-10 flex items-center justify-center shrink-0"
            title="Configuración de WooCommerce y Webhook"
            aria-label="Configurar tienda"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Sync Button */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] active:bg-[#F1F5F9] text-[#0F172A] text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-60 h-10 shrink-0"
            title="Sincronizar catálogo con WooCommerce"
          >
            <RefreshCw className={`w-4 h-4 text-[#5B3294] ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          {/* Apply Changes Button (in the top right corner as requested!):
              "🔥Botón en la esquina derecha para aplicar cambios (esto dispara el webhook enviando todos los datos de los productos de la tienda o si es posible en tiempo real" */}
          <button
            onClick={onApplyChanges}
            disabled={isDispatchingWebhook}
            className={`relative flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-sm transition-all cursor-pointer h-10 shrink-0 ${
              pendingChangesCount > 0
                ? 'bg-[#5B3294] hover:bg-[#47167C] active:scale-[0.98] ring-2 ring-[#cca8ff]'
                : 'bg-[#5B3294] hover:bg-[#47167C] active:bg-[#340f63]'
            } disabled:opacity-60`}
            title="Aplicar cambios y disparar webhook con datos de todos los productos"
          >
            <Send className={`w-4 h-4 ${isDispatchingWebhook ? 'animate-bounce' : ''}`} />
            <span className="font-bold">Aplicar Cambios</span>

            {/* Badge for pending changes */}
            {pendingChangesCount > 0 ? (
              <span className="ml-0.5 bg-[#F59E0B] text-[#131B2E] text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums animate-pulse">
                {pendingChangesCount}
              </span>
            ) : (
              <span className="hidden md:inline-block text-[11px] text-purple-200 font-normal">
                (Webhook)
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
