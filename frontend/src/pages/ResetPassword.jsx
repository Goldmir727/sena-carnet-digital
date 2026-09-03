import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { resetPassword } from '../api/auth';
import Spinner from '../components/common/Spinner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (!token) {
      toast.error('El enlace de recuperación no es válido.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      toast.success('Contraseña actualizada. Inicia sesión.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sena-green to-sena-green-dark px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-sena-yellow">
            <ShieldCheck className="h-9 w-9 text-sena-green-dark" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nueva contraseña</h1>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-sena-green focus:outline-none focus:ring-2 focus:ring-sena-green/30"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                minLength={6}
                required
              />
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-sena-green focus:outline-none focus:ring-2 focus:ring-sena-green/30"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmar nueva contraseña"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !newPassword || !confirm}
              className="flex w-full items-center justify-center rounded-lg bg-sena-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-sena-green-dark disabled:opacity-60"
            >
              {loading ? <Spinner /> : 'Guardar contraseña'}
            </button>
            <p className="text-center text-sm">
              <Link to="/login" className="inline-flex items-center gap-1 text-slate-600 hover:text-sena-ink">
                <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
