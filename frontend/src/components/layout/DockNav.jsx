import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../constants/permissions';
import { MENU_ITEMS } from '../../constants/menu';
import cn from '../../lib/cn';

export default function DockNav() {
  const { user } = useAuth();

  const items = MENU_ITEMS.filter((item) =>
    hasPermission(user?.role_name, item.permission)
  );

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 md:pb-4"
    >
      <div className="bg-sena-dock relative flex max-w-full items-center rounded-full border border-white/15 p-1.5 shadow-overlay md:p-2">
        {/* brillo superior sutil */}
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/25" aria-hidden="true" />
        {/* halo institucional */}
        <div className="pointer-events-none absolute -inset-x-6 -bottom-6 -z-10 h-16 rounded-full bg-sena-green/30 blur-2xl" aria-hidden="true" />

        <div className="scrollbar-none flex items-center gap-0.5 overflow-x-auto px-1 py-1 lg:overflow-visible md:gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-white text-sena-green-dark shadow-card -translate-y-0.5'
                    : 'text-sena-green-light hover:bg-white/10 hover:text-white hover:-translate-y-0.5'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className="h-5 w-5 shrink-0"
                    strokeWidth={isActive ? 2.25 : 1.8}
                  />
                  <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-sena-green-dark px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 lg:block">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sena-yellow" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}