import { useEffect, useRef, useState } from 'react';
import {
  IdCard,
  Download,
  QrCode,
  Mail,
  FileText,
  User,
  CalendarDays,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Zap,
  RefreshCw,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMiCarnet } from '../api/carnets';
import { useUser } from '../api/users';
import { useGenerarQrCarnet, fetchQrImageBlob } from '../api/qr';
import { fetchCarnetQrUrl, downloadCarnetPdf } from '../lib/carnetMedia';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

function DetailRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-slate-500">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
        {label}
      </span>
      <span className={`text-right text-sm font-medium text-sena-ink ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function MiCarnet() {
  const {
    data: carnet,
    isLoading,
    isError,
    error,
    refetch,
  } = useMiCarnet();
  const sinCarnet = isError && error?.response?.status === 404;

  const profile = useUser(carnet?.user_id);
  const user = profile.data;

  const [qrUrl, setQrUrl] = useState(null);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const qrUrlRef = useRef(null);

  const generarAccess = useGenerarQrCarnet();
  const [accessQr, setAccessQr] = useState(null);
  const [accessUrl, setAccessUrl] = useState(null);
  const [accessError, setAccessError] = useState(false);
  const [accessExpires, setAccessExpires] = useState(null);
  const [now, setNow] = useState(0);
  const accessUrlRef = useRef(null);

  useEffect(() => {
    if (!accessExpires) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [accessExpires]);

  useEffect(() => {
    if (!accessQr?.qr_token) return;
    let active = true;
    fetchQrImageBlob(accessQr.qr_token)
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        if (accessUrlRef.current) URL.revokeObjectURL(accessUrlRef.current);
        accessUrlRef.current = url;
        setAccessUrl(url);
      })
      .catch(() => {
        if (active) setAccessError(true);
      });
    return () => {
      active = false;
    };
  }, [accessQr?.qr_token]);

  useEffect(() => {
    return () => {
      if (accessUrlRef.current) URL.revokeObjectURL(accessUrlRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!carnet?.id) {
      return;
    }
    fetchCarnetQrUrl(carnet.id)
      .then((url) => {
        if (!active) return;
        if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current);
        qrUrlRef.current = url;
        setQrUrl(url);
      })
      .catch(() => active && setQrError(true));
    return () => {
      active = false;
    };
  }, [carnet?.id]);

  useEffect(() => {
    return () => {
      if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current);
    };
  }, []);

  if (isLoading) return <LoadingState label="Consultando tu carnet…" />;

  if (sinCarnet) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Identidad SENA"
          title="Mi carnet"
          description="Consulta la información de tu carnet digital del SENA."
          icon={IdCard}
          breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Mi carnet' }]}
        />
        <EmptyState
          icon={IdCard}
          title="Aún no tienes carnet digital"
          message="Tu carnet se genera automáticamente al estar vinculado como estudiante o colaborador. Si crees que es un error, contacta a la coordinación."
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Identidad SENA"
          title="Mi carnet"
          icon={IdCard}
          breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Mi carnet' }]}
        />
        <ErrorState
          title="No se pudo consultar el carnet"
          message={error.response?.data?.detail || 'Intenta de nuevo en unos segundos.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  const nombres = user?.nombres || user?.name || user?.email || '—';
  const apellidos = user?.apellidos || user?.last_name || '';
  const documento = user?.numero_documento || user?.document || '—';
  const tipoDoc = user?.tipo_documento || user?.document_type || '';
  const esValido =
    carnet.estado === 'Activo' && (!carnet.fecha_vencimiento || new Date(carnet.fecha_vencimiento) >= new Date());

  const onDownload = async () => {
    setPdfLoading(true);
    try {
      await downloadCarnetPdf(carnet.id);
      toast.success('Carnet descargado en PDF');
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'No se pudo descargar el carnet');
    } finally {
      setPdfLoading(false);
    }
  };

  const onCopyUuid = async () => {
    try {
      await navigator.clipboard.writeText(carnet.uuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('No se pudo copiar el código');
    }
  };

  const onGenAccess = async () => {
    try {
      const res = await generarAccess.mutateAsync();
      setAccessQr(res);
      setAccessUrl(null);
      setAccessError(false);
      setNow(Date.now());
      setAccessExpires(new Date(res.expires_at).getTime());
      toast.success('QR de acceso generado. Caduca en 15 min o al primer uso.');
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'No se pudo generar el QR de acceso');
    }
  };

  const segundosRestantes = accessExpires
    ? Math.max(0, Math.floor((accessExpires - now) / 1000))
    : 0;
  const tiempoAcceso =
    segundosRestantes === 0
      ? 'text-red-600 bg-red-50'
      : segundosRestantes < 300
        ? 'text-sena-ink bg-sena-yellow/15'
        : 'text-sena-green-dark bg-sena-tint-100';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identidad SENA"
        title="Mi carnet"
        description="Tu carnet digital vigente. Presenta el código QR o el UUID para validar tu identidad en las instalaciones del SENA."
        icon={IdCard}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Mi carnet' }]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sena-tint-100 text-sena-green">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-sena-ink">Datos personales</h2>
                <p className="text-xs text-slate-400">Información registrada en tu perfil SENA</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              <DetailRow icon={User} label="Nombre completo" value={`${nombres} ${apellidos}`.trim()} />
              <DetailRow icon={IdCard} label="Tipo de documento" value={tipoDoc} />
              <DetailRow icon={IdCard} label="Número de documento" value={documento} />
              <DetailRow icon={Mail} label="Correo electrónico" value={user?.email} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sena-tint-100 text-sena-green">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-sena-ink">Estado del carnet</h2>
                <p className="text-xs text-slate-400">Vigencia y condición actual</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4">
              <StatusBadge estado={carnet.estado} />
              {esValido ? (
                <BadgeSuccess />
              ) : (
                <BadgeWarn />
              )}
            </div>
            <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Emitido: <span className="font-medium text-sena-ink">{fmt(carnet.fecha_emision)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Vence: <span className="font-medium text-sena-ink">{fmt(carnet.fecha_vencimiento)}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <QrCode className="h-5 w-5 text-sena-green" />
                <h2 className="text-base font-semibold text-sena-ink">Código de acceso</h2>
              </div>
              <StatusBadge estado={carnet.estado} />
            </div>
            <div className="flex flex-col items-center px-5 py-6">
              <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
                {qrUrl ? (
                  <img src={qrUrl} alt="Código QR del carnet" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    {qrError ? (
                      <>
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                        <p className="text-xs text-slate-400">No se pudo generar el QR. Intenta descargar el PDF.</p>
                      </>
                    ) : (
                      <Loader />
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onCopyUuid}
                className="mt-4 flex max-w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 transition hover:bg-slate-100"
                title="Copiar UUID"
              >
                <span className="truncate">{carnet.uuid}</span>
                {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-sena-green" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              </button>

              <div className="mt-5 w-full">
                <Button fullWidth icon={Download} onClick={onDownload} loading={pdfLoading}>
                  Descargar carnet en PDF
                </Button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <FileText className="h-3.5 w-3.5" /> El PDF incluye este código QR para impresión
              </p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-sena-ink">QR de acceso</h2>
                <p className="text-xs text-slate-400">Para validar en portería</p>
              </div>
            </div>
            <div className="flex flex-col items-center px-5 py-6">
              {!accessQr ? (
                <>
                  <p className="mb-4 text-center text-sm text-slate-500">
                    Genera un QR temporal de un solo uso para presentarlo ante el validador de acceso.
                  </p>
                  <Button fullWidth icon={Zap} onClick={onGenAccess} loading={generarAccess.isPending}>
                    Generar QR de acceso
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
                    {accessUrl ? (
                      <img src={accessUrl} alt="QR de acceso" className="h-full w-full object-contain" />
                    ) : accessError ? (
                      <p className="px-4 text-center text-sm text-slate-400">No se pudo cargar el QR.</p>
                    ) : (
                      <span className="flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-sena-tint-200 border-t-sena-green" />
                    )}
                  </div>
                  <p className="mt-4 max-w-full truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
                    {accessQr.qr_token}
                  </p>
                  <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${tiempoAcceso}`}>
                    <Clock className="h-3.5 w-3.5" />
                    Expira en {String(Math.floor(segundosRestantes / 60)).padStart(2, '0')}:
                    {String(segundosRestantes % 60).padStart(2, '0')} · un solo uso
                  </span>
                  <div className="mt-5 w-full">
                    <Button fullWidth variant="secondary" icon={RefreshCw} onClick={onGenAccess} loading={generarAccess.isPending}>
                      Regenerar QR
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-sena-tint-200 border-t-sena-green" />
      <p className="text-xs text-slate-400">Generando QR…</p>
    </div>
  );
}

function BadgeSuccess() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sena-tint-100 px-2.5 py-0.5 text-xs font-semibold text-sena-green-dark">
      Carnet vigente
    </span>
  );
}

function BadgeWarn() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      <AlertTriangle className="h-3 w-3" /> Carnet no vigente
    </span>
  );
}