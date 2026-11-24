import { useEffect, useRef, useState } from 'react';
import {
  IdCard,
  Download,
  QrCode,
  FileText,
  CalendarDays,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Zap,
  RefreshCw,
  Clock,
  Pencil,
  Lock,
  User,
  Mail,
  Droplet,
  Building2,
  MapPin,
  GraduationCap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMiCarnet } from '../api/carnets';
import { useUser, useUpdateUser } from '../api/users';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../constants/permissions';
import { useGenerarQrCarnet, fetchQrImageBlob } from '../api/qr';
import { fetchCarnetQrUrl, downloadCarnetPdf } from '../lib/carnetMedia';
import { buildCarnetData } from '../lib/carnetDesign';
import CarnetPreview from '../components/carnet/CarnetPreview';
import CompleteProfile from '../components/CompleteProfile';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { getErr } from '../lib/errors';

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

const TIPOS_DOC = ['CC', 'CE', 'TI', 'PEP'];

const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

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

  const { user: authUser } = useAuth();
  const profile = useUser(carnet?.user_id || authUser?.id);
  const user = profile.data;

  // El QR de acceso temporal está prohibido para el Validador en el backend
  // (RF-14). La acción se oculta sin otorgar permisos adicionales ni relajar
  // la validación del servicio.
  const puedeGenerarQrAcceso = hasPermission(authUser?.role_name, 'qr.carnet');

  // Onboarding: el Aprendiz con datos críticos faltantes completa
  // su perfil antes de ver el carnet (tipo de sangre + foto).
  const perfilIncompleto =
    authUser?.role_name === 'Aprendiz' &&
    !!profile.data &&
    (!profile.data.tipo_sangre || !profile.data.foto_perfil);

  const [qrUrl, setQrUrl] = useState(null);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const qrUrlRef = useRef(null);

  const generarAccess = useGenerarQrCarnet();
  const updateUser = useUpdateUser();
  const [accessQr, setAccessQr] = useState(null);
  const [accessUrl, setAccessUrl] = useState(null);
  const [accessError, setAccessError] = useState(false);
  const [accessExpires, setAccessExpires] = useState(null);
  const [now, setNow] = useState(0);
  const accessUrlRef = useRef(null);

  // Edición de los datos personales del propio usuario autenticado.
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    tipo_documento: '',
    numero_documento: '',
    tipo_sangre: '',
    password: '',
  });
  const [editErrors, setEditErrors] = useState({});

  const openEdit = () => {
    const u = user || {};
    setEditForm({
      nombres: u.nombres || u.name || '',
      apellidos: u.apellidos || u.last_name || '',
      email: u.email || '',
      tipo_documento: u.tipo_documento || u.document_type || '',
      numero_documento: u.numero_documento || u.document || '',
      tipo_sangre: u.tipo_sangre || u.blood_type || '',
      password: '',
    });
    setEditErrors({});
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    const errs = {};
    const email = (editForm.email || '').trim();
    if (!email) errs.email = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Correo inválido';
    if (editForm.password && editForm.password.length < 6) errs.password = 'La contraseña debe tener mínimo 6 caracteres';
    setEditErrors(errs);
    if (Object.keys(errs).length) return;
    const payload = {
      email,
      ...(editForm.nombres.trim() && { nombres: editForm.nombres.trim() }),
      ...(editForm.apellidos.trim() && { apellidos: editForm.apellidos.trim() }),
      ...(editForm.tipo_documento && { tipo_documento: editForm.tipo_documento }),
      ...(editForm.numero_documento.trim() && { numero_documento: editForm.numero_documento.trim() }),
      ...(editForm.password && { password: editForm.password }),
      ...(editForm.tipo_sangre ? { tipo_sangre: editForm.tipo_sangre } : { tipo_sangre: null }),
    };
    try {
      await updateUser.mutateAsync({ id: user?.id || authUser?.id, ...payload });
      toast.success('Datos actualizados');
      setEditOpen(false);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

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

  if (isLoading || (profile.isLoading && !profile.data)) {
    return <LoadingState label="Consultando tu carnet…" />;
  }

  if (perfilIncompleto) {
    return <CompleteProfile user={profile.data} />;
  }

  if (sinCarnet) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Identidad SENA"
          title="Mi carnet"
          description="Consulta la información de tu carnet digital del SENA."
          icon={IdCard}
          breadcrumb={[{ label: 'Inicio', to: '/panel' }, { label: 'Mi carnet' }]}
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
          breadcrumb={[{ label: 'Inicio', to: '/panel' }, { label: 'Mi carnet' }]}
        />
        <ErrorState
          title="No se pudo consultar el carnet"
          message={error.response?.data?.detail || 'Intenta de nuevo en unos segundos.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!carnet) {
    return <LoadingState label="Consultando tu carnet…" />;
  }

  const carnetData = buildCarnetData(carnet, {
    ...user,
    role_name: user?.role_name || authUser?.role_name,
  });

  const esValido =
    carnet.estado === 'Activo' &&
    (!carnet.fecha_vencimiento || new Date(carnet.fecha_vencimiento) >= new Date());

  const onDownload = async () => {
    setPdfLoading(true);
    try {
      await downloadCarnetPdf(carnetData);
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
        breadcrumb={[{ label: 'Inicio', to: '/panel' }, { label: 'Mi carnet' }]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden" padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sena-tint-100 text-sena-green">
                  <IdCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-sena-ink">Vista previa del carnet</h2>
                  <p className="text-xs text-slate-400">Así se verá tu carnet digital institucional</p>
                </div>
              </div>
              <StatusBadge estado={carnet.estado} />
            </div>
            <div className="bg-slate-50/70 px-4 py-6 sm:px-8">
              <div className="mx-auto w-full max-w-[560px]">
                <CarnetPreview carnet={carnetData} qrUrl={qrUrl} />
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">
                Formato CR80 · 85,6 × 53,98 mm
              </p>
            </div>
          </Card>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sena-tint-100 text-sena-green">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-sena-ink">Datos personales</h2>
                  <p className="text-xs text-slate-400">Información registrada en tu perfil SENA</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" icon={Pencil} onClick={openEdit}>
                Editar mis datos
              </Button>
            </div>
            <div className="divide-y divide-slate-100">
              <DetailRow icon={User} label="Nombre completo" value={`${carnetData.nombres} ${carnetData.apellidos}`.trim()} />
              <DetailRow icon={IdCard} label="Tipo de documento" value={carnetData.tipo_documento} />
              <DetailRow icon={IdCard} label="Número de documento" value={carnetData.numero_documento} />
              <DetailRow icon={Mail} label="Correo electrónico" value={user?.email || carnetData.usuario_email} />
              <DetailRow icon={Droplet} label="Tipo de sangre" value={carnetData.tipo_sangre} />
              <DetailRow icon={Building2} label="Centro de formación" value={carnetData.centro_nombre} />
              <DetailRow icon={MapPin} label="Regional" value={carnetData.regional} />
              <DetailRow icon={MapPin} label="Ciudad" value={carnetData.ciudad} />
              <DetailRow icon={GraduationCap} label="Programa" value={carnetData.programa_nombre} />
              <DetailRow icon={ShieldCheck} label="Rol" value={carnetData.rol_nombre || authUser?.role_name} />
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden" padding={false}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
              <QrCode className="h-5 w-5 text-sena-green" />
              <h2 className="text-base font-semibold text-sena-ink">Código de acceso</h2>
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
                        <p className="text-xs text-slate-400">No se pudo cargar el código QR del carnet.</p>
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
              {esValido ? <BadgeSuccess /> : <BadgeWarn />}
            </div>
            <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-1">
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
          {puedeGenerarQrAcceso && (
            <Card className="overflow-hidden" padding={false}>
              <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-sena-ink">QR de acceso temporal</h2>
                  <p className="text-xs text-slate-400">Para validar en portería · un solo uso</p>
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
          )}
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar mis datos"
        description="Actualiza tu información personal. Tu rol no puede modificarse desde aquí."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button icon={Pencil} onClick={onSaveEdit} loading={updateUser.isPending}>
              Guardar cambios
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombres" value={editForm.nombres} onChange={(e) => setEditForm({ ...editForm, nombres: e.target.value })} />
          <Input label="Apellidos" value={editForm.apellidos} onChange={(e) => setEditForm({ ...editForm, apellidos: e.target.value })} />
          <Input label="Correo electrónico" type="email" icon={Mail} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} error={editErrors.email} />
          <Select
            label="Tipo de documento"
            options={TIPOS_DOC}
            value={editForm.tipo_documento}
            onChange={(e) => setEditForm({ ...editForm, tipo_documento: e.target.value })}
            placeholder="Sin especificar"
            allowEmpty
          />
          <Input label="Número de documento" value={editForm.numero_documento} onChange={(e) => setEditForm({ ...editForm, numero_documento: e.target.value })} />
          <Select
            label="Tipo de sangre"
            options={TIPOS_SANGRE}
            value={editForm.tipo_sangre}
            onChange={(e) => setEditForm({ ...editForm, tipo_sangre: e.target.value })}
            placeholder="Sin especificar"
            allowEmpty
            hint="Incluye el RH: por ejemplo O+ u O−"
          />
          <Input label="Nueva contraseña" type="password" icon={Lock} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} error={editErrors.password} hint="Opcional. Mínimo 6 caracteres." />
        </div>
      </Modal>
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
