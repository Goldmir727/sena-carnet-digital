import { useEffect, useRef, useState } from 'react';
import { QrCode, RefreshCw, Clock, GraduationCap, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMisGrupos } from '../api/grupos';
import { useGenerarQrClase, fetchQrImageBlob } from '../api/qr';
import { getErr } from '../lib/errors';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';

function formatSegundos(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QrClase() {
  const grupos = useMisGrupos();
  const generar = useGenerarQrClase();

  const [grupoId, setGrupoId] = useState('');
  const [qr, setQr] = useState(null);
  const [qrImgUrl, setQrImgUrl] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(0);
  const urlRef = useRef(null);

  const data = grupos.data || [];
  const grupoSeleccionado = grupoId || (data.length === 1 ? data[0].id : '');

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    if (!qr?.qr_token) return;
    let active = true;
    fetchQrImageBlob(qr.qr_token)
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setQrImgUrl(url);
      })
      .catch(() => {
        if (active) toast.error('No se pudo cargar la imagen del QR');
      });
    return () => {
      active = false;
    };
  }, [qr?.qr_token]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const onGenerar = async () => {
    if (!grupoSeleccionado) {
      toast.error('Selecciona el grupo de la clase');
      return;
    }
    setQr(null);
    setQrImgUrl(null);
    setNow(Date.now());
    try {
      const res = await generar.mutateAsync(Number(grupoSeleccionado));
      setQr(res);
      setExpiresAt(new Date(res.expires_at).getTime());
      toast.success('QR generado. Proyecta la pantalla a tus aprendices.');
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const restantes = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const tiempoClase =
    restantes === 0
      ? 'text-red-600 bg-red-50'
      : restantes < 120
        ? 'text-red-600 bg-red-50'
        : restantes < 300
          ? 'text-sena-ink bg-sena-yellow/15'
          : 'text-sena-green-dark bg-sena-tint-100';

  if (grupos.isLoading) return <LoadingState label="Cargando tus grupos…" />;

  if (grupos.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Clase"
          title="QR de clase"
          description="Genera el código QR intransferible que tus aprendices escanean para registrar asistencia."
          icon={QrCode}
          breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'QR de clase' }]}
        />
        <ErrorState title="No se pudieron cargar tus grupos" message={getErr(grupos.error)} onRetry={grupos.refetch} />
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6">
        <PageHeader
          eyebrow="Clase"
          title="QR de clase"
          description="Genera el código QR intransferible que tus aprendices escanean para registrar su asistencia."
          icon={QrCode}
          breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'QR de clase' }]}
        />

        {data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No tienes grupos asignados"
            message="Solo puedes generar el QR de una clase si estás asignado como docente del grupo correspondiente."
          />
        ) : (
          <Card>
            <div className="space-y-4">
              <Select
                label="Grupo de la clase"
                options={data.map((g) => ({ value: g.id, label: g.nombre }))}
                value={grupoSeleccionado}
                onChange={(e) => setGrupoId(e.target.value)}
                placeholder="Selecciona el grupo"
                hint="El QR solo funciona para el grupo seleccionado y se invalida al expirar o al usarse."
              />
              <Button fullWidth icon={QrCode} onClick={onGenerar} loading={generar.isPending}>
                Generar QR de clase
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader
        eyebrow="Clase"
        title="QR de clase"
        description="Proyecta este código para que tus aprendices registren asistencia."
        icon={QrCode}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'QR de clase' }]}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={onGenerar} loading={generar.isPending}>
            Regenerar QR
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sena-ink">{qr.grupo}</p>
              <p className="text-xs text-slate-400">{qr.docente}</p>
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${tiempoClase}`}>
            <Clock className="h-3.5 w-3.5" />
            {formatSegundos(restantes)}
          </span>
        </div>

        <div className="flex flex-col items-center px-5 py-8">
          <div className="flex h-72 w-72 max-w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            {qrImgUrl ? (
              <img src={qrImgUrl} alt="QR de clase" className="h-full w-full object-contain" />
            ) : (
              <span className="flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-sena-tint-200 border-t-sena-green" />
            )}
          </div>
          <p className="mt-4 max-w-full truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
            {qr.qr_token}
          </p>
          <p className="mt-3 text-center text-xs text-slate-400">
            El código expira automáticamente y queda sin efecto al ser escaneado.
          </p>
        </div>
      </Card>
    </div>
  );
}