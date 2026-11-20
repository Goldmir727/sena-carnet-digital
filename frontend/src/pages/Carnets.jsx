import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CreditCard,
  Plus,
  QrCode,
  Download,
  RefreshCw,
  ArrowLeftRight,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCarnets, useGenerarCarnet, useRegenerarCarnet, useCambiarEstadoCarnet } from '../api/carnets';
import { useUsers } from '../api/users';
import { fetchCarnetQrUrl, downloadCarnetPdf } from '../lib/carnetMedia';
import { buildCarnetData } from '../lib/carnetDesign';
import { getErr } from '../lib/errors';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Table from '../components/ui/Table';
import Dropdown from '../components/ui/Dropdown';
import StatusBadge from '../components/ui/StatusBadge';
import ErrorState from '../components/ui/ErrorState';

const ESTADOS = ['Activo', 'Vencido', 'Inactivo'];

const TRANSICIONES = {
  Activo: ['Vencido'],
  Vencido: ['Activo', 'Inactivo'],
  Inactivo: [],
};

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export default function Carnets() {
  const carnetsQuery = useCarnets();
  const usersQuery = useUsers();
  const generar = useGenerarCarnet();
  const regenerar = useRegenerarCarnet();
  const cambiarEstado = useCambiarEstadoCarnet();

  const [filter, setFilter] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [userSel, setUserSel] = useState('');
  const [estadoTarget, setEstadoTarget] = useState(null);
  const [nextEstado, setNextEstado] = useState('');
  const [qrCarnet, setQrCarnet] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [qrError, setQrError] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(null);
  const qrUrlRef = useRef(null);

  const userMap = useMemo(() => {
    const m = {};
    (usersQuery.data || []).forEach((u) => {
      m[u.id] = u;
    });
    return m;
  }, [usersQuery.data]);

  useEffect(() => {
    if (!qrCarnet?.id) return;
    let active = true;
    fetchCarnetQrUrl(qrCarnet.id)
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
  }, [qrCarnet?.id]);

  useEffect(() => {
    return () => {
      if (qrUrlRef.current) URL.revokeObjectURL(qrUrlRef.current);
    };
  }, []);

  const all = useMemo(() => carnetsQuery.data || [], [carnetsQuery.data]);
  const stats = useMemo(() => {
    const s = { total: all.length, activo: 0, suspendido: 0, vencido: 0, inactivo: 0 };
    all.forEach((c) => {
      const k = c.estado?.toLowerCase();
      if (k in s) s[k] += 1;
    });
    return s;
  }, [all]);

  const rows = filter ? all.filter((c) => c.estado === filter) : all;

  const usuariosSinCarnet = useMemo(
    () => (usersQuery.data || []).filter((u) => !all.some((c) => c.user_id === u.id)),
    [usersQuery.data, all]
  );

  const onGenerate = async () => {
    if (!userSel) return;
    try {
      await generar.mutateAsync(Number(userSel));
      toast.success('Carnet generado correctamente');
      setGenerateOpen(false);
      setUserSel('');
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onRegen = async () => {
    try {
      await regenerar.mutateAsync(confirmRegen.user_id);
      toast.success('Carnet regenerado');
      setConfirmRegen(null);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onCambiarEstado = async () => {
    if (!nextEstado) return;
    try {
      await cambiarEstado.mutateAsync({ id: estadoTarget.id, estado: nextEstado });
      toast.success(`Estado cambiado a ${nextEstado}`);
      setEstadoTarget(null);
      setNextEstado('');
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onDownloadPdf = async (c) => {
    try {
      const u = userMap[c.user_id] || {};
      await downloadCarnetPdf(
        buildCarnetData(c, {
          ...u,
          email: u.email || u.username,
        }),
      );
      toast.success('Carnet descargado en PDF');
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const columns = [
    {
      key: 'usuario',
      label: 'Titular',
      render: (r) => {
        const u = userMap[r.user_id];
        const nombre = u ? u.nombres || u.name || u.username : '';
        const doc = u ? u.numero_documento || u.document : '';
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-sena-ink">{nombre || '—'}</p>
            <p className="truncate text-xs text-slate-400">
              ID {r.user_id}
              {doc ? ` · ${doc}` : ''}
            </p>
          </div>
        );
      },
    },
    {
      key: 'uuid',
      label: 'Código único',
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">
          {r.uuid ? `${r.uuid.slice(0, 8)}…` : '—'}
        </span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (r) => <StatusBadge estado={r.estado} />,
    },
    {
      key: 'fecha_emision',
      label: 'Emitido',
      render: (r) => <span className="text-slate-600">{fmt(r.fecha_emision)}</span>,
    },
    {
      key: 'fecha_vencimiento',
      label: 'Vence',
      render: (r) => <span className="text-slate-600">{fmt(r.fecha_vencimiento)}</span>,
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (r) => {
        const trans = TRANSICIONES[r.estado] || [];
        return (
          <Dropdown
            items={[
              { label: 'Ver QR', icon: QrCode, onClick: () => { setQrUrl(null); setQrError(false); setQrCarnet(r); } },
              { label: 'Descargar PDF', icon: Download, onClick: () => onDownloadPdf(r) },
              ...(trans.length
                ? [{ label: 'Cambiar estado', icon: ArrowLeftRight, onClick: () => { setEstadoTarget(r); setNextEstado(trans[0] || ''); } }]
                : []),
              { label: 'Regenerar', icon: RefreshCw, onClick: () => setConfirmRegen(r) },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coordinación"
        title="Gestión de carnets"
        description="Genera, regenera y controla el estado de los carnets digitales del SENA."
        icon={CreditCard}
        breadcrumb={[{ label: 'Inicio', to: '/panel' }, { label: 'Carnets' }]}
        actions={
          <Button icon={Plus} onClick={() => setGenerateOpen(true)}>
            Generar carnet
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard icon={CreditCard} label="Total" value={stats.total} accent="dark" />
        <StatCard icon={UserCheck} label="Activos" value={stats.activo} accent="green" />
        <StatCard icon={ArrowLeftRight} label="Suspendidos" value={stats.suspendido} accent="yellow" />
        <StatCard icon={ArrowLeftRight} label="Vencidos" value={stats.vencido} accent="red" />
        <StatCard icon={ArrowLeftRight} label="Inactivos" value={stats.inactivo} accent="slate" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-56">
          <Select
            options={[{ value: '', label: 'Todos los estados' }, ...ESTADOS.map((e) => ({ value: e, label: e }))]}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            allowEmpty={false}
            placeholder="Filtrar por estado"
          />
        </div>
        <p className="text-xs text-slate-400">{rows.length} carnets en esta vista</p>
      </div>

      {carnetsQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los carnets"
          message={getErr(carnetsQuery.error)}
          onRetry={carnetsQuery.refetch}
        />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          loading={carnetsQuery.isLoading}
          emptyTitle="Sin carnets"
          emptyMessage="Aún no hay carnets registrados. Genera el primero."
          keyField="id"
        />
      )}

      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generar carnet"
        description="Selecciona el usuario al que se le emitirá un carnet nuevo."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateOpen(false)}>
              Cancelar
            </Button>
            <Button icon={Plus} onClick={onGenerate} loading={generar.isPending} disabled={!userSel}>
              Generar carnet
            </Button>
          </>
        }
      >
        <Select
          label="Usuario"
          options={usuariosSinCarnet.map((u) => ({
            value: u.id,
            label: `${u.nombres || u.name || u.username || u.email}${u.numero_documento ? ` (${u.numero_documento})` : ''}`,
          }))}
          value={userSel}
          onChange={(e) => setUserSel(e.target.value)}
          placeholder="Selecciona un usuario"
          error={!usuariosSinCarnet.length ? 'Todos los usuarios ya tienen carnet' : undefined}
        />
      </Modal>

      <Modal
        open={!!estadoTarget}
        onClose={() => { setEstadoTarget(null); setNextEstado(''); }}
        title="Cambiar estado de carnet"
        description={estadoTarget ? `Estado actual: ${estadoTarget.estado}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEstadoTarget(null); setNextEstado(''); }}>
              Cancelar
            </Button>
            <Button icon={ArrowLeftRight} onClick={onCambiarEstado} loading={cambiarEstado.isPending} disabled={!nextEstado}>
              Aplicar cambio
            </Button>
          </>
        }
      >
        <Select
          label="Nuevo estado"
          options={(TRANSICIONES[estadoTarget?.estado] || []).map((e) => ({ value: e, label: e }))}
          value={nextEstado}
          onChange={(e) => setNextEstado(e.target.value)}
          allowEmpty={false}
        />
      </Modal>

      <Modal
        open={!!qrCarnet}
        onClose={() => { setQrCarnet(null); setQrUrl(null); }}
        title="Código QR del carnet"
        description={qrCarnet ? `UUID: ${qrCarnet.uuid}` : ''}
        size="sm"
        footer={
          <Button
            icon={Download}
            onClick={() => onDownloadPdf(qrCarnet)}
            loading={false}
          >
            Descargar PDF
          </Button>
        }
      >
        <div className="flex items-center justify-center">
          {qrUrl ? (
            <img src={qrUrl} alt="Código QR del carnet" className="h-64 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-soft" />
          ) : (
            <div className="flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50">
              {qrError ? (
                <p className="px-4 text-center text-sm text-slate-400">No se pudo cargar el QR.</p>
              ) : (
                <span className="flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-sena-tint-200 border-t-sena-green" />
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmRegen}
        onClose={() => setConfirmRegen(null)}
        onConfirm={onRegen}
        loading={regenerar.isPending}
        title="Regenerar carnet"
        description="Esto emite un nuevo código QR para el usuario. El código anterior dejará de ser válido."
        confirmLabel="Regenerar"
        destructive={false}
      />
    </div>
  );
}
