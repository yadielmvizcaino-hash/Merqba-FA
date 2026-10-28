import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Store,
  LogIn,
  PlusCircle,
  CheckCircle2,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { DokanVendor, Product } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVendor: DokanVendor;
  vendors: DokanVendor[];
  products: Product[];
  onSelectVendor: (vendor: DokanVendor) => void;
  onAddCustomVendor: (newVendor: DokanVendor) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentVendor,
  vendors,
  products,
  onSelectVendor,
  onAddCustomVendor,
  onShowToast,
}) => {
  if (!isOpen) return null;

  // Active view tab: 'woocommerce' (default) | 'saved' | 'custom'
  const [activeTab, setActiveTab] = useState<'woocommerce' | 'saved' | 'custom'>('woocommerce');

  // WooCommerce Credentials form states
  const [wcUsername, setWcUsername] = useState('');
  const [wcPassword, setWcPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Manual custom vendor form states
  const [customStoreName, setCustomStoreName] = useState('');
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customId, setCustomId] = useState('48');

  // Handle Login with WooCommerce Username & Password
  const handleWcLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!wcUsername.trim() || !wcPassword.trim()) {
      setLoginError('Por favor introduce tu usuario o correo y contraseña.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/woocommerce/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: wcUsername.trim(),
          password: wcPassword.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.vendor) {
        const vendor: DokanVendor = data.vendor;

        // Check if vendor already exists in list or add them
        const exists = vendors.some((v) => v.id === vendor.id);
        if (!exists) {
          onAddCustomVendor(vendor);
        }

        onSelectVendor(vendor);
        if (onShowToast) {
          onShowToast('success', 'Sesión Iniciada', `Bienvenido a Merqba FA, ${vendor.storeName}.`);
        }
        onClose();
      } else {
        setLoginError(data.message || 'Credenciales inválidas en WooCommerce. Verifica tu usuario y contraseña.');
      }
    } catch (err: any) {
      console.error('WooCommerce login error:', err);
      setLoginError('No se pudo contactar con la tienda WooCommerce. Revisa tu conexión.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Manual Custom Vendor submit
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStoreName.trim()) return;

    const newVendor: DokanVendor = {
      id: parseInt(customId, 10) || Math.floor(Math.random() * 900) + 100,
      name: customName.trim() || 'Nuevo Vendedor',
      storeName: customStoreName.trim(),
      email: customEmail.trim() || 'vendedor@merqba.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      banner: '',
      rating: 5.0,
      ratingCount: 1,
      storeUrl: `https://merqba.com/store/${customStoreName.toLowerCase().replace(/\s+/g, '-')}`,
      phone: '',
      address: '',
    };

    onAddCustomVendor(newVendor);
    onSelectVendor(newVendor);
    if (onShowToast) {
      onShowToast('success', 'Vendedor Añadido', `Ingresando como ${newVendor.storeName}.`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530]">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/logotipo_merqba_8e430d75.png"
              alt="Merqba"
              className="h-8 object-contain"
            />
            <div className="border-l border-white/20 pl-2.5">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>Acceso Vendedor</span>
                <span className="text-[10px] font-extrabold uppercase bg-gradient-to-r from-[#FF5A00] to-[#FFA000] text-black px-1.5 py-0.2 rounded">
                  FA
                </span>
              </h2>
              <p className="text-[11px] text-[#FFA000]">
                Ingresa con tu usuario y contraseña de WooCommerce
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
        <div className="flex items-center border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('woocommerce');
              setLoginError(null);
            }}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'woocommerce'
                ? 'border-[#FF5A00] text-[#FF5A00]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Login WooCommerce</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'saved'
                ? 'border-[#FF5A00] text-[#FF5A00]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Cuentas Guardadas ({vendors.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: Real WooCommerce Username & Password Login */}
          {activeTab === 'woocommerce' && (
            <form onSubmit={handleWcLogin} className="space-y-3.5">
              <div className="p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl text-xs text-[#EA580C] space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#FF5A00]" />
                  <span>Acceso Directo con tu Cuenta de la Tienda</span>
                </div>
                <p className="text-[11px] text-[#C2410C]">
                  Utiliza exactamente el mismo usuario (o correo) y la contraseña con la que accedes al panel de vendedor de WooCommerce en <strong>https://merqba.com</strong>.
                </p>
              </div>

              {loginError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Username or Email */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Usuario o Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input
                    type="text"
                    required
                    value={wcUsername}
                    onChange={(e) => setWcUsername(e.target.value)}
                    placeholder="Ej. vendedor@merqba.com o tu_usuario"
                    className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password with Eye Toggle */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Contraseña de WooCommerce <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={wcPassword}
                    onChange={(e) => setWcPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 font-mono"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#475569]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-[#CBD5E1] cursor-pointer"
                  />
                  <span>Recordar sesión en este dispositivo</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verificando con WooCommerce...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Ingresar con WooCommerce</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Quick Saved Accounts */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Selecciona una Tienda
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('custom')}
                  className="text-xs text-[#EA580C] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Añadir Manualmente</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {vendors.map((vendor) => {
                  const isCurrent = vendor.id === currentVendor.id;
                  const vendorProductsCount = products.filter((p) => p.vendorId === vendor.id).length;

                  return (
                    <button
                      key={vendor.id}
                      onClick={() => {
                        onSelectVendor(vendor);
                        onClose();
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                        isCurrent
                          ? 'border-[#FF5A00] bg-[#FFF7ED] ring-2 ring-[#FF5A00]/25 shadow-xs'
                          : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <img
                        src={vendor.avatar}
                        alt={vendor.storeName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-xs sm:text-sm text-[#0F172A] truncate">
                            {vendor.storeName}
                          </h3>
                          <span className="text-[10px] font-bold bg-[#0B0E14] text-[#FFA000] border border-[#FF5A00]/40 px-1.5 py-0.5 rounded">
                            ID: #{vendor.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#475569] truncate">
                          {vendor.name} • {vendor.email}
                        </p>
                        <p className="text-[10px] text-[#EA580C] font-semibold mt-0.5">
                          {vendorProductsCount} productos en catálogo
                        </p>
                      </div>

                      {isCurrent && (
                        <CheckCircle2 className="w-5 h-5 text-[#FF5A00] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Manual Custom Vendor entry */}
          {activeTab === 'custom' && (
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">
                  Ingresar Nuevo Vendedor Manual
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('saved')}
                  className="text-xs text-[#EA580C] hover:underline cursor-pointer"
                >
                  Volver a la lista
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Nombre de la Tienda
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Mi Tienda"
                  value={customStoreName}
                  onChange={(e) => setCustomStoreName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Nombre del Vendedor / Titular
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  placeholder="vendedor@mitienda.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  ID de Vendedor
                </label>
                <input
                  type="number"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00]/30"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('saved')}
                  className="px-3 py-1.5 border border-[#CBD5E1] text-[#475569] text-xs font-semibold rounded-lg hover:bg-[#F8FAFC] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] text-white text-xs font-bold rounded-lg hover:from-[#E64C00] hover:to-[#E68A00] flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar como Vendedor</span>
                </button>
              </div>
            </form>
          )}

          {/* Security info */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-[11px] text-[#475569] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#0F172A]">Aislamiento Multi-Vendedor:</strong> Cada vendedor solo tiene acceso de lectura y escritura a los productos asignados a su ID.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
