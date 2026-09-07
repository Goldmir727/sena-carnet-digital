const FOOTER = {
  tagline: 'Plataforma de identidad digital para la comunidad SENA.',
  version: 'v4.0.0',
  institution: 'Servicio Nacional de Aprendizaje — SENA',
  year: new Date().getFullYear(),
};

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-slate-200/60 bg-canvas pb-28 pt-6 md:pb-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-sena-ink">Carnets SENA</p>
            <p className="mt-0.5 max-w-md text-xs leading-relaxed text-slate-400">{FOOTER.tagline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400">{FOOTER.institution}</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              {FOOTER.version}
            </span>
          </div>
        </div>
        <p className="mt-4 border-t border-slate-200/60 pt-4 text-xs text-slate-400">
          © {FOOTER.year} SENA. Herramienta de práctica educativa.
        </p>
      </div>
    </footer>
  );
}