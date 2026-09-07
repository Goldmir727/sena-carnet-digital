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
  const ref = useRef(null);

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

  return (
    <div className="relative" ref={ref}>
      {trigger ? (
        <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      ) : (
        <button
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-sena-ink',
            triggerClassName
          )}
          aria-label="Más opciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1.5 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-overlay animate-scale-in',
            align === 'right' ? 'right-0' : 'left-0'
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