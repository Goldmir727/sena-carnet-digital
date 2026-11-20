import { ArrowLeft, Compass } from 'lucide-react';
import Logo from '../components/ui/Logo';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-sena-bg px-4 text-center">
      <div className="absolute left-1/2 top-10 -translate-x-1/2 opacity-80">
        <Logo size="md" />
      </div>

      <div className="relative animate-fade-up">
        <div className="absolute -inset-10 rounded-full bg-sena-tint-100/60 blur-3xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-sena-green shadow-raised">
          <Compass className="h-10 w-10" strokeWidth={1.5} />
        </div>
      </div>

      <p className="mt-8 text-7xl font-extrabold tracking-tight text-sena-gradient">404</p>
      <h1 className="mt-2 text-xl font-bold text-sena-ink">Página no encontrada</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        La ruta que buscas no existe o fue movida. Vuelve a la presentación para continuar.
      </p>

      <a href="/" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sena-green px-5 py-3 font-semibold text-white hover:bg-sena-green-dark">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver al inicio
      </a>
    </main>
  );
}
