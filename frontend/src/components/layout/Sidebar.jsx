import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../constants/permissions';
import { MENU_ITEMS } from '../../constants/menu';
import { ROLE_BADGE_STYLES } from '../../constants/roles';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = MENU_ITEMS.filter((item) =>
    hasPermission(user?.role_name, item.permission)
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-white/10 text-white'
        : 'text-sena-green-light hover:bg-white/5 hover:text-white'
    }`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sena-green-dark transition-transform md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sena-yellow">
              <ShieldCheck className="h-6 w-6 text-sena-green-dark" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">Carnets SENA</p>
              <p className="text-xs text-sena-green-light">Sistema digital</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
              onClick={onClose}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sena-green text-sm font-bold text-white">
                {user.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {user.username}
                </p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_STYLES[user.role_name] || ''}`}
                >
                  {user.role_name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                className="text-sena-green-light hover:text-white"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
