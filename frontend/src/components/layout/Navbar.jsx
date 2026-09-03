import { Menu } from 'lucide-react';

export default function Navbar({ onOpenSidebar }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-8">
      <button onClick={onOpenSidebar} className="text-sena-ink md:hidden">
        <Menu className="h-6 w-6" />
      </button>
      <div>
        <h1 className="text-base font-bold text-sena-ink">Sistema de Gestión de Carnets</h1>
        <p className="text-xs text-slate-500">Servicio Nacional de Aprendizaje</p>
      </div>
    </header>
  );
}
