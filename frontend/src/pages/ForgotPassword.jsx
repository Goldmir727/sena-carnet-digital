import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail } from 'lucide-react';
import { forgotPassword } from '../api/auth';
import AuthLayout from '../components/ui/AuthLayout';
import Logo from '../components/ui/Logo';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

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
    <AuthLayout footer="Servicio Nacional de Aprendizaje — SENA">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-raised">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-sena-ink">Recuperar contraseña</h1>
              <p className="text-sm text-slate-500">Te enviaremos las instrucciones por correo</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@misena.edu.co"
              autoComplete="email"
              required
            />
            <Button type="submit" fullWidth size="lg" loading={loading} disabled={!email} className="justify-center">
              {loading ? 'Enviando…' : 'Enviar instrucciones'}
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