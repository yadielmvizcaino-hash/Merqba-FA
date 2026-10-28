import React, { useState } from 'react';
import { X, Settings, RotateCcw, Check, ShieldCheck, Link2, Zap, Server } from 'lucide-react';
import { StoreConfig } from '../types';

interface StoreConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StoreConfig;
  onSaveConfig: (updated: StoreConfig) => void;
  onResetCatalog: () => void;
}

export const StoreConfigModal: React.FC<StoreConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetCatalog,
}) => {
  if (!isOpen) return null;

  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl);
  const [currencySymbol, setCurrencySymbol] = useState(config.currencySymbol);
  const [realtimeSync, setRealtimeSync] = useState(config.realtimeSync);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...config,
      webhookUrl: webhookUrl.trim() || config.webhookUrl,
      currencySymbol: currencySymbol.trim() || '$',
      realtimeSync,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-[#FF5A00] to-[#FFA000] rounded-xl text-black shadow-xs">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Conexión Merqba FA</h2>
              <p className="text-[11px] text-[#FFA000]">
                Estado de la tienda y sincronización
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Pre-configured Verified Store Card */}
          <div className="p-3.5 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14532D]">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>Tienda Vinculada y Protegida</span>
              </div>
              <span className="text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                API Conectada
              </span>
            </div>

            <div className="text-xs text-[#166534] space-y-1">
              <div className="flex items-center gap-1.5 font-mono">
                <Link2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="font-bold">https://merqba.com</span>
              </div>
              <p className="text-[11px] text-[#15803D]">
                Clave del cliente y secreta aplicadas de forma segura en el servidor. Tus vendedores no necesitan introducirlas para operar.
              </p>
            </div>
          </div>

          {/* Webhook Endpoint */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Endpoint del Webhook (Receptor de datos)
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://merqba.com/wp-json/merqba/v1/sync"
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/25"
            />
            <p className="text-[11px] text-[#64748B] mt-1">
              Receptor al que se disparan las actualizaciones de stock y precios al pulsar &apos;Aplicar Cambios&apos;.
            </p>
          </div>

          {/* Currency Symbol & Realtime switch */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Símbolo de Moneda
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/25"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Tiempo Real
              </label>
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#0F172A]">
                  <input
                    type="checkbox"
                    checked={realtimeSync}
                    onChange={(e) => setRealtimeSync(e.target.checked)}
                    className="w-4 h-4 rounded text-[#10B981] focus:ring-[#FF5A00] border-[#CBD5E1]"
                  />
                  <span>Disparo continuo</span>
                </label>
              </div>
            </div>
          </div>

          {/* Reset / Restore Demo Catalog */}
          <div className="pt-3 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F172A]">Restaurar Inventario</span>
                <p className="text-[11px] text-[#64748B]">
                  Recupera el catálogo inicial de demostración.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('¿Restaurar los productos iniciales? Se perderán las modificaciones locales no sincronizadas.')) {
                    onResetCatalog();
                    onClose();
                  }
                }}
                className="px-3 py-1.5 border border-[#FECACA] hover:bg-[#FEF2F2] text-[#EF4444] text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar</span>
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#CBD5E1] text-[#475569] text-xs font-semibold rounded-lg hover:bg-[#F8FAFC] cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Preferencias</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
