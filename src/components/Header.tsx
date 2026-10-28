import React from 'react';
import { RefreshCw, Send, Settings, Zap, Wifi, WifiOff } from 'lucide-react';
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
  isOnline?: boolean;
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
  isOnline = true,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B0E14] border-b border-[#1F2633] shadow-md">
      {/* Top micro diagnostics bar */}
      <div className="bg-[#06080C] text-slate-300 px-3 sm:px-6 lg:px-8 py-1 text-[11px] font-medium border-b border-[#161B24]">
        <div className="max-w-[2400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-[#1F1712] border border-[#FF5A00]/30 text-[#FFA000] px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#10B981] animate-sync-pulse' : 'bg-[#F59E0B]'}`}></span>
              Merqba FA • Marketplace
            </span>

            {/* Online / Offline status badge */}
            {isOnline ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-[#10B981] bg-[#052E16] border border-[#166534] px-1.5 py-0.2 rounded">
                <Wifi className="w-3 h-3 text-[#10B981]" />
                En línea (Guardado local activo)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FFA000] bg-[#2A1705] border border-[#FF5A00]/50 px-2 py-0.5 rounded animate-pulse">
                <WifiOff className="w-3 h-3 text-[#FFA000]" />
                Modo Offline • Guardado local activo
              </span>
            )}

            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-400 hidden sm:inline truncate max-w-[220px]">
              {config.storeUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {config.realtimeSync && (
              <span className="flex items-center gap-1 text-[#4EDE93] text-[10px] font-semibold bg-[#052E16] border border-[#166534] px-1.5 py-0.5 rounded">
                <Zap className="w-3 h-3 text-[#10B981]" />
                Tiempo Real Activo
              </span>
            )}
            <button
              onClick={onOpenWebhookLogs}
              className="text-slate-300 hover:text-[#FFA000] transition-colors underline flex items-center gap-1 cursor-pointer"
              title="Ver registro de Webhook y Payload"
            >
              Payload / Webhook
            </button>
            <span className="text-slate-400 text-[10px]">Sync: {lastSyncTime}</span>
          </div>
        </div>
      </div>

      {/* Main navigation & actions bar */}
      <div className="max-w-[2400px] mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2">
        {/* Left: Official Merqba Brand Logo & Vendor Identity */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {/* Official Brand Logo */}
          <div className="hidden sm:flex items-center gap-2 pr-1.5 sm:pr-3 sm:border-r border-[#1E2530] shrink-0">
            <img
              src="/assets/aistudio/logotipo_merqba_8e430d75.png"
              alt="merqba"
              className="h-8 sm:h-9 w-auto object-contain shrink-0 drop-shadow-xs"
            />
            <span className="bg-gradient-to-r from-[#FF5A00] to-[#FFA000] text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-md shadow-xs uppercase tracking-wider">
              FA
            </span>
          </div>

          {/* Vendor info button */}
          <button
            onClick={onOpenVendorLogin}
            className="relative flex items-center gap-2 text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF5A00] rounded-xl p-1 -m-1 transition-all min-w-0 hover:bg-[#161B24]"
            title="Cambiar de Tienda / Vendedor"
          >
            <div className="relative shrink-0">
              <img
                src={currentVendor.avatar}
                alt={currentVendor.name}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-[#FF5A00] shadow-xs"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#10B981] border-2 border-[#0B0E14] rounded-full"
                title="Vendedor activo y conectado"
              ></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-white text-xs sm:text-sm md:text-base leading-tight truncate max-w-[120px] sm:max-w-[200px] md:max-w-[240px]">
                  {currentVendor.storeName}
                </h1>
                <span className="text-[10px] font-bold bg-[#1C1814] text-[#FFA000] border border-[#FF5A00]/30 px-1.5 py-0.5 rounded shrink-0">
                  ID: #{currentVendor.id}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {currentVendor.name} • <span className="text-[#FF8C00] font-medium group-hover:underline">Cambiar</span>
              </p>
            </div>
          </button>
        </div>

        {/* Right: Sync & Apply Changes (Webhook) */}
        <div className="flex items-center gap-2">
          {/* Settings / Config Button */}
          <button
            onClick={onOpenStoreConfig}
            className="p-2 text-slate-300 hover:text-white hover:bg-[#1C222E] rounded-lg transition-colors cursor-pointer border border-[#273142] h-10 w-10 flex items-center justify-center shrink-0 bg-[#121620]"
            title="Configuración de Merqba y Webhook"
            aria-label="Configurar tienda"
          >
            <Settings className="w-5 h-5 text-slate-300" />
          </button>

          {/* Sync Button */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#273142] bg-[#121620] hover:bg-[#1C222E] active:bg-[#252E3D] text-slate-100 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-60 h-10 shrink-0"
            title="Sincronizar catálogo con Merqba"
          >
            <RefreshCw className={`w-4 h-4 text-[#FFA000] ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          {/* Apply Changes Button: Merqba Vibrant Sunset Orange (Hidden on mobile, present in BottomMobileBar) */}
          <button
            onClick={onApplyChanges}
            disabled={isDispatchingWebhook}
            className={`relative hidden sm:flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm transition-all cursor-pointer h-10 shrink-0 ${
              pendingChangesCount > 0
                ? 'bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] ring-2 ring-[#FFA000]/60 active:scale-[0.98]'
                : 'bg-gradient-to-r from-[#FF5A00] to-[#FF8C00] hover:from-[#E64C00] hover:to-[#E67800] active:scale-[0.98]'
            } disabled:opacity-60`}
            title="Aplicar cambios y disparar webhook con datos de todos los productos"
          >
            <Send className={`w-4 h-4 ${isDispatchingWebhook ? 'animate-bounce' : ''}`} />
            <span className="font-extrabold">Aplicar Cambios</span>

            {/* Badge for pending changes */}
            {pendingChangesCount > 0 ? (
              <span className="ml-0.5 bg-white text-[#C2410C] text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums shadow-xs">
                {pendingChangesCount}
              </span>
            ) : (
              <span className="hidden md:inline-block text-[11px] text-orange-100 font-normal">
                (Webhook)
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
