import { Construction } from 'lucide-react';

export default function ModulePlaceholder({ title }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sena-green-light">
        <Construction className="h-7 w-7 text-sena-green" />
      </div>
      <h2 className="text-xl font-semibold text-sena-ink">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Módulo en construcción — lo desarrolla la Persona 2.
      </p>
    </div>
  );
}
