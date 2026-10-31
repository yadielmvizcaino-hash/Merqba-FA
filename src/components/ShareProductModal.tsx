import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  ExternalLink,
  MessageCircle,
  Smartphone,
  FileText,
} from 'lucide-react';
import { Product, StoreConfig } from '../types';

interface ShareProductModalProps {
  product: Product | null;
  config: StoreConfig;
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const ShareProductModal: React.FC<ShareProductModalProps> = ({
  product,
  config,
  isOpen,
  onClose,
  onShowToast,
}) => {
  if (!isOpen || !product) return null;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Generate realistic clean product URL matching WooCommerce canonical URL
  const productSlug =
    product.slug ||
    product.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const productUrl =
    product.permalink && product.permalink.startsWith('http')
      ? product.permalink.replace(/\/+$/, '')
      : `${config.storeUrl.replace(/\/+$/, '')}/producto/${productSlug}`;
  const priceDisplay = `${config.currencySymbol}${product.price.toFixed(2)}`;
  const isAvailable = product.stockStatus === 'instock' && product.stockQuantity > 0;
  const stockText = isAvailable ? `✅ Disponible (${product.stockQuantity} unidades)` : '⚠️ Agotado temporalmente';

  // Formatted sales pitch text for social chats and status updates
  const salesSheetText = `🛍️ *${product.name}*\n💰 *Precio:* ${priceDisplay}\n📦 *Estado:* ${stockText}\n🔖 *SKU:* ${product.sku}\n\n👉 *Consíguelo aquí:* ${productUrl}`;

  // 1. WhatsApp share
  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(salesSheetText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onShowToast('success', 'Abriendo WhatsApp', 'Preparando mensaje con la ficha del producto.');
  };

  // 2. Telegram share
  const handleShareTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(`🛍️ ${product.name} a solo ${priceDisplay}`)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
    onShowToast('success', 'Abriendo Telegram', 'Compartiendo producto en Telegram.');
  };

  // 3. Facebook share
  const handleShareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer');
  };

  // 4. X (Twitter) share
  const handleShareTwitter = () => {
    const tweetText = `¡Descubre "${product.name}" por ${priceDisplay} en Merqba FA! 🚀`;
    const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(productUrl)}`;
    window.open(twUrl, '_blank', 'noopener,noreferrer');
  };

  // 5. Native Mobile Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `🛍️ ${product.name} - ${priceDisplay}. ¡Disponible ahora!`,
          url: productUrl,
        });
        onShowToast('success', 'Compartido', 'Producto compartido exitosamente.');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // 6. Copy link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(productUrl);
    setCopiedLink(true);
    onShowToast('success', 'Enlace Copiado', 'Enlace directo copiado al portapapeles.');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 7. Copy sales pitch text
  const handleCopySalesSheet = () => {
    navigator.clipboard.writeText(salesSheetText);
    setCopiedText(true);
    onShowToast('success', 'Ficha Copiada', 'Texto de venta copiado listo para pegar en chats y estados.');
    setTimeout(() => setCopiedText(false), 2000);
  };

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-[#FF5A00] to-[#FFA000] rounded-xl text-black shadow-xs">
              <Share2 className="w-4 h-4 text-white stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Compartir Producto</h2>
              <p className="text-[11px] text-[#FFA000]">
                Difunde tu producto en redes sociales y chats de venta
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
          {/* Product Mini Preview Card */}
          <div className="flex items-center gap-3 p-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-16 h-16 rounded-lg object-cover border border-[#E2E8F0] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-xs sm:text-sm text-[#0F172A] line-clamp-2 leading-tight">
                {product.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-extrabold text-[#EA580C] tabular-nums">
                  {priceDisplay}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isAvailable ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF2F2] text-[#991B1B]'
                  }`}
                >
                  {isAvailable ? `${product.stockQuantity} en stock` : 'Agotado'}
                </span>
              </div>
            </div>
          </div>

          {/* Native Mobile Share Button (if supported on device) */}
          {hasNativeShare && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Smartphone className="w-4 h-4 text-white" />
              <span>Compartir en Aplicaciones del Dispositivo</span>
            </button>
          )}

          {/* Social Networks 1-Tap Grid */}
          <div>
            <span className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
              Redes Sociales & Mensajería
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {/* WhatsApp */}
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-[#A7F3D0] bg-[#F0FDF4] hover:bg-[#DCFCE7] active:bg-[#BBF7D0] transition-colors cursor-pointer text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MessageCircle className="w-4 h-4 fill-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#14532D]">WhatsApp</div>
                  <div className="text-[10px] text-[#166534] truncate">Chat o Estado</div>
                </div>
              </button>

              {/* Telegram */}
              <button
                onClick={handleShareTelegram}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E0F2FE] active:bg-[#BAE6FD] transition-colors cursor-pointer text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-[#229ED9] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Send className="w-4 h-4 fill-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0369A1]">Telegram</div>
                  <div className="text-[10px] text-[#0284C7] truncate">Canal o Grupo</div>
                </div>
              </button>

              {/* Facebook */}
              <button
                onClick={handleShareFacebook}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] active:bg-[#BFDBFE] transition-colors cursor-pointer text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                  f
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#1E3A8A]">Facebook</div>
                  <div className="text-[10px] text-[#1D4ED8] truncate">Feed o Grupos</div>
                </div>
              </button>

              {/* X (Twitter) */}
              <button
                onClick={handleShareTwitter}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] active:bg-[#E2E8F0] transition-colors cursor-pointer text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  𝕏
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0F172A]">X (Twitter)</div>
                  <div className="text-[10px] text-[#475569] truncate">Publicación</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Copy Section */}
          <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
            <span className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Opciones de Copiado Rápido
            </span>

            {/* Copy Sales Pitch */}
            <button
              onClick={handleCopySalesSheet}
              className="w-full p-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#FF5A00] bg-[#F8FAFC] hover:bg-[#FFF7ED] transition-all cursor-pointer flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">
                    Copiar Ficha Completa de Venta
                  </div>
                  <div className="text-[10px] text-[#64748B]">
                    Incluye título, precio, stock y enlace formateado
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-xs font-semibold text-[#EA580C] flex items-center gap-1">
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-[#10B981]">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </div>
            </button>

            {/* Direct Product URL Copy */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={productUrl}
                className="flex-1 px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-mono text-[#0F172A] truncate select-all focus:outline-none focus:border-[#FF5A00]"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-gradient-to-r from-[#FF5A00] to-[#FF8C00] hover:from-[#E64C00] hover:to-[#E67E00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copiado' : 'Enlace'}</span>
              </button>
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-[#CBD5E1] hover:border-[#FF5A00] text-[#475569] hover:text-[#EA580C] hover:bg-[#FFF7ED] rounded-lg transition-colors cursor-pointer shrink-0"
                title="Abrir enlace en la tienda"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
