import React, { useState } from 'react';
import { X, UserCheck, ShieldCheck, Store, LogIn, PlusCircle, CheckCircle2 } from 'lucide-react';
import { DokanVendor, Product } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVendor: DokanVendor;
  vendors: DokanVendor[];
  products: Product[];
  onSelectVendor: (vendor: DokanVendor) => void;
  onAddCustomVendor: (newVendor: DokanVendor) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentVendor,
  vendors,
  products,
  onSelectVendor,
  onAddCustomVendor,
}) => {
  if (!isOpen) return null;

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customStoreName, setCustomStoreName] = useState('');
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customId, setCustomId] = useState('48');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStoreName.trim()) return;

    const newVendor: DokanVendor = {
      id: parseInt(customId, 10) || Math.floor(Math.random() * 900) + 100,
      name: customName.trim() || 'Nuevo Vendedor',
      storeName: customStoreName.trim(),
      email: customEmail.trim() || 'vendedor@marketplace.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80',
      rating: 5.0,
      ratingCount: 1,
      storeUrl: `https://merqba.com/store/${customStoreName.toLowerCase().replace(/\s+/g, '-')}`,
      phone: '+34 600 000 000',
      address: 'Madrid, España',
    };

    onAddCustomVendor(newVendor);
    onSelectVendor(newVendor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#43167C] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#5B3294] rounded-lg">
              <Store className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">Iniciar Sesión en Merqba FA</h2>
              <p className="text-[11px] text-purple-200">
                Filtro por vendedor: solo verás y gestionarás tus productos
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {!isCustomMode ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Selecciona tu Tienda
                </span>
                <button
                  onClick={() => setIsCustomMode(true)}
                  className="text-xs text-[#5B3294] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Otro Vendedor</span>
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
                          ? 'border-[#5B3294] bg-[#FAF8FF] ring-2 ring-[#5B3294]/20 shadow-xs'
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
                          <span className="text-[10px] font-bold bg-[#EAEDFF] text-[#43167C] px-1.5 py-0.5 rounded">
                            ID: #{vendor.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#475569] truncate">
                          {vendor.name} • {vendor.email}
                        </p>
                        <p className="text-[10px] text-[#5B3294] font-medium mt-0.5">
                          {vendorProductsCount} productos en catálogo
                        </p>
                      </div>

                      {isCurrent && (
                        <CheckCircle2 className="w-5 h-5 text-[#5B3294] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A]">
                  Ingresar Nuevo Vendedor
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className="text-xs text-[#5B3294] hover:underline cursor-pointer"
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
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#5B3294]"
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
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#5B3294]"
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
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#5B3294]"
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
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#5B3294]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className="px-3 py-1.5 border border-[#CBD5E1] text-[#475569] text-xs font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5B3294] text-white text-xs font-bold rounded-lg hover:bg-[#43167C] flex items-center gap-1.5 cursor-pointer"
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
