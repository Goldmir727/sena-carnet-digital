import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_BADGE_STYLES } from '../../constants/roles';
import Logo from '../ui/Logo';
import cn from '../../lib/cn';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/60 bg-canvas/80 px-4 backdrop-blur-md md:px-6 lg:px-10">
      {/* Marca */}
      <div className="flex items-center gap-2.5">
        <Logo size="sm" />
        <div className="hidden md:block">
          <p className="text-sm font-extrabold tracking-tight text-sena-ink">Carnets SENA</p>
          <p className="text-[11px] font-medium text-slate-400">Identidad digital</p>
        </div>
      </div>

      <div className="flex-1" />

      {/* Perfil y cierre de sesión */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'hidden rounded-full px-3 py-1 text-xs font-semibold lg:inline',
            ROLE_BADGE_STYLES[user?.role_name] || 'bg-slate-100 text-slate-600'
          )}
        >
          {user?.role_name}
        </span>
        <button
          type="button"
          onClick={() => navigate('/mi-carnet')}
          title="Mi perfil y carnet"
          aria-label="Ver mi perfil y carnet"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sena-green text-xs font-bold text-white shadow-glow transition hover:ring-2 hover:ring-sena-green/40 focus-visible:ring-2 focus-visible:ring-sena-green/40 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {user?.username?.slice(0, 2).toUpperCase()}
        </button>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-sena-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}