import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import cn from '../../lib/cn';

export default function Dropdown({
  trigger,
  items = [],
  align = 'right',
  triggerClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const espacioAbajo = window.innerHeight - rect.bottom;
        const espacioArriba = rect.top;
        // Abrir hacia arriba solo cuando falte espacio abajo y arriba haya más.
        setOpenUp(espacioAbajo < 220 && espacioArriba > espacioAbajo);
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={ref}>
      {trigger ? (
        <div onClick={handleToggle}>{trigger}</div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-sena-ink',
            triggerClassName
          )}
          aria-label="Más opciones"
          aria-expanded={open}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div
          ref={menuRef}
          className={cn(
            'absolute z-30 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-overlay animate-scale-in',
            openUp ? 'bottom-full mb-1.5' : 'mt-1.5',
            align === 'right' ? 'right-0' : 'left-0',
            'max-h-[60vh] overflow-y-auto scrollbar-thin'
          )}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 border-t border-slate-100" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                disabled={item.disabled}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-sena-ink hover:bg-sena-tint-50'
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}