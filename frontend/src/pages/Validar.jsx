import { useState } from 'react';
import { ScanLine, ShieldCheck, ShieldX, MapPin, KeySquare, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useValidarQr, useValidarUuid } from '../api/validacion';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import StatusBadge from '../components/ui/StatusBadge';
import cn from '../lib/cn';

const getErr = (err) => {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) {
    const primero = detail[0];
    return primero
      ? `${primero.msg || primero.message || 'Dato inválido'}${primero.loc ? ` (campo: ${primero.loc.join('.')})` : ''}`
      : 'Dato inválido';
  }
  return detail || err.message || 'Error de conexión con el servidor';
};

export default function Validar() {
  const [mode, setMode] = useState('qr');
  const [codigo, setCodigo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [resultado, setResultado] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const validarQr = useValidarQr();
  const validarUuid = useValidarUuid();

  const isPending = mode === 'qr' ? validarQr.isPending : validarUuid.isPending;

  const onValidar = async () => {
    if (!codigo.trim()) {
      toast.error(mode === 'qr' ? 'Ingresa el código QR' : 'Ingresa el UUID del carnet');
      return;
    }
    setErrorMsg('');
    setResultado(null);
    const payload = { ubicacion: ubicacion.trim() || undefined };
    try {
      const data =
        mode === 'qr'
          ? await validarQr.mutateAsync({ qr_token: codigo.trim(), ...payload })
          : await validarUuid.mutateAsync({ uuid: codigo.trim(), ...payload });
      setResultado(data);
    } catch (e) {
      setErrorMsg(getErr(e));
    }
  };

  const usuario = resultado?.usuario || {};
  const nombre = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() || '—';

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader
        eyebrow="Seguridad"
        title="Validar acceso"
        description="Verifica la identidad y el estado del carnet digital ante la entrada al centro de formación."
        icon={ShieldCheck}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Validar acceso' }]}
      />

      <Card>
        <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1.5">
          <button
            onClick={() => { setMode('qr'); setResultado(null); setErrorMsg(''); }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
              mode === 'qr' ? 'bg-white text-sena-green shadow-soft' : 'text-slate-500'
            )}
          >
            <ScanLine className="h-4 w-4" /> Código QR
          </button>
          <button
            onClick={() => { setMode('uuid'); setResultado(null); setErrorMsg(''); }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
              mode === 'uuid' ? 'bg-white text-sena-green shadow-soft' : 'text-slate-500'
            )}
          >
            <KeySquare className="h-4 w-4" /> UUID
          </button>
        </div>

        <div className="space-y-4">
          <Input
            label={mode === 'qr' ? 'Código QR' : 'UUID del carnet'}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder={
              mode === 'qr'
                ? 'Pega el token del QR de acceso (generado en Mi carnet)'
                : 'Pega el UUID del carnet (cópialo desde Mi carnet)'
            }
            icon={mode === 'qr' ? ScanLine : KeySquare}
            hint={
              mode === 'qr'
                ? 'Solo valida el QR dinámico de acceso (un solo uso, expira en 15 min).'
                : undefined
            }
          />
          <Input
            label="Ubicación (opcional)"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Ej. Entrada principal, Bloque 2"
            icon={MapPin}
            hint="Se envía al servidor como contexto de la validación (cabecera X-Ubicacion)."
          />
          <Button fullWidth icon={ShieldCheck} onClick={onValidar} loading={isPending}>
            Validar identidad
          </Button>
        </div>
      </Card>

      {resultado && resultado.permitido && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 bg-sena-tint-100 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sena-green text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sena-green-dark">Acceso permitido</p>
              <p className="text-sm text-sena-ink/70">{resultado.mensaje || 'Identidad verificada correctamente.'}</p>

              <div className="mt-4 rounded-xl border border-sena-tint-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-base font-bold text-sena-ink">{nombre}</p>
                  <StatusBadge estado={resultado.carnet_estado} />
                </div>
                {(usuario.numero_documento || usuario.tipo_documento) && (
                  <p className="mt-1 text-sm text-slate-500">
                    {`${usuario.tipo_documento || ''} ${usuario.numero_documento || ''}`.trim()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {resultado && !resultado.permitido && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 bg-red-50 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
              <ShieldX className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-red-700">Acceso denegado</p>
              <p className="text-sm text-red-600/80">{resultado.mensaje || 'El carnet no está habilitado.'}</p>
              {resultado.carnet_estado && (
                <div className="mt-3">
                  <StatusBadge estado={resultado.carnet_estado} />
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {errorMsg && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 bg-red-50 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
              <ShieldX className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-red-700">No se pudo validar</p>
              <p className="text-sm text-red-600/80">{errorMsg}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}