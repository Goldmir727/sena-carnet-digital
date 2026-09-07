import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, KeyRound, Lock } from 'lucide-react';
import { resetPassword } from '../api/auth';
import AuthLayout from '../components/ui/AuthLayout';
import Logo from '../components/ui/Logo';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

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
    <AuthLayout footer="Servicio Nacional de Aprendizaje — SENA">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-raised">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-sena-ink">Nueva contraseña</h1>
              <p className="text-sm text-slate-500">Elige una contraseña segura</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nueva contraseña"
              type="password"
              icon={Lock}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              icon={KeyRound}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite tu nueva contraseña"
              minLength={6}
              required
            />
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              disabled={!newPassword || !confirm}
              className="justify-center"
            >
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
            <p className="pt-1 text-center text-sm">
              <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-sena-green">
                <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}