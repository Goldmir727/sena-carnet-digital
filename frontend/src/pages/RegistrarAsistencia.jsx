import { useState } from 'react';
import { ScanLine, CheckCircle2, XCircle, QrCode, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEscanearAsistencia } from '../api/asistencia';
import { getErr } from '../lib/errors';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';

export default function RegistrarAsistencia() {
  const escanear = useEscanearAsistencia();
  const [token, setToken] = useState('');
  const [resultado, setResultado] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const onEscanear = async () => {
    if (!token.trim()) {
      toast.error('Ingresa el código QR de la clase');
      return;
    }
    setErrorMsg('');
    setResultado(null);
    try {
      const data = await escanear.mutateAsync(token.trim());
      setResultado(data);
    } catch (e) {
      setErrorMsg(getErr(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader
        eyebrow="Asistencia"
        title="Registrar asistencia"
        description="Escanea el código QR que proyecta tu instructor para registrar tu asistencia a clase."
        icon={ScanLine}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Registrar asistencia' }]}
      />

      <Card>
        <div className="space-y-4">
          <Input
            label="Código de la clase"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Pega el token del código QR"
            icon={QrCode}
            hint="El instructor proyecta el QR de la sesión. Cópia su contenido aquí o escanéalo con tu cámara."
          />
          <Button fullWidth icon={ScanLine} onClick={onEscanear} loading={escanear.isPending}>
            Registrar asistencia
          </Button>
        </div>
      </Card>

      {resultado && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 bg-sena-tint-100 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sena-green text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sena-green-dark">Asistencia registrada</p>
              <p className="text-sm text-sena-ink/70">
                Presenta este comprobante en caso de requerirse.{' '}
                {resultado.mensaje && <span className="text-sena-ink/70">{resultado.mensaje}</span>}
              </p>
              {resultado.id && (
                <Badge className="mt-2" variant="green">
                  Registro #{resultado.id}
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {errorMsg && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 bg-red-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-red-700">No se pudo registrar</p>
              <p className="text-sm text-red-600/80">{errorMsg}</p>
            </div>
          </div>
        </Card>
      )}

      <Card variant="flat">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sena-green" />
          <div className="text-sm text-slate-500">
            <p className="font-medium text-sena-ink">¿Cómo funciona?</p>
            <p className="mt-1 leading-relaxed">
              El código QR de clase cambia en cada sesión y solo sirve una vez por aprendiz. Si el código es inválido o ya fue
              usado, la asistencia no podrá registrarse.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}