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
                Filtro por vendedor: solo verás y gestionarás tus productos
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
          {!isCustomMode ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Selecciona tu Tienda
                </span>
                <button
                  onClick={() => setIsCustomMode(true)}
                  className="text-xs text-[#EA580C] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
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
                  onClick={() => setIsCustomMode(false)}
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
