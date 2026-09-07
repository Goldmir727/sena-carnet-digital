import { Construction, Hammer } from 'lucide-react';
import Badge from '../components/ui/Badge';

export default function ModulePlaceholder({ title }) {
  return (
    <div className="mx-auto max-w-5xl">
      <Badge variant="yellow" icon={Hammer} className="mb-6">
        Módulo en construcción
      </Badge>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 py-24 text-center">
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-sena-tint-100 opacity-60 blur-lg" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-sena-tint-100 text-sena-green">
            <Construction className="h-8 w-8" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="mt-6 text-xl font-bold tracking-tight text-sena-ink">{title}</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
          Este módulo lo implementa la Persona 2 con el mismo lenguaje visual de la plataforma
          de identidad digital.
        </p>
      </div>
    </div>
  );
}