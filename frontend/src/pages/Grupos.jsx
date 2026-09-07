import { useState } from 'react';
import { Users, Plus, Pencil, Trash2, UserPlus, UserMinus, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useGrupos,
  useCreateGrupo,
  useUpdateGrupo,
  useDeleteGrupo,
  useGrupoEstudiantes,
  useAsignarEstudiantes,
  useQuitarEstudiante,
  useAsignarDocentes,
} from '../api/grupos';
import { useUsers } from '../api/users';
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

const getErr = (err) => err.response?.data?.detail || err.message || 'Error de conexión con el servidor';

const parserDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';

export default function Grupos() {
  const gruposQuery = useGrupos();
  const createGrupo = useCreateGrupo();
  const updateGrupo = useUpdateGrupo();
  const deleteGrupo = useDeleteGrupo();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [formErrors, setFormErrors] = useState({});
  const [confirm, setConfirm] = useState(null);

  const [detail, setDetail] = useState(null);
  const [addEstudiantesOpen, setAddEstudiantesOpen] = useState(false);
  const [addDocentesOpen, setAddDocentesOpen] = useState(false);
  const [pendingUserIds, setPendingUserIds] = useState([]);

  const estudiantesQuery = useGrupoEstudiantes(detail?.id);
  const asignarEstudiantes = useAsignarEstudiantes();
  const quitarEstudiante = useQuitarEstudiante();
  const asignarDocentes = useAsignarDocentes();
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

  const openCreate = () => {
    setForm({ nombre: '', descripcion: '' });
    setFormErrors({});
    setCreateOpen(true);
  };

  const openEdit = (row) => {
    setForm({ nombre: row.nombre || '', descripcion: row.descripcion || '' });
    setFormErrors({});
    setEditing(row);
  };

  const save = async () => {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    else if (form.nombre.trim().length < 3) errs.nombre = 'Mínimo 3 caracteres';
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      ...(form.descripcion.trim() && { descripcion: form.descripcion.trim() }),
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
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Grupos' }]}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Nuevo grupo
          </Button>
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
            <Button variant="secondary" onClick={() => (editing ? setEditing(null) : setCreateOpen(false))}>
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
            label="Nombre del grupo"
            value={form.nombre}
            onChange={set('nombre')}
            error={formErrors.nombre}
            placeholder="Ej. Ficha 2894567"
          />
          <Textarea
            label="Descripción"
            value={form.descripcion}
            onChange={set('descripcion')}
            placeholder="Detalles opcionales del grupo"
            rows={3}
          />
        </div>
      </Modal>

      <Modal
        open={!!detail && !addEstudiantesOpen && !addDocentesOpen}
        onClose={() => setDetail(null)}
        title={`Integrantes · ${detail?.nombre || ''}`}
        description="Aprendices vinculados a este grupo."
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
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