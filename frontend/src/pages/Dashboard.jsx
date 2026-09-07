import { Link } from 'react-router-dom';
import { Users, Network, IdCard, FileBarChart2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../constants/permissions';
import { ROLE_BADGE_STYLES } from '../constants/roles';

const SHORTCUTS = [
  { to: '/usuarios', label: 'Usuarios', icon: Users, permission: 'users.read', desc: 'Gestionar usuarios' },
  { to: '/grupos', label: 'Grupos', icon: Network, permission: 'grupos.read', desc: 'Grupos y asignaciones' },
  { to: '/mi-carnet', label: 'Mi carnet', icon: IdCard, permission: 'carnet.view', desc: 'Ver carnet digital' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2, permission: 'reports.view', desc: 'Reportes y estadísticas' },
];

export default function Dashboard() {
  const { user } = useAuth();

  const visible = SHORTCUTS.filter((s) => hasPermission(user?.role_name, s.permission));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Bienvenido de nuevo</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-sena-ink">{user?.username}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_BADGE_STYLES[user?.role_name] || ''}`}
          >
            {user?.role_name}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Panel principal. Las estadísticas se conectan con <code className="rounded bg-slate-100 px-1">GET /reports/estadisticas</code> (Persona 2).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sena-green hover:shadow-md"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sena-green-light text-sena-green">
              <s.icon className="h-6 w-6" />
            </div>
            <p className="font-semibold text-sena-ink group-hover:text-sena-green">{s.label}</p>
            <p className="text-sm text-slate-500">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
