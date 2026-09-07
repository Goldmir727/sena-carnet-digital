import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Drawer({
  open,
  onClose,
  children,
  side = 'left',
  className = '',
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const sideClass =
    side === 'left' ? 'inset-y-0 left-0 rounded-r-2xl' : 'inset-y-0 right-0 rounded-l-2xl';
  const slideClass = side === 'left' ? 'animate-slide-in-right' : 'animate-fade-up';

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-sena-ink/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute ${sideClass} w-full max-w-xs bg-white shadow-overlay ${slideClass} ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
