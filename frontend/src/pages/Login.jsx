import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, KeyRound, ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/ui/AuthLayout';
import Logo from '../components/ui/Logo';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import ApkDownloadLink from '../components/ui/ApkDownloadLink';

export default function Login() {
  const { isAuthenticated, authReady, step } = useAuth();
  const [loginInfo, setLoginInfo] = useState(null);

  if (authReady && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <AuthLayout
      footer="Servicio Nacional de Aprendizaje — SENA"
      sidebarFooter={<ApkDownloadLink tone="dark" />}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-raised">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-sena-ink">Iniciar sesión</h1>
              <p className="text-sm text-slate-500">Acceso seguro a la plataforma</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          {step === '2fa' && loginInfo ? (
            <TwoFactorStep loginInfo={loginInfo} onBack={() => setLoginInfo(null)} />
          ) : (
            <CredentialsStep onLoginSuccess={setLoginInfo} />
          )}
        </div>
      </div>
    </AuthLayout>
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
      <div className="mb-1 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sena-ink">Credenciales institucionales</p>
          <p className="text-xs text-slate-500">Tu cuenta de usuario SENA</p>
        </div>
      </div>

      <Input
        label="Usuario"
        icon={Mail}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Tu nombre de usuario"
        autoComplete="username"
        required
      />

      <Input
        label="Contraseña"
        type="password"
        icon={Lock}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Tu contraseña"
        autoComplete="current-password"
        required
      />

      <Button
        type="submit"
        fullWidth
        size="lg"
        icon={ChevronRight}
        loading={loading}
        disabled={!username || !password}
        className="justify-center"
      >
        {loading ? 'Verificando…' : 'Continuar'}
      </Button>

      <p className="pt-1 text-center text-sm text-slate-600">
        ¿Olvidaste tu contraseña?{' '}
        <Link to="/forgot-password" className="font-semibold text-sena-green transition hover:text-sena-green-dark hover:underline">
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
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-sena-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div>
        <h2 className="text-lg font-semibold text-sena-ink">Verificación en dos pasos</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Enviamos un código de 6 dígitos a{' '}
          <span className="font-semibold text-sena-ink">{loginInfo.email_masked}</span>
        </p>
      </div>

      <Input
        label="Código de verificación"
        icon={KeyRound}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        className="text-center text-lg tracking-[0.4em]"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        autoComplete="one-time-code"
        autoFocus
        required
      />

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={loading}
        disabled={code.length !== 6}
        className="justify-center"
      >
        {loading ? 'Verificando…' : 'Verificar y entrar'}
      </Button>

      <p className="pt-1 text-center text-sm text-slate-600">
        ¿No llegó el código?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="font-semibold text-sena-green transition hover:text-sena-green-dark hover:underline"
        >
          {sending ? 'Reenviando…' : 'Reenviar código'}
        </button>
      </p>
    </form>
  );
}