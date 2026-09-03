import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { forgotPassword } from '../api/auth';
import Spinner from '../components/common/Spinner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      toast.success('Si el correo existe, recibirás las instrucciones.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar la solicitud');
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
          <h1 className="text-2xl font-bold text-white">Recuperar contraseña</h1>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-sena-green focus:outline-none focus:ring-2 focus:ring-sena-green/30"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex w-full items-center justify-center rounded-lg bg-sena-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-sena-green-dark disabled:opacity-60"
            >
              {loading ? <Spinner /> : 'Enviar instrucciones'}
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
