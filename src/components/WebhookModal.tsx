import React, { useState } from 'react';
import {
  X,
  Send,
  Copy,
  Check,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Code2,
  Activity,
} from 'lucide-react';
import { DokanVendor, Product, StoreConfig, WebhookLog } from '../types';
import { generateWebhookPayload } from '../services/webhook';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: DokanVendor;
  products: Product[];
  config: StoreConfig;
  onUpdateConfig: (config: StoreConfig) => void;
  onTriggerWebhook: () => void;
  isDispatching: boolean;
  webhookLogs: WebhookLog[];
}

export const WebhookModal: React.FC<WebhookModalProps> = ({
  isOpen,
  onClose,
  vendor,
  products,
  config,
  onUpdateConfig,
  onTriggerWebhook,
  isDispatching,
  webhookLogs,
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'payload' | 'logs' | 'config'>('payload');
  const [tempWebhookUrl, setTempWebhookUrl] = useState(config.webhookUrl);

  const currentPayload = generateWebhookPayload(vendor, products, config, 'manual_button');
  const payloadString = JSON.stringify(currentPayload, null, 2);

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payloadString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveWebhookUrl = () => {
    onUpdateConfig({
      ...config,
      webhookUrl: tempWebhookUrl.trim(),
    });
  };

  const handleToggleRealtime = () => {
    onUpdateConfig({
      ...config,
      realtimeSync: !config.realtimeSync,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#43167C] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#5B3294] rounded-lg">
              <Activity className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">Diagnóstico de Webhook & Payload Merqba FA</h2>
              <p className="text-[11px] text-purple-200">
                Disparado por el botón &apos;Aplicar Cambios&apos; en la esquina derecha
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-purple-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#E2E8F0] px-5 bg-[#F8FAFC] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('payload')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'payload'
                ? 'border-[#5B3294] text-[#5B3294]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Payload JSON ({products.length} productos)</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-[#5B3294] text-[#5B3294]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historial de Envíos ({webhookLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-[#5B3294] text-[#5B3294]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Configurar Endpoint & Tiempo Real</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'payload' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-[#64748B]">
                  Endpoint destino: <strong className="text-[#0F172A] font-mono">{config.webhookUrl}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPayload}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] rounded-lg transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado!' : 'Copiar JSON'}</span>
                  </button>

                  <button
                    onClick={onTriggerWebhook}
                    disabled={isDispatching}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5B3294] hover:bg-[#43167C] text-xs font-bold text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className={`w-3.5 h-3.5 ${isDispatching ? 'animate-bounce' : ''}`} />
                    <span>Disparar Ahora</span>
                  </button>
                </div>
              </div>

              {/* JSON Payload viewer */}
              <div className="relative">
                <pre className="bg-[#0F172A] text-[#E2E8F0] p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-[380px] leading-relaxed selection:bg-[#5B3294]">
                  {payloadString}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              {webhookLogs.length === 0 ? (
                <div className="text-center py-10 text-[#64748B] space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-[#CBD5E1]" />
                  <p className="text-xs">Aún no se han registrado envíos de webhook.</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    Pulsa &apos;Aplicar Cambios&apos; en la barra superior para disparar el primer webhook.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              log.status === 'success'
                                ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                                : 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                            }`}
                          >
                            {log.status === 'success' ? (
                              <CheckCircle className="w-3 h-3 text-[#10B981]" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-[#EF4444]" />
                            )}
                            {log.statusCode} OK
                          </span>
                          <span className="font-bold text-[#0F172A]">{log.event}</span>
                        </div>
                        <span className="text-[11px] text-[#64748B]">{log.timestamp}</span>
                      </div>

                      <p className="text-[#475569]">{log.responseMessage}</p>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                        <span>Productos enviados: <strong className="text-[#0F172A]">{log.productsSentCount}</strong></span>
                        <span>Latencia: <strong className="text-[#0F172A]">{log.latencyMs} ms</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              {/* Webhook endpoint URL input */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  URL del Webhook (Receptor de datos)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={tempWebhookUrl}
                    onChange={(e) => setTempWebhookUrl(e.target.value)}
                    placeholder="https://webhook.site/tu-endpoint o https://tudominio.com/api/webhook"
                    className="flex-1 px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#5B3294]"
                  />
                  <button
                    onClick={handleSaveWebhookUrl}
                    className="px-4 py-2 bg-[#5B3294] text-white text-xs font-bold rounded-lg hover:bg-[#43167C] cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Puedes pegar tu URL de Webhook.site, Zapier, Make, o el listener de tu tienda WooCommerce.
                </p>
              </div>

              {/* Real-time sync option */}
              <div className="p-3.5 bg-[#FAF8FF] border border-[#D7BAFF] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-[#5B3294]" />
                    Sincronización en Tiempo Real
                  </span>
                  <p className="text-[11px] text-[#475569] mt-0.5">
                    Dispara automáticamente el webhook cada vez que cambias un precio, nombre o stock.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleRealtime}
                  className={`relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.realtimeSync ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      config.realtimeSync ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
