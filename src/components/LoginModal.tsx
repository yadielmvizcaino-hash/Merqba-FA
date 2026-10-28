import React, { useState } from 'react';
import {
  X,
  LogIn,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { DokanVendor, Product } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
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
  isAuthenticated = false,
  currentVendor,
  vendors,
  products,
  onSelectVendor,
  onAddCustomVendor,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const [authUsername, setAuthUsername] = useState(currentVendor.email || 'yadielmvizcaino@gmail.com');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const targetUser = authUsername.trim();
    const targetPass = authPassword.trim();

    if (!targetUser) {
      setLoginError('Por favor ingresa tu correo electrónico o usuario de Merqba.');
      return;
    }

    if (!targetPass) {
      setLoginError('Por favor ingresa tu contraseña de Merqba.');
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
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.vendor) {
        const verifiedVendor: DokanVendor = {
          ...data.vendor,
        };

        // Ensure vendor exists in vendor list
        const exists = vendors.some((v) => v.id === verifiedVendor.id);
        if (!exists) {
          onAddCustomVendor(verifiedVendor);
        }

        // Set persistent cookie for 1 year so user doesn't need to log in every time
        document.cookie = `merqba_auth=true; path=/; max-age=31536000`;
        document.cookie = `merqba_vendor_id=${verifiedVendor.id}; path=/; max-age=31536000`;

        onSelectVendor(verifiedVendor);
        if (onShowToast) {
          onShowToast(
            'success',
            'Acceso Concedido',
            `Bienvenido de nuevo a ${verifiedVendor.storeName}.`
          );
        }
        onClose();
      } else {
        setLoginError(
          data.message || 'Contraseña o credenciales incorrectas. Verifica tus datos de acceso en Merqba.'
        );
      }
    } catch (err: any) {
      console.error('Merqba login error:', err);
      setLoginError('No se pudo comunicar con el servidor de Merqba. Revisa tu conexión a internet.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs"
      onClick={() => {
        if (isAuthenticated) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
                <span>Acceso de Usuario</span>
                <span className="text-[10px] font-extrabold uppercase bg-gradient-to-r from-[#FF5A00] to-[#FFA000] text-black px-1.5 py-0.2 rounded">
                  FA
                </span>
              </h2>
              <p className="text-[11px] text-[#FFA000]">
                Ingresa con tu cuenta de Merqba
              </p>
            </div>
          </div>
          {isAuthenticated && (
            <button
              onClick={onClose}
              className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <form onSubmit={handleLogin} className="p-5 space-y-4">
          {loginError && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                <strong className="block font-bold">Error de Autenticación:</strong>
                <span>{loginError}</span>
              </div>
            </div>
          )}

          {/* Username / Email */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Correo Electrónico o Usuario <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                required
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="ejemplo@gmail.com"
                className="w-full pl-9 pr-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
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
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando con Merqba...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
