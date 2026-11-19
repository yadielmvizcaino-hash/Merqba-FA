import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  RefreshCw,
  Edit2,
  SlidersHorizontal,
  Layers,
  Send,
  Check,
} from 'lucide-react';

export interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  hasProducts: boolean;
}

interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  tip?: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresProducts?: boolean;
}

const ALL_TOUR_STEPS: TourStep[] = [
  {
    id: 'sync',
    target: '[data-tour="sync-btn"]',
    title: 'Sincroniza tu catálogo',
    description:
      'Pulsa «Sincronizar» en cualquier momento para descargar los productos más recientes y mantener tu lista al día con tu tienda.',
    tip: 'Cada vez que inicies sesión, tu inventario se carga automáticamente.',
    icon: RefreshCw,
  },
  {
    id: 'quick-edit',
    target: '[data-tour="first-product-info"]',
    title: 'Edita nombre, precio y foto al toque',
    description:
      'Haz clic directamente sobre el título, el precio o la imagen de un producto para modificarlos al instante, o pulsa «Detalles» para editar todo en una vista.',
    tip: 'Incluso puedes pulsar «Todos a $...» para seleccionar productos con el mismo precio.',
    icon: Edit2,
    requiresProducts: true,
  },
  {
    id: 'stock',
    target: '[data-tour="first-product-stock"]',
    title: 'Controla tu inventario en segundos',
    description:
      'Usa los botones − y + para sumar o restar unidades, toca el número para escribir la cantidad exacta o usa el interruptor para cambiar entre En Stock y Agotado.',
    icon: SlidersHorizontal,
    requiresProducts: true,
  },
  {
    id: 'bulk-create',
    target: '[data-tour="bulk-create-bar"]',
    title: 'Edición en masa y nuevos productos',
    description:
      'Marca varios productos (o «Seleccionar todos») para ajustar precios o stock en lote de una sola vez, o pulsa «Añadir Producto» para publicar un artículo nuevo.',
    icon: Layers,
  },
  {
    id: 'apply-save',
    target: '[data-tour="apply-changes-btn"]',
    title: 'Aplica y guarda tus cambios',
    description:
      'Cuando tengas modificaciones pendientes, pulsa «Aplicar Cambios» para guardarlas en tu tienda. Además, en el ícono de engranaje puedes configurar tu tasa USD/CUP.',
    icon: Send,
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const findVisibleTarget = (selector: string): HTMLElement | null => {
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  for (const node of Array.from(nodes)) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return node;
    }
  }
  return null;
};

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  onClose,
  hasProducts,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipSize, setTooltipSize] = useState<{ width: number; height: number }>({
    width: 330,
    height: 230,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => {
    return ALL_TOUR_STEPS.filter((step) => {
      if (step.requiresProducts && !hasProducts) return false;
      return true;
    });
  }, [hasProducts]);

  const currentStep = steps[stepIndex] || steps[0];

  // Reset step to 0 whenever the tour opens
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  // Measure target element position
  const updateTargetRect = useCallback(
    (shouldScroll = false) => {
      if (!isOpen || !currentStep) return;

      const el = findVisibleTarget(currentStep.target);
      if (!el) {
        setTargetRect(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      if (
        shouldScroll &&
        (rect.top < 80 || rect.bottom > window.innerHeight - 80)
      ) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const pad = 6;
      setTargetRect({
        top: Math.max(4, rect.top - pad),
        left: Math.max(4, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    },
    [isOpen, currentStep]
  );

  // Recalculate on step change + after smooth scroll settles
  useEffect(() => {
    if (!isOpen) return;

    updateTargetRect(true);
    const t1 = setTimeout(() => updateTargetRect(false), 180);
    const t2 = setTimeout(() => updateTargetRect(false), 420);

    const handleReposition = () => updateTargetRect(false);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, stepIndex, updateTargetRect]);

  // Measure rendered tooltip card size for smart viewport clamping
  useEffect(() => {
    if (!isOpen || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setTooltipSize({ width: rect.width, height: rect.height });
    }
  }, [isOpen, stepIndex, targetRect]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (stepIndex < steps.length - 1) {
          setStepIndex((i) => i + 1);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (stepIndex > 0) {
          setStepIndex((i) => i - 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, stepIndex, steps.length, onClose]);

  if (!isOpen || !currentStep) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const StepIcon = currentStep.icon;

  // Compute safe tooltip coordinates inside viewport
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const cardWidth = Math.min(340, viewportW - 24);
  const gap = 14;

  let tooltipStyle: React.CSSProperties;
  let arrowDirection: 'top' | 'bottom' | 'none' = 'none';
  let arrowLeft = cardWidth / 2;

  if (targetRect) {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const clampedLeft = Math.max(
      12,
      Math.min(viewportW - cardWidth - 12, targetCenterX - cardWidth / 2)
    );
    arrowLeft = Math.max(24, Math.min(cardWidth - 24, targetCenterX - clampedLeft));

    const spaceBelow = viewportH - (targetRect.top + targetRect.height) - gap;
    const spaceAbove = targetRect.top - gap;

    let topPos: number;
    if (spaceBelow >= tooltipSize.height + 12 || spaceBelow >= spaceAbove) {
      topPos = Math.min(
        viewportH - tooltipSize.height - 12,
        targetRect.top + targetRect.height + gap
      );
      arrowDirection = 'top';
    } else {
      topPos = Math.max(12, targetRect.top - tooltipSize.height - gap);
      arrowDirection = 'bottom';
    }

    tooltipStyle = {
      width: `${cardWidth}px`,
      top: `${Math.max(12, topPos)}px`,
      left: `${clampedLeft}px`,
    };
  } else {
    // Fallback centered card if target is temporarily unavailable
    tooltipStyle = {
      width: `${cardWidth}px`,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return (
    <div
      className="fixed inset-0 z-[70] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente de inicio rápido"
    >
      {/* Dimmed backdrop (clickable to close) */}
      {!targetRect && (
        <div
          className="fixed inset-0 bg-[#0B0E14]/75 backdrop-blur-[1px] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Spotlight cutout highlighting the active control */}
      {targetRect && (
        <>
          <div
            className="fixed inset-0 bg-transparent"
            onClick={onClose}
          />
          <div
            className="fixed rounded-xl border-2 border-[#FF5A00] pointer-events-none transition-all duration-300 ease-out"
            style={{
              top: `${targetRect.top}px`,
              left: `${targetRect.left}px`,
              width: `${targetRect.width}px`,
              height: `${targetRect.height}px`,
              boxShadow: '0 0 0 9999px rgba(11, 14, 20, 0.72), 0 0 0 4px rgba(255, 90, 0, 0.28)',
            }}
          />
        </>
      )}

      {/* Floating Tooltip Card */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="fixed z-[75] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden transition-all duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top pointer arrow when placed below target */}
        {arrowDirection === 'top' && (
          <div
            className="absolute -top-2 w-4 h-4 bg-[#0B0E14] rotate-45 border-l border-t border-[#1E2530]"
            style={{ left: `${arrowLeft - 8}px` }}
          />
        )}

        {/* Header Strip */}
        <div className="px-4 py-3 bg-[#0B0E14] text-white flex items-center justify-between border-b border-[#1E2530]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF5A00] to-[#FFA000] flex items-center justify-center shrink-0 shadow-xs">
              <StepIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#FFA000] shrink-0" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FFA000]">
                  Guía rápida • Paso {stepIndex + 1} de {steps.length}
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#94A3B8] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Cerrar guía"
            aria-label="Cerrar guía"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2.5">
          <p className="text-xs sm:text-[13px] text-[#334155] leading-relaxed">
            {currentStep.description}
          </p>

          {currentStep.tip && (
            <div className="px-3 py-2 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl text-[11px] text-[#9A3412] font-medium leading-snug">
              <strong className="font-bold text-[#C2410C]">Consejo: </strong>
              {currentStep.tip}
            </div>
          )}

          {/* Step Dots + Navigation */}
          <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {steps.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStepIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === stepIndex
                      ? 'w-5 bg-[#FF5A00]'
                      : idx < stepIndex
                      ? 'w-2 bg-[#FDBA74]'
                      : 'w-1.5 bg-[#CBD5E1]'
                  }`}
                  title={`Ir al paso ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {!isFirst ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer flex items-center gap-0.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer"
                >
                  Omitir
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isLast) {
                    onClose();
                  } else {
                    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
                  }
                }}
                className="px-3.5 py-1.5 bg-gradient-to-r from-[#FF5A00] to-[#FFA000] hover:from-[#E64C00] hover:to-[#E68A00] text-white text-[11px] font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                {isLast ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>¡Entendido!</span>
                  </>
                ) : (
                  <>
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom pointer arrow when placed above target */}
        {arrowDirection === 'bottom' && (
          <div
            className="absolute -bottom-2 w-4 h-4 bg-white rotate-45 border-r border-b border-[#E2E8F0]"
            style={{ left: `${arrowLeft - 8}px` }}
          />
        )}
      </div>
    </div>
  );
};
