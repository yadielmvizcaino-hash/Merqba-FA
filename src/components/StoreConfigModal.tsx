import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Settings,
  Check,
  ShieldCheck,
  Link2,
  LogOut,
  Coins,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Info,
} from 'lucide-react';
import { StoreConfig, DokanVendor } from '../types';

interface StoreConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StoreConfig;
  currentVendor?: DokanVendor;
  isAuthenticated?: boolean;
  onSaveConfig: (updated: StoreConfig) => void;
  onResetCatalog: () => void;
  onLogout: () => void;
  onOpenVendorLogin: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const StoreConfigModal: React.FC<StoreConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  currentVendor,
  isAuthenticated = false,
  onSaveConfig,
  onLogout,
  onOpenVendorLogin,
  onShowToast,
}) => {
  // Tabs state: 'exchange-rate' (New Section) vs 'general'
  const [activeTab, setActiveTab] = useState<'exchange-rate' | 'general'>('exchange-rate');

  // General settings state
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl);

  useEffect(() => {
    if (isOpen) {
      setWebhookUrl(config.webhookUrl);
    }
  }, [isOpen, config.webhookUrl]);

  // Exchange rate state
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [minRate, setMinRate] = useState<number | null>(null);
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [hasConfiguredRate, setHasConfiguredRate] = useState(false);
  const [inputRate, setInputRate] = useState<string>('');
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateSuccess, setRateSuccess] = useState<string | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);

  // Helper to extract session token & credentials from sessionStorage
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const sessionToken = sessionStorage.getItem('merqba_session_token');
    if (sessionToken) {
      headers['x-session-token'] = sessionToken;
    }
    try {
      const raw = sessionStorage.getItem('merqba_auth_user');
      if (raw) {
        const creds = JSON.parse(raw);
        if (creds.username) headers['x-vendor-username'] = creds.username;
        if (creds.password) headers['x-vendor-password'] = creds.password;
      }
    } catch (e) {
      // ignore
    }
    return headers;
  };

  // Fetch exchange rate from server (WordPress & FOX)
  const fetchExchangeRate = useCallback(async () => {
    setIsLoadingRate(true);
    setRateError(null);
    setRateSuccess(null);
    setAuthError(false);

    try {
      const response = await fetch('/api/vendor/exchange-rate', {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (response.status === 401) {
        setAuthError(true);
        setRateError(data.message || 'Error de autenticación. Tu sesión ha expirado o no estás autenticado.');
        return;
      }

      if (response.ok && data.success) {
        const fetchedMin = data.minRate !== undefined && data.minRate !== null ? Number(data.minRate) : null;
        setMinRate(fetchedMin);
        setCurrentRate(data.currentRate);
        setHasConfiguredRate(Boolean(data.hasConfiguredRate));

        if (data.currentRate) {
          setInputRate(String(data.currentRate));
        } else if (fetchedMin) {
          setInputRate(String(fetchedMin));
        }
      } else {
        setRateError(data.message || 'No se pudo consultar la tasa de cambio desde WordPress.');
      }
    } catch (err: any) {
      setRateError('Error de conexión al consultar la tasa de cambio con WordPress.');
    } finally {
      setIsLoadingRate(false);
    }
  }, []);

  // Fetch exchange rate on initial open when authenticated
  useEffect(() => {
    if (isOpen && activeTab === 'exchange-rate' && isAuthenticated) {
      fetchExchangeRate();
    }
  }, [isOpen, activeTab, isAuthenticated, fetchExchangeRate]);

  // Handle saving the new exchange rate
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateError(null);
    setRateSuccess(null);

    const parsed = parseFloat(inputRate);

    // Client-side quick checks
    if (isNaN(parsed) || parsed <= 0) {
      setRateError('Por favor introduce un número válido mayor que cero para la tasa.');
      return;
    }

    if (minRate === null) {
      setRateError('FOX / WordPress no ha devuelto una tasa mínima permitida válida. Reintenta la consulta.');
      return;
    }

    if (minRate && parsed < minRate) {
      setRateError(
        `La tasa introducida (${parsed} CUP) no puede ser inferior a la tasa mínima global de Merqba en FOX (${minRate} CUP).`
      );
      return;
    }

    setIsSavingRate(true);

    try {
      const response = await fetch('/api/vendor/exchange-rate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rate: parsed }),
      });

      const data = await response.json();

      if (response.status === 401) {
        setAuthError(true);
        setRateError('Error de autenticación. Tu sesión ha expirado o no estás autenticado.');
        return;
      }

      if (response.ok && data.success) {
        setCurrentRate(data.rate);
        setHasConfiguredRate(true);
        if (data.minRate) {
          setMinRate(data.minRate);
        }
        setRateSuccess(
          data.message || `¡Tasa de cambio de ${data.rate} CUP/USD guardada exitosamente en WordPress!`
        );
        if (onShowToast) {
          onShowToast(
            'success',
            'Tasa de Cambio Guardada',
            `Tu tasa individual de ${data.rate} CUP/USD fue actualizada y confirmada por WordPress.`
          );
        }
      } else {
        setRateError(data.message || 'Error al guardar la tasa de cambio en el servidor.');
      }
    } catch (err: any) {
      setRateError('Error de red al comunicar con el servidor de WooCommerce/WordPress.');
    } finally {
      setIsSavingRate(false);
    }
  };

  // Handle General Store Config submit
  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...config,
      webhookUrl: webhookUrl.trim() || config.webhookUrl,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-[#FF5A00] to-[#FFA000] rounded-xl text-black shadow-xs">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configuración de Tienda</h2>
              <p className="text-[11px] text-[#FFA000]">
                {currentVendor ? currentVendor.storeName : 'Gestión de Vendedor Merqba'}
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

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('exchange-rate')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'exchange-rate'
                ? 'border-[#FF5A00] text-[#FF5A00] bg-white rounded-t-lg'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Tasa de cambio</span>
            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#FF5A00]/10 text-[#FF5A00]">
              USD / CUP
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-[#FF5A00] text-[#FF5A00] bg-white rounded-t-lg'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Tienda y Webhook</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5">
          {/* TAB 1: TASA DE CAMBIO */}
          {activeTab === 'exchange-rate' && (
            <div className="space-y-4">
              {/* Vendor Identity & Refresh Bar */}
              <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block tracking-wider">
                    Vendedor Autenticado (Dokan)
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-extrabold text-xs text-[#0F172A] truncate">
                      {currentVendor ? currentVendor.storeName : 'Vendedor Actual'}
                    </span>
                    {currentVendor && (
                      <span className="text-[10px] font-bold text-[#64748B] bg-slate-200 px-1.5 py-0.2 rounded">
                        ID #{currentVendor.id}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchExchangeRate}
                  disabled={isLoadingRate || isSavingRate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[#334155] rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Refrescar tasa de cambio desde WordPress y FOX"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#FF5A00] ${isLoadingRate ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refrescar</span>
                </button>
              </div>

              {/* Status / Loading display */}
              {isLoadingRate ? (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-7 h-7 text-[#FF5A00] animate-spin mx-auto" />
                  <p className="text-xs text-[#64748B] font-medium">
                    Consultando tasa en WordPress y FOX Currency Switcher...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSaveRate} className="space-y-4">
                  {/* Two Cards Row: Min FOX rate vs Current Individual Rate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Minimum Rate from FOX Card */}
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-3.5 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E40AF]">
                          Tasa Mínima Global
                        </span>
                        <span className="text-[9px] font-extrabold bg-[#DBEAFE] text-[#1D4ED8] px-1.5 py-0.2 rounded">
                          FOX (WOOCS)
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[#1E3A8A]">
                          {minRate !== null ? minRate.toFixed(2) : 'No disponible'}
                        </span>
                        {minRate !== null && <span className="text-xs font-bold text-[#3B82F6]">CUP / USD</span>}
                      </div>
                      <p className="text-[10px] text-[#1E40AF]/80 leading-tight">
                        Establecida por el administrador. Ningún vendedor puede fijar una tasa inferior a este valor.
                      </p>
                    </div>

                    {/* Current Individual Rate Card */}
                    <div
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        hasConfiguredRate && currentRate
                          ? 'bg-[#F0FDF4] border-[#BBF7D0]'
                          : 'bg-[#FFFBEB] border-[#FDE68A]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            hasConfiguredRate && currentRate ? 'text-[#166534]' : 'text-[#92400E]'
                          }`}
                        >
                          Tu Tasa Actual
                        </span>
                        {hasConfiguredRate && currentRate ? (
                          <span className="text-[9px] font-extrabold bg-[#DCFCE7] text-[#15803D] px-1.5 py-0.2 rounded flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            Configurada
                          </span>
                        ) : (
                          <span className="text-[9px] font-extrabold bg-[#FEF3C7] text-[#B45309] px-1.5 py-0.2 rounded">
                            Sin configurar
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-black ${
                            hasConfiguredRate && currentRate ? 'text-[#14532D]' : 'text-[#78350F]'
                          }`}
                        >
                          {hasConfiguredRate && currentRate ? currentRate.toFixed(2) : 'Sin tasa'}
                        </span>
                        {hasConfiguredRate && currentRate && (
                          <span className="text-xs font-bold text-[#16A34A]">CUP / USD</span>
                        )}
                      </div>

                      <p
                        className={`text-[10px] leading-tight ${
                          hasConfiguredRate && currentRate ? 'text-[#166534]/80' : 'text-[#92400E]/80'
                        }`}
                      >
                        {hasConfiguredRate && currentRate
                          ? 'Guardada en WordPress en `user_meta: _merqba_usd_cup_rate`.'
                          : `Tu tienda aplica la tasa estándar (${minRate !== null ? minRate + ' CUP' : 'del administrador'}) hasta que configures una tasa.`}
                      </p>
                    </div>
                  </div>

                  {/* State H Notice: Missing FOX / WP Minimum Rate */}
                  {minRate === null && !isLoadingRate && !authError && (
                    <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-center justify-between gap-2.5 text-xs text-[#92400E] animate-fade-in">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">FOX / WordPress no ha devuelto una tasa mínima permitida válida.</p>
                          <p className="text-[11px] text-[#B45309]">No es posible guardar una tasa sin validar el mínimo. Reintenta la consulta.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={fetchExchangeRate}
                        className="px-2.5 py-1 bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}

                  {/* State G Notice: Authentication Error */}
                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs text-red-800 animate-fade-in">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Error de autenticación</p>
                          <p className="text-[11px] text-red-600">Tu sesión ha expirado o no estás autenticado como vendedor.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenVendorLogin();
                        }}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-lg shrink-0 cursor-pointer"
                      >
                        Iniciar Sesión
                      </button>
                    </div>
                  )}

                  {/* Input Form Section */}
                  <div className="space-y-2 pt-1">
                    <label htmlFor="newRateInput" className="block text-xs font-bold text-[#0F172A]">
                      Establecer Nueva Tasa de Cambio (USD a CUP)
                    </label>

                    <div className="relative rounded-xl shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                        $1 USD =
                      </div>
                      <input
                        id="newRateInput"
                        type="number"
                        step="0.01"
                        min={minRate || 980}
                        required
                        value={inputRate}
                        onChange={(e) => {
                          setInputRate(e.target.value);
                          setRateError(null);
                          setRateSuccess(null);
                        }}
                        placeholder={minRate ? String(minRate) : '980'}
                        className="w-full pl-20 pr-16 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm font-extrabold text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-xs">
                        CUP
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-[#64748B] mr-1">Atajos rápidos:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setInputRate(String(minRate));
                          setRateError(null);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#FF5A00]/10 hover:text-[#FF5A00] text-[10px] font-bold rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        Mínimo ({minRate})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = parseFloat(inputRate) || minRate || 980;
                          setInputRate(String(base + 10));
                          setRateError(null);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#FF5A00]/10 hover:text-[#FF5A00] text-[10px] font-bold rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        +10 CUP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = parseFloat(inputRate) || minRate || 980;
                          setInputRate(String(base + 25));
                          setRateError(null);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#FF5A00]/10 hover:text-[#FF5A00] text-[10px] font-bold rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        +25 CUP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = parseFloat(inputRate) || minRate || 980;
                          setInputRate(String(base + 50));
                          setRateError(null);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#FF5A00]/10 hover:text-[#FF5A00] text-[10px] font-bold rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        +50 CUP
                      </button>
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px] text-[#64748B] pt-1">
                      <Info className="w-3.5 h-3.5 text-[#3B82F6] shrink-0 mt-0.5" />
                      <span>
                        Se comunica mediante <code className="bg-slate-100 px-1 py-0.5 rounded text-[#0F172A] font-mono text-[10px]">/wp-json/merqba/v1/vendor-rate</code> y se almacena en el metadato <code className="bg-slate-100 px-1 py-0.5 rounded text-[#0F172A] font-mono text-[10px]">_merqba_usd_cup_rate</code> de WordPress.
                      </span>
                    </div>
                  </div>

                  {/* Success Alert */}
                  {rateSuccess && (
                    <div className="p-3 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl flex items-start gap-2.5 text-xs text-[#166534] animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold">{rateSuccess}</p>
                        <p className="text-[11px] text-[#15803D]">
                          Los productos de tu tienda en Merqba se cotizarán con tu nueva tasa.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error Alert */}
                  {rateError && (
                    <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-start gap-2.5 text-xs text-[#991B1B] animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold">Error de validación</p>
                        <p className="text-[11px] text-[#B91C1C]">{rateError}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
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
                      disabled={isSavingRate || !inputRate}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingRate ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando en WordPress...</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          <span>Guardar Tasa de Cambio</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: TIENDA Y WEBHOOK (GENERAL) */}
          {activeTab === 'general' && (
            <form onSubmit={handleGeneralSubmit} className="space-y-4">
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
                    Credenciales aplicadas de forma segura en el servidor.
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
                  className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/25"
                />
                <p className="text-[11px] text-[#64748B] mt-1">
                  Receptor al que se disparan las actualizaciones de stock y precios al pulsar &apos;Aplicar Cambios&apos;.
                </p>
              </div>

              {/* Account Management & Disconnect / Logout buttons */}
              <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
                <span className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Gestión de Sesión y Cuenta
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenVendorLogin();
                    }}
                    className="py-2.5 px-3 bg-[#FFF7ED] hover:bg-[#FFEDD5] border border-[#FED7AA] text-[#C2410C] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center"
                  >
                    <span>Desconectar / Cambiar Tienda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="py-2.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-center"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Salir de la cuenta</span>
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
                  <span>Guardar Webhook</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
