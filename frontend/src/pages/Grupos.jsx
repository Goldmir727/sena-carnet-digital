import { useState } from 'react';
import { Users, Plus, Pencil, Trash2, UserPlus, UserMinus, GraduationCap, Upload, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGrupos,
  useCreateGrupo,
  useUpdateGrupo,
  useDeleteGrupo,
  useGrupoEstudiantes,
  useAsignarEstudiantes,
  useQuitarEstudiante,
  useAsignarDocentes,
} from '../api/grupos';
import { useCentros } from '../api/centros';
import { useRegionales, useCentrosByRegional } from '../api/regionales';
import { useProgramas } from '../api/programas';
import { useUsers, useImportUsersExcel, downloadImportTemplate } from '../api/users';
import { getErr } from '../lib/errors';
import ExcelImportPreview from '../components/import/ExcelImportPreview';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Table from '../components/ui/Table';
import Dropdown from '../components/ui/Dropdown';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';

const parserDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';

export default function Grupos() {
  const gruposQuery = useGrupos();
  const centrosQuery = useCentros();
  const programasQuery = useProgramas();
  const centrosById = Object.fromEntries((centrosQuery.data || []).map((c) => [c.id, c]));
  const createGrupo = useCreateGrupo();
  const updateGrupo = useUpdateGrupo();
  const deleteGrupo = useDeleteGrupo();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', regional: '', centro_id: '', programa_id: '', director_id: '' });
  const [formErrors, setFormErrors] = useState({});
  const [confirm, setConfirm] = useState(null);

  const [detail, setDetail] = useState(null);
  const [addEstudiantesOpen, setAddEstudiantesOpen] = useState(false);
  const [addDocentesOpen, setAddDocentesOpen] = useState(false);
  const [pendingUserIds, setPendingUserIds] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const estudiantesQuery = useGrupoEstudiantes(detail?.id);
  const asignarEstudiantes = useAsignarEstudiantes();
  const quitarEstudiante = useQuitarEstudiante();
  const asignarDocentes = useAsignarDocentes();
  const importarExcel = useImportUsersExcel();
  const usersQuery = useUsers();

  const aprenderes =
    Array.isArray(usersQuery.data)
      ? usersQuery.data.filter((u) => (u.role || '') === 'Aprendiz' || u.role_id === 3)
      : [];
  const docentes =
    Array.isArray(usersQuery.data)
      ? usersQuery.data.filter((u) => (u.role || '') === 'Docente' || u.role_id === 2)
      : [];

  const memberIds = new Set((estudiantesQuery.data || []).map((m) => m.id ?? m.user_id));
  const docentesAsignados = new Set((detail?.docentes || []).map((d) => d.id ?? d.user_id));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const regionalesQuery = useRegionales();
  const centrosPorRegional = useCentrosByRegional(form.regional || undefined);

  const openCreate = () => {
    setForm({ nombre: '', descripcion: '', regional: '', centro_id: '', programa_id: '', director_id: '' });
    setFormErrors({});
    setCreateOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      nombre: row.nombre || '',
      descripcion: row.descripcion || '',
      regional: row.centro_id ? centrosById[row.centro_id]?.regional || '' : '',
      centro_id: row.centro_id || '',
      programa_id: row.programa_id || '',
      director_id: row.director_id || row.coordinador_id || '',
    });
    setFormErrors({});
    setEditing(row);
    setCreateOpen(true);
  };

  const save = async () => {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    else if (form.nombre.trim().length < 3) errs.nombre = 'Mínimo 3 caracteres';
    if (!editing && !form.regional) errs.regional = 'Selecciona la regional';
    if (!editing && !form.centro_id) errs.centro_id = 'Selecciona el centro';
    if (!editing && !form.programa_id) errs.programa_id = 'Selecciona el programa';
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      ...(form.descripcion.trim() && { descripcion: form.descripcion.trim() }),
      ...(form.centro_id && { centro_id: Number(form.centro_id) }),
      ...(form.programa_id && { programa_id: Number(form.programa_id) }),
      ...(form.director_id && { director_id: Number(form.director_id) }),
    };
    try {
      if (editing) {
        await updateGrupo.mutateAsync({ id: editing.id, ...payload });
        toast.success('Grupo actualizado');
        setEditing(null);
      } else {
        await createGrupo.mutateAsync(payload);
        toast.success('Grupo creado');
        setCreateOpen(false);
      }
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onDelete = async () => {
    try {
      await deleteGrupo.mutateAsync(confirm.id);
      toast.success('Grupo eliminado');
      setConfirm(null);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const availableAprenderes = aprenderes.filter((u) => !memberIds.has(u.id));
  const availableDocentes = docentes.filter((u) => !docentesAsignados.has(u.id));

  const onAsignarEstudiantes = async () => {
    if (!pendingUserIds.length) return;
    try {
      await asignarEstudiantes.mutateAsync({ id: detail.id, user_ids: pendingUserIds });
      toast.success(`${pendingUserIds.length} aprendiz(es) asignado(s)`);
      setAddEstudiantesOpen(false);
      setPendingUserIds([]);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onAsignarDocentes = async () => {
    if (!pendingUserIds.length) return;
    try {
      await asignarDocentes.mutateAsync({ id: detail.id, user_ids: pendingUserIds });
      toast.success(`${pendingUserIds.length} docente(s) asignado(s)`);
      setAddDocentesOpen(false);
      setPendingUserIds([]);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const togglePending = (id) =>
    setPendingUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const openImport = (grupo) => {
    setDetail(grupo);
    setImportFile(null);
    setImportResult(null);
    setPreview(null);
    setImportOpen(true);
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportResult(null);
    setPreview(null);
  };

  const onDownloadTemplate = async () => {
    try {
      await downloadImportTemplate(detail?.nombre || undefined);
      toast.success(detail?.nombre ? `Plantilla de la ficha ${detail.nombre} descargada` : 'Plantilla descargada');
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onImport = async () => {
    if (!importFile) {
      toast.error('Selecciona un archivo .xlsx');
      return;
    }
    if (!/\.xlsx$/i.test(importFile.name)) {
      toast.error('El archivo debe tener extensión .xlsx');
      return;
    }
    try {
      const resumen = await importarExcel.mutateAsync({ grupo_id: detail.id, file: importFile });
      setImportResult(resumen);
      if (resumen.creados > 0 || resumen.asignados > 0) {
        toast.success(`${resumen.creados} creado(s), ${resumen.asignados} asignado(s) al grupo`);
      } else if ((resumen.errores || []).length === 0) {
        toast.success('Sin cambios: los estudiantes ya estaban en el grupo');
      }
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const columns = [
    {
      key: 'nombre',
      label: 'Grupo',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-sena-ink">{r.nombre}</p>
            {r.descripcion && <p className="truncate text-xs text-slate-400">{r.descripcion}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'centro',
      label: 'Centro',
      render: (r) => (
        <span className="text-slate-600">
          {r.centro_id ? centrosById[r.centro_id]?.nombre || `Centro ${r.centro_id}` : '—'}
        </span>
      ),
    },
    {
      key: 'programa',
      label: 'Programa',
      render: (r) => <span className="text-slate-600">{r.programa_nombre || '—'}</span>,
    },
    {
      key: 'created_at',
      label: 'Creado',
      render: (r) => <span className="text-slate-600">{parserDate(r.created_at)}</span>,
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (r) => (
        <Dropdown
          items={[
            { label: 'Ver integrantes', icon: Users, onClick: () => { setDetail(r); } },
            { label: 'Añadir aprendices', icon: UserPlus, onClick: () => { setDetail(r); setPendingUserIds([]); setAddEstudiantesOpen(true); } },
            { label: 'Importar desde Excel', icon: Upload, onClick: () => openImport(r) },
            { label: 'Añadir docentes', icon: UserPlus, onClick: () => { setDetail(r); setPendingUserIds([]); setAddDocentesOpen(true); } },
            { label: 'Editar', icon: Pencil, onClick: () => openEdit(r) },
            { divider: true },
            { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setConfirm(r) },
          ]}
        />
      ),
    },
  ];

  const estudianteColumns = [
    {
      key: 'nombre',
      label: 'Aprendiz',
      render: (r) => (
        <span className="font-medium text-sena-ink">{r.nombres || r.name || r.username || r.email || '—'}</span>
      ),
    },
    {
      key: 'documento',
      label: 'Documento',
      render: (r) => <span className="text-slate-600">{r.numero_documento || r.document || '—'}</span>,
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (r) => (
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          title="Quitar del grupo"
          onClick={() => {
            const id = r.id ?? r.user_id;
            quitarEstudiante.mutateAsync({ grupo_id: detail.id, user_id: id })
              .then(() => toast.success('Estudiante retirado del grupo'))
              .catch((e) => toast.error(getErr(e)));
          }}
        >
          <UserMinus className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coordinación"
        title="Grupos"
        description="Organiza a aprendices y docentes en grupos para la gestión de asistencia."
        icon={Users}
        breadcrumb={[{ label: 'Inicio', to: '/panel' }, { label: 'Grupos' }]}
        actions={
          <div className="flex gap-2">
            <Button icon={Plus} onClick={openCreate}>
              Nuevo grupo
            </Button>
          </div>
        }
      />

      {gruposQuery.isError ? (
        <ErrorState
          title="No se pudo cargar los grupos"
          message={getErr(gruposQuery.error)}
          onRetry={gruposQuery.refetch}
        />
      ) : (
        <Table
          columns={columns}
          rows={gruposQuery.data || []}
          loading={gruposQuery.isLoading}
          emptyTitle="Sin grupos"
          emptyMessage="Crea el primer grupo para comenzar a organizar a los aprendices."
          keyField="id"
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? 'Editar grupo' : 'Nuevo grupo'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditing(null); setCreateOpen(false); }}>
              Cancelar
            </Button>
            <Button icon={editing ? Pencil : Plus} onClick={save} loading={createGrupo.isPending || updateGrupo.isPending}>
              {editing ? 'Guardar' : 'Crear grupo'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Número de ficha"
            value={form.nombre}
            onChange={set('nombre')}
            error={formErrors.nombre}
            placeholder="Ej. 2670001"
          />
          <Textarea
            label="Descripción"
            value={form.descripcion}
            onChange={set('descripcion')}
            placeholder="Detalles opcionales del grupo"
            rows={3}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Regional</span>
            <select
              value={form.regional}
              onChange={(e) => setForm((f) => ({ ...f, regional: e.target.value, centro_id: '' }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sena-green"
            >
              <option value="">Selecciona una regional</option>
              {(regionalesQuery.data || []).map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            {formErrors.regional && <p className="mt-1 text-xs text-red-600">{formErrors.regional}</p>}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Centro de formación</span>
            <select
              value={form.centro_id}
              onChange={set('centro_id')}
              disabled={!form.regional}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sena-green disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {!form.regional
                  ? 'Selecciona primero una regional'
                  : (centrosPorRegional.data || []).length === 0
                    ? 'Esta regional no tiene centros disponibles.'
                    : 'Selecciona un centro'}
              </option>
              {(centrosPorRegional.data || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.codigo})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Programa de formación</span>
            <select
              value={form.programa_id}
              onChange={set('programa_id')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sena-green"
            >
              <option value="">Selecciona un programa</option>
              {(programasQuery.data || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.level ? ` · ${p.level}` : ''}
                </option>
              ))}
            </select>
            {formErrors.programa_id && <p className="mt-1 text-xs text-red-600">{formErrors.programa_id}</p>}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Director (opcional)</span>
            <select
              value={form.director_id}
              onChange={set('director_id')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sena-green"
            >
              <option value="">Sin director asignado</option>
              {(Array.isArray(usersQuery.data) ? usersQuery.data : [])
                .filter((u) => u.role_id === 1 || u.role_id === 2 || u.role === 'Coordinador' || u.role === 'Docente')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombres || u.name || u.username} · {u.role || (u.role_id === 1 ? 'Coordinador' : 'Docente')}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        open={!!detail && !addEstudiantesOpen && !addDocentesOpen && !importOpen}
        onClose={() => setDetail(null)}
        title={`Integrantes · ${detail?.nombre || ''}`}
        description="Aprendices vinculados a este grupo."
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" icon={Upload} onClick={() => openImport(detail)}>
              Importar Excel
            </Button>
            <Button size="sm" variant="outline" icon={UserPlus} onClick={() => { setPendingUserIds([]); setAddEstudiantesOpen(true); }}>
              Añadir aprendices
            </Button>
          </div>
          {estudiantesQuery.isError ? (
            <p className="text-sm text-red-600">{getErr(estudiantesQuery.error)}</p>
          ) : (
            <Table
              columns={estudianteColumns}
              rows={estudiantesQuery.data || []}
              loading={estudiantesQuery.isLoading}
              emptyTitle="Sin integrantes"
              emptyMessage="Añade aprendices a este grupo."
              keyField="id"
            />
          )}
        </div>
      </Modal>

      <Modal
        open={addEstudiantesOpen}
        onClose={() => { setAddEstudiantesOpen(false); setPendingUserIds([]); }}
        title="Añadir aprendices"
        description="Selecciona los aprendices que aún no forman parte del grupo."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAddEstudiantesOpen(false); setPendingUserIds([]); }}>
              Cancelar
            </Button>
            <Button icon={UserPlus} onClick={onAsignarEstudiantes} loading={asignarEstudiantes.isPending} disabled={!pendingUserIds.length}>
              Asignar {pendingUserIds.length > 0 ? `(${pendingUserIds.length})` : ''}
            </Button>
          </>
        }
      >
        {availableAprenderes.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No hay aprendices disponibles"
            message="Todos los aprendices ya están en este grupo o no existen cuentas con rol Aprendiz."
          />
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto scrollbar-thin">
            {availableAprenderes.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-sena-green hover:bg-sena-tint-50"
              >
                <input
                  type="checkbox"
                  checked={pendingUserIds.includes(u.id)}
                  onChange={() => togglePending(u.id)}
                  className="h-4 w-4 shrink-0 accent-sena-green"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sena-ink">{u.nombres || u.name || u.username}</p>
                  <p className="truncate text-xs text-slate-400">
                    {u.numero_documento || u.document || u.email}
                  </p>
                </div>
                <Badge variant="slate">{u.email ? '@' + (u.username || u.email) : ''}</Badge>
              </label>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={addDocentesOpen}
        onClose={() => { setAddDocentesOpen(false); setPendingUserIds([]); }}
        title="Añadir docentes"
        description="Selecciona los docentes que impartirán en este grupo."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAddDocentesOpen(false); setPendingUserIds([]); }}>
              Cancelar
            </Button>
            <Button icon={UserPlus} onClick={onAsignarDocentes} loading={asignarDocentes.isPending} disabled={!pendingUserIds.length}>
              Asignar {pendingUserIds.length > 0 ? `(${pendingUserIds.length})` : ''}
            </Button>
          </>
        }
      >
        {availableDocentes.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No hay docentes disponibles"
            message="Todos los docentes ya están en este grupo o no existen cuentas con rol Docente."
          />
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto scrollbar-thin">
            {availableDocentes.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-sena-green hover:bg-sena-tint-50"
              >
                <input
                  type="checkbox"
                  checked={pendingUserIds.includes(u.id)}
                  onChange={() => togglePending(u.id)}
                  className="h-4 w-4 shrink-0 accent-sena-green"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sena-ink">{u.nombres || u.name || u.username}</p>
                  <p className="truncate text-xs text-slate-400">
                    {u.numero_documento || u.document || u.email}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={importOpen}
        onClose={closeImport}
        title="Importar estudiantes desde Excel"
        description={`Los estudiantes se crearán con rol Aprendiz y se matricularán en "${detail?.nombre || ''}".`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeImport}>
              {importResult ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!importResult && (
              <Button
                icon={Upload}
                onClick={onImport}
                loading={importarExcel.isPending}
                disabled={!importFile || previewLoading || !preview?.rows?.length || (preview?.faltantes || []).length > 0}
              >
                Confirmar e importar
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-sena-tint-200 bg-sena-tint-50 p-3 text-xs text-slate-600">
            <p className="mb-1 font-semibold text-sena-green-dark">Columnas esperadas del Excel</p>
            <p>
              <span className="font-medium">Obligatorias:</span> nombres, apellidos, numero_documento, email
              <span className="font-medium"> · Opcionales:</span> tipo_documento (CC, CE, TI, PEP), tipo_sangre (O+, O-, A+, A-, B+, B-, AB+, AB-)
            </p>
            <p className="mt-1">También se aceptan: Documento, Correo, Nombre, Apellido. La contraseña inicial de cada cuenta nueva será su número de documento. Los usuarios existentes se reutilizan sin duplicarse.</p>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" icon={Download} onClick={onDownloadTemplate}>
              Plantilla
            </Button>
          </div>
          <ExcelImportPreview
            onReady={({ file, preview: p, previewLoading: l }) => {
              setImportFile(file);
              setPreview(p);
              setPreviewLoading(l);
              if (!file) setImportResult(null);
            }}
          />
          {importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-sena-ink">{importResult.procesados}</p>
                  <p className="text-xs text-slate-400">Procesados</p>
                </div>
                <div className="rounded-xl bg-sena-tint-50 p-3 text-center">
                  <p className="text-xl font-bold text-sena-green-dark">{importResult.creados}</p>
                  <p className="text-xs text-slate-400">Creados</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-sena-ink">{importResult.existentes}</p>
                  <p className="text-xs text-slate-400">Ya existían</p>
                </div>
                <div className="rounded-xl bg-sena-tint-50 p-3 text-center">
                  <p className="text-xl font-bold text-sena-green-dark">{importResult.asignados}</p>
                  <p className="text-xs text-slate-400">Asignados</p>
                </div>
              </div>
              {(importResult.errores || []).length > 0 && (
                <div className="overflow-hidden rounded-xl border border-red-100">
                  <p className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    Filas con errores ({importResult.errores.length})
                  </p>
                  <div className="max-h-48 space-y-1 overflow-y-auto p-3">
                    {importResult.errores.map((e, i) => (
                      <p key={i} className="text-xs text-slate-600">
                        <span className="font-semibold text-red-600">Fila {e.fila}</span>
                        {e.documento ? <span className="font-mono"> · {e.documento}</span> : null}
                        {` — ${e.error}`}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        loading={deleteGrupo.isPending}
        title="Eliminar grupo"
        description={`¿Seguro que quieres eliminar "${confirm?.nombre}"? También se desvinculará a sus integrantes.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
