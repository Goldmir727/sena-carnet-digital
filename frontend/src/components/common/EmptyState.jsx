import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Sin resultados', message }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <Inbox className="mb-3 h-10 w-10 text-slate-300" />
      <p className="text-base font-semibold text-sena-ink">{title}</p>
      {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
    </div>
  );
}
