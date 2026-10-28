import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Store,
  LogIn,
  CheckCircle2,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Sparkles,
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

  // Selected vendor when prompting for password
  const [selectedVendor, setSelectedVendor] = useState<DokanVendor | null>(null);

  // Mode: 'pick-store' | 'verify-store' | 'custom-credentials'
  const [mode, setMode] = useState<'pick-store' | 'verify-store' | 'custom-credentials'>('pick-store');

  // Credentials fields
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCustomizingUser, setIsCustomizingUser] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // When clicking a store from the list: open password prompt for that store
  const handleChooseStore = (vendor: DokanVendor) => {
    setSelectedVendor(vendor);
    setAuthUsername(vendor.email || vendor.name.toLowerCase().replace(/\s+/g, ''));
    setAuthPassword('');
    setLoginError(null);
    setIsCustomizingUser(false);
    setShowPassword(false);
    setMode('verify-store');
  };

  // Submit Password Verification to /api/woocommerce/login
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const targetUser = authUsername.trim() || selectedVendor?.email || '';
    const targetPass = authPassword.trim();

    if (!targetUser) {
      setLoginError('Por favor ingresa tu usuario o correo electrónico de Merqba.');
      return;
    }

    if (!targetPass) {
      setLoginError('Por favor ingresa la contraseña de Merqba de esta tienda.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/woocommerce/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUser,
          password: targetPass,
          vendorId: selectedVendor?.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.vendor) {
        const verifiedVendor: DokanVendor = {
          ...data.vendor,
          // Preserve any extra local details if selectedVendor was present
          ...(selectedVendor ? {
            storeName: selectedVendor.storeName,
            avatar: selectedVendor.avatar || data.vendor.avatar,
            id: selectedVendor.id,
          } : {}),
        };

        // Ensure vendor exists in vendor list
        const exists = vendors.some((v) => v.id === verifiedVendor.id);
        if (!exists) {
          onAddCustomVendor(verifiedVendor);
        }

        onSelectVendor(verifiedVendor);
        if (onShowToast) {
          onShowToast(
            'success',
            'Acceso Concedido',
            `Contraseña verificada con éxito. Bienvenido a ${verifiedVendor.storeName}.`
          );
        }
        onClose();
      } else {
        setLoginError(
          data.message || 'Contraseña o credenciales incorrectas. Verifica tus datos de acceso en Merqba.'
        );
      }
    } catch (err: any) {
      console.error('Merqba login verification error:', err);
      setLoginError('No se pudo comunicar con el servidor de Merqba. Revisa tu conexión a internet.');
    } finally {
      setIsLoggingIn(false);
    }
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
                <span>Acceso a Tiendas</span>
                <span className="text-[10px] font-extrabold uppercase bg-gradient-to-r from-[#FF5A00] to-[#FFA000] text-black px-1.5 py-0.2 rounded">
                  FA
                </span>
              </h2>
              <p className="text-[11px] text-[#FFA000]">
                {mode === 'verify-store' && selectedVendor
                  ? `Verificando ${selectedVendor.storeName}`
                  : 'Ingresa con la contraseña de Merqba de cada tienda'}
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* VIEW 1: Store List with Password Requirement Notice */}
          {mode === 'pick-store' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl text-xs text-[#EA580C] flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#FF5A00] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#9A3412]">Seguridad por Perfil de Tienda</p>
                  <p className="text-[11px] text-[#C2410C] mt-0.5 leading-relaxed">
                    Elige la tienda a la que deseas acceder. Para proteger tus datos, deberás ingresar la contraseña de Merqba vinculada a ese perfil.
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block mb-2">
                  Tiendas Disponibles ({vendors.length})
                </span>

                <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2.5">
                  {vendors.map((vendor) => {
                    const isCurrent = vendor.id === currentVendor.id;
                    const vendorProductsCount = products.filter((p) => p.vendorId === vendor.id).length;

                    return (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => handleChooseStore(vendor)}
                        className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 group relative ${
                          isCurrent
                            ? 'border-[#FF5A00] bg-[#FFF7ED]/60 ring-2 ring-[#FF5A00]/25 shadow-xs'
                            : 'border-[#E2E8F0] hover:border-[#FF5A00] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <img
                          src={vendor.avatar}
                          alt={vendor.storeName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-xs sm:text-sm text-[#0F172A] truncate group-hover:text-[#FF5A00] transition-colors">
                              {vendor.storeName}
                            </h3>
                            <span className="text-[10px] font-bold bg-[#0B0E14] text-[#FFA000] border border-[#FF5A00]/40 px-1.5 py-0.5 rounded shrink-0">
                              ID #{vendor.id}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#475569] truncate">
                            {vendor.name} • {vendor.email}
                          </p>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[#EA580C] font-semibold">
                              {vendorProductsCount} productos en catálogo
                            </span>
                            <span className="text-[10px] text-[#64748B] flex items-center gap-1 bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                              <Lock className="w-2.5 h-2.5 text-[#EA580C]" /> Requiere clave
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-[#94A3B8] group-hover:text-[#FF5A00] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Other login option */}
              <div className="pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVendor(null);
                    setAuthUsername('');
                    setAuthPassword('');
                    setLoginError(null);
                    setMode('custom-credentials');
                  }}
                  className="w-full py-2.5 px-3 border border-dashed border-[#CBD5E1] hover:border-[#FF5A00] rounded-xl text-xs font-semibold text-[#475569] hover:text-[#EA580C] hover:bg-[#FFF7ED]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-[#FF5A00]" />
                  <span>Ingresar con otra cuenta o correo de Merqba</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: Verify Password for the Selected Store */}
          {mode === 'verify-store' && selectedVendor && (
            <form onSubmit={handleVerifyPassword} className="space-y-4">
              {/* Back to store list button */}
              <button
                type="button"
                onClick={() => {
                  setLoginError(null);
                  setMode('pick-store');
                }}
                className="text-xs font-semibold text-[#475569] hover:text-[#0F172A] flex items-center gap-1.5 cursor-pointer py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la lista de tiendas</span>
              </button>

              {/* Selected Profile Banner */}
              <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl flex items-center gap-3">
                <img
                  src={selectedVendor.avatar}
                  alt={selectedVendor.storeName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-[#FF5A00] uppercase tracking-wider">
                      Perfil Seleccionado
                    </span>
                    <span className="text-[10px] bg-[#0B0E14] text-[#FFA000] px-1.5 py-0.2 rounded font-bold">
                      ID #{selectedVendor.id}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#0F172A] truncate">
                    {selectedVendor.storeName}
                  </h3>
                  <p className="text-[11px] text-[#475569] truncate">
                    {selectedVendor.name} • {authUsername || selectedVendor.email}
                  </p>
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">
                    <strong className="block font-bold">Error de Acceso:</strong>
                    <span>{loginError}</span>
                  </div>
                </div>
              )}

              {/* Optional: Customize Username/Email if WordPress username differs */}
              {isCustomizingUser ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Usuario o Correo de Merqba
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthUsername(selectedVendor.email);
                        setIsCustomizingUser(false);
                      }}
                      className="text-[11px] text-[#64748B] hover:text-[#0F172A] underline cursor-pointer"
                    >
                      Restablecer correo predeterminado
                    </button>
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <input
                      type="text"
                      required
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="Usuario o correo en Merqba"
                      className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-[#64748B] px-1">
                  <span>Accediendo como: <strong>{authUsername || selectedVendor.email}</strong></span>
                  <button
                    type="button"
                    onClick={() => setIsCustomizingUser(true)}
                    className="text-[#EA580C] font-semibold hover:underline cursor-pointer"
                  >
                    ¿Cambiar usuario?
                  </button>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Contraseña de Merqba <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 font-mono"
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
                <p className="text-[11px] text-[#64748B] mt-1.5">
                  Ingresa exactamente la misma contraseña que usas para iniciar sesión en <strong>https://merqba.com</strong>.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verificando con Merqba...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Acceder a {selectedVendor.storeName}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMode('pick-store')}
                  className="w-full py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                >
                  Cancelar y elegir otra tienda
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: Custom Merqba Credentials Entry */}
          {mode === 'custom-credentials' && (
            <form onSubmit={handleVerifyPassword} className="space-y-3.5">
              <button
                type="button"
                onClick={() => {
                  setLoginError(null);
                  setMode('pick-store');
                }}
                className="text-xs font-semibold text-[#475569] hover:text-[#0F172A] flex items-center gap-1.5 cursor-pointer py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la lista de tiendas</span>
              </button>

              <div className="p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl text-xs text-[#EA580C] space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#FF5A00]" />
                  <span>Acceso con Cuenta Directa de Merqba</span>
                </div>
                <p className="text-[11px] text-[#C2410C]">
                  Ingresa tu usuario (o correo) y la contraseña con la que accedes a <strong>https://merqba.com</strong>.
                </p>
              </div>

              {loginError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">
                    <strong className="block font-bold">Error de Acceso:</strong>
                    <span>{loginError}</span>
                  </div>
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
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder="Ej. vendedor@merqba.com o tu_usuario"
                    className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password with Eye Toggle */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Contraseña de Merqba <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
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
                      <span>Verificando con Merqba...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Verificar e Ingresar con Merqba</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Security footnote */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-[11px] text-[#475569] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#0F172A]">Aislamiento de Perfiles:</strong> Cada tienda requiere su propia contraseña de acceso en Merqba para garantizar que sólo el titular pueda modificar sus productos.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
