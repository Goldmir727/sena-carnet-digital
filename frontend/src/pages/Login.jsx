import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, KeyRound, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-sena-ink placeholder:text-slate-400 focus:border-sena-green focus:outline-none focus:ring-2 focus:ring-sena-green/30';

export default function Login() {
  const { user, step } = useAuth();
  const [loginInfo, setLoginInfo] = useState(null);

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sena-green to-sena-green-dark px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-sena-yellow">
            <ShieldCheck className="h-9 w-9 text-sena-green-dark" />
          </div>
          <h1 className="text-2xl font-bold text-white">Sistema de Carnets SENA</h1>
          <p className="mt-1 text-sm text-sena-green-light">
            Acceso seguro con verificación en dos pasos
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          {step === '2fa' && loginInfo ? (
            <TwoFactorStep loginInfo={loginInfo} onBack={() => setLoginInfo(null)} />
          ) : (
            <CredentialsStep onLoginSuccess={setLoginInfo} />
          )}
        </div>
      </div>
    </div>
  );
}


function CredentialsStep({ onLoginSuccess }) {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(username.trim(), password);
      onLoginSuccess(data);
      toast.success('Código de verificación enviado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al iniciar sesión');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-sena-ink">Usuario</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu nombre de usuario"
            autoComplete="username"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-sena-ink">Contraseña</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !username || !password}
        className="flex w-full items-center justify-center rounded-lg bg-sena-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sena-green-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Spinner /> : 'Continuar'}
      </button>

      <p className="text-center text-sm text-slate-600">
        ¿Olvidaste tu contraseña?{' '}
        <Link to="/forgot-password" className="font-medium text-sena-green hover:underline">
          Recupérala aquí
        </Link>
      </p>
    </form>
  );
}

function TwoFactorStep({ loginInfo, onBack }) {
  const { verifyCode, resendCode, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await verifyCode(code.trim());
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Código inválido o expirado');
    }
  };

  const handleResend = async () => {
    setSending(true);
    try {
      await resendCode();
      toast.success('Nuevo código enviado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo reenviar el código');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sena-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div>
        <h2 className="text-lg font-semibold text-sena-ink">Verificación en dos pasos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enviamos un código de 6 dígitos a{' '}
          <span className="font-medium text-sena-ink">{loginInfo.email_masked}</span>
        </p>
      </div>

      <div className="relative">
        <KeyRound className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          className={`${inputClass} text-center text-lg tracking-widest`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          autoFocus
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="flex w-full items-center justify-center rounded-lg bg-sena-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sena-green-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Spinner /> : 'Verificar y entrar'}
      </button>

      <p className="text-center text-sm text-slate-600">
        ¿No llegó el código?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="font-medium text-sena-green hover:underline"
        >
          Reenviar código
        </button>
      </p>
    </form>
  );
}
