import Logo from './Logo';
import { ShieldCheck, QrCode, BadgeCheck } from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Acceso protegido',
    desc: 'Verificación en dos pasos para proteger tu identidad.',
  },
  {
    icon: BadgeCheck,
    title: 'Carnet digital vigente',
    desc: 'Identificación oficial con código QR en tiempo real.',
  },
  {
    icon: QrCode,
    title: 'Validación instantánea',
    desc: 'Verifica y registra accesos de forma segura.',
  },
];

export default function AuthLayout({ children, footer, sidebarFooter }) {
  return (
    <div className="flex min-h-screen bg-sena-bg">
      {/* Panel institucional (izquierda, escritorio) */}
      <div className="relative hidden w-1/2 overflow-hidden bg-sena-hero lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, currentColor 1px, transparent 1px), radial-gradient(circle at 80% 70%, currentColor 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-sena-green-light/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-sena-yellow/20 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3 text-white">
          <Logo size="md" />
          <div>
            <p className="text-sm font-bold tracking-tight">Carnets SENA</p>
            <p className="text-xs text-sena-tint-200">Plataforma digital institucional</p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight text-white">
            La identidad digital de la comunidad SENA.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-sena-tint-200">
            Un solo lugar para gestionar usuarios, grupos, carnets digitales, asistencia y validación de accesos.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sena-yellow backdrop-blur">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-sena-tint-200">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 space-y-3">
          {sidebarFooter}
          <p className="text-xs text-sena-tint-200">
            © {new Date().getFullYear()} Servicio Nacional de Aprendizaje — SENA
          </p>
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-sena-tint-100/60 blur-3xl lg:hidden" />

        <div className="relative z-10 w-full max-w-[26rem]">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <Logo size="md" />
            <div>
              <p className="text-base font-bold tracking-tight text-sena-ink">Carnets SENA</p>
              <p className="text-xs text-slate-500">Plataforma digital institucional</p>
            </div>
          </div>

          <div className="animate-fade-up">{children}</div>
          {footer && <div className="mt-6 text-center text-xs text-slate-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}