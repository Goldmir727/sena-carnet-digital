import Logo from '../ui/Logo';

export default function PublicLayout({ children }) {
  return (
    <div className="public-site min-h-screen bg-white text-sena-ink">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">
        Saltar al contenido
      </a>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="CarnetiSENA, inicio">
            <Logo />
            <span className="text-lg font-bold tracking-tight">CarnetiSENA</span>
          </a>
          <nav aria-label="Navegación pública" className="flex items-center gap-5 text-sm font-semibold sm:gap-8">
            <a href="/guia" className="hidden text-ink-soft hover:text-sena-green sm:inline">Guía de uso</a>
            <a href="/login" className="rounded-lg bg-sena-green px-4 py-2.5 text-white hover:bg-sena-green-dark">
              Iniciar sesión
            </a>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20" tabIndex={-1}>
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-surface-muted">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-8 text-sm text-ink-soft sm:grid-cols-[1fr_auto] sm:px-8">
          <div className="max-w-xl">
            <p className="font-semibold text-sena-ink">CarnetiSENA · Proyecto formativo</p>
            <p className="mt-2 leading-relaxed">
              Plataforma de carnet digital y asistencia para la comunidad SENA.
              Este sitio no sustituye los canales oficiales del Servicio Nacional de Aprendizaje.
            </p>
          </div>
          <nav aria-label="Enlaces de ayuda" className="flex flex-wrap content-start gap-x-6 gap-y-3">
            <a href="/guia" className="underline underline-offset-4">Guía de uso</a>
            <a href="https://www.sena.edu.co/" rel="noopener noreferrer" className="underline underline-offset-4">
              Sitio oficial del SENA
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
