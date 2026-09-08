import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Pencil,
  UserX,
  Camera,
  Mail,
  Lock,
  IdCard,
  User as UserIcon,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getErr } from '../lib/errors';
import { useUsers, useUsersSearch, useCreateUser, useUpdateUser, useDeactivateUser, useUploadPhoto } from '../api/users';
import { useRoles } from '../api/roles';
import { ROLE_ID_NAME, ROLE_BADGE_STYLES } from '../constants/roles';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Table from '../components/ui/Table';
import Dropdown from '../components/ui/Dropdown';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';

const MEDIA_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function photoUrl(foto) {
  if (!foto) return null;
  if (/^https?:\/\//i.test(foto)) return foto;
  const clean = foto.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${MEDIA_BASE}/${clean}`;
}

function Avatar({ initials, size = 'md', src }) {
  const sizes = { md: 'h-10 w-10 text-sm', xl: 'h-20 w-20 text-2xl' };
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className={`shrink-0 rounded-full bg-sena-green object-cover ring-2 ring-sena-tint-100 ${sizes[size]}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-sena-green font-bold text-white shadow-soft ${sizes[size]}`}
    >
      {initials || '?'}
    </div>
  );
}

const TIPOS_DOC = ['CC', 'CE', 'TI', 'PEP'];

const EMPTY_FORM = {
  username: '',
  email: '',
  password: '',
  role_id: '',
  nombres: '',
  apellidos: '',
  tipo_documento: '',
  numero_documento: '',
};

function initials(nombres, apellidos, email) {
  const a = (nombres || '')[0] || '';
  const b = (apellidos || '')[0] || (email || '')[0] || '';
  return `${a}${b}`.toUpperCase();
}

export default function Usuarios() {
  const usersQuery = useUsers();
  const rolesQuery = useRoles();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const searchQuery = useUsersSearch(debounced);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const uploadPhoto = useUploadPhoto();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const list = q.trim() ? searchQuery.data : usersQuery.data;
  const displayRows = list || [];

  const activos = Array.isArray(usersQuery.data)
    ? usersQuery.data.filter((u) => u.is_active === 1 || u.is_active === true || ['ACTIVE', 'ACTIVO'].includes(u?.user_status)).length
    : 0;
  const docentes = Array.isArray(usersQuery.data)
    ? usersQuery.data.filter((u) => (u.role || ROLE_ID_NAME[u.role_id]) === 'Docente').length
    : 0;

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [photoTarget, setPhotoTarget] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confirmRow, setConfirmRow] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const closePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhotoFile(null);
    setPhotoTarget(null);
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0] || null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setPhotoFile(file);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target ? e.target.value : e }));

  const validate = (values) => {
    const errs = {};
    if (!values.username.trim()) errs.username = 'El usuario es obligatorio';
    if (!values.email.trim()) errs.email = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errs.email = 'Correo inválido';
    if (!values.password) errs.password = 'La contraseña es obligatoria';
    if (!values.role_id) errs.role_id = 'Selecciona el rol';
    return errs;
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setCreateOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      username: row.username || '',
      email: row.email || '',
      password: '',
      role_id: row.role_id ? String(row.role_id) : '',
      nombres: row.nombres || row.name || '',
      apellidos: row.apellidos || row.last_name || '',
      tipo_documento: row.tipo_documento || row.document_type || '',
      numero_documento: row.numero_documento || row.document || '',
    });
    setFormErrors({});
    setEditing(row);
    setCreateOpen(true);
  };

  const onCreate = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      role_id: Number(form.role_id),
      ...(form.nombres.trim() && { nombres: form.nombres.trim() }),
      ...(form.apellidos.trim() && { apellidos: form.apellidos.trim() }),
      ...(form.tipo_documento && { tipo_documento: form.tipo_documento }),
      ...(form.numero_documento.trim() && { numero_documento: form.numero_documento.trim() }),
    };
    try {
      await createUser.mutateAsync(payload);
      toast.success('Usuario creado correctamente');
      setCreateOpen(false);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onUpdate = async () => {
    const payload = {
      email: form.email.trim(),
      role_id: Number(form.role_id),
      ...(form.nombres.trim() && { nombres: form.nombres.trim() }),
      ...(form.apellidos.trim() && { apellidos: form.apellidos.trim() }),
      ...(form.tipo_documento && { tipo_documento: form.tipo_documento }),
      ...(form.numero_documento.trim() && { numero_documento: form.numero_documento.trim() }),
      ...(form.password && { password: form.password }),
    };
    try {
      await updateUser.mutateAsync({ id: editing.id, ...payload });
      toast.success('Usuario actualizado');
      setEditing(null);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onDeactivate = async () => {
    try {
      await deactivateUser.mutateAsync(confirmRow.id);
      toast.success('Usuario desactivado');
      setConfirmRow(null);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onUploadPhoto = async () => {
    if (!photoFile) {
      toast.error('Selecciona una imagen');
      return;
    }
    try {
      await uploadPhoto.mutateAsync({ id: photoTarget.id, file: photoFile });
      toast.success('Foto actualizada');
      closePhoto();
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const roleOptions = Array.isArray(rolesQuery.data) ? rolesQuery.data.map((r) => ({ value: r.id, label: r.name })) : [];

  const columns = [
    {
      key: 'nombre',
      label: 'Usuario',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="md"
            src={photoUrl(r.foto_perfil)}
            initials={initials(r.nombres || r.name, r.apellidos || r.last_name, r.email || r.username)}
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-sena-ink">
              {r.nombres || r.name || r.username || '—'}
            </p>
            <p className="truncate text-xs text-slate-400">@{r.username || r.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Correo',
      render: (r) => <span className="text-slate-600">{r.email || '—'}</span>,
    },
    {
      key: 'documento',
      label: 'Documento',
      render: (r) => {
        const doc = r.numero_documento || r.document;
        const tipo = r.tipo_documento || r.document_type;
        if (!doc) return <span className="text-slate-400">—</span>;
        return (
          <span className="text-slate-600">
            {tipo ? `${tipo} ` : ''}
            {doc}
          </span>
        );
      },
    },
    {
      key: 'rol',
      label: 'Rol',
      render: (r) => {
        const name = r.role || r.rol || ROLE_ID_NAME[r.role_id] || '—';
        return (
          <Badge className={ROLE_BADGE_STYLES[name]} variant="solid">
            {name}
          </Badge>
        );
      },
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (r) => {
        const active = r.is_active === 1 || r.is_active === true || ['ACTIVE', 'ACTIVO'].includes(r?.user_status);
        return active ? (
          <Badge variant="green">Activo</Badge>
        ) : (
          <Badge variant="slate">Inactivo</Badge>
        );
      },
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (r) => (
        <Dropdown
          items={[
            { label: 'Editar', icon: Pencil, onClick: () => openEdit(r) },
            { label: 'Cambiar foto', icon: Camera, onClick: () => setPhotoTarget(r) },
            { divider: true },
            { label: 'Desactivar', icon: UserX, danger: true, onClick: () => setConfirmRow(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Gestiona las cuentas de aprendices, docentes y colaboradores del sistema."
        icon={Users}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Usuarios' }]}
        actions={
          <Button icon={UserPlus} onClick={openCreate}>
            Nuevo usuario
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Usuarios registrados" value={Array.isArray(usersQuery.data) ? usersQuery.data.length : '—'} accent="green" />
        <StatCard icon={UserIcon} label="Cuentas activas" value={Array.isArray(usersQuery.data) ? activos : '—'} accent="blue" hint="Calculado sobre los datos del servidor" />
        <StatCard icon={IdCard} label="Docentes" value={Array.isArray(usersQuery.data) ? docentes : '—'} accent="yellow" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, documento o correo"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-sena-ink shadow-soft placeholder:text-slate-400 focus:border-sena-green focus:outline-none focus:ring-2 focus:ring-sena-green/30"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {q.trim() ? `Resultados de "${q.trim()}"` : `${displayRows.length} usuarios`}
          </p>
        </div>

        {usersQuery.isError ? (
          <ErrorState
            title="No se pudieron cargar los usuarios"
            message={getErr(usersQuery.error)}
            onRetry={usersQuery.refetch}
          />
        ) : (
          <Table
            columns={columns}
            rows={displayRows}
            loading={usersQuery.isLoading || searchQuery.isLoading}
            emptyTitle="Sin usuarios"
            emptyMessage="No hay usuarios que coincidan con tu búsqueda."
            keyField="id"
          />
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        description={
          editing
            ? 'Actualiza los datos de la cuenta. Deja la contraseña vacía para mantener la actual.'
            : 'Crea una cuenta nueva para el sistema carnet digital.'
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditing(null); setCreateOpen(false); }}>
              Cancelar
            </Button>
            <Button
              icon={editing ? Pencil : UserPlus}
              onClick={editing ? onUpdate : onCreate}
              loading={editing ? updateUser.isPending : createUser.isPending}
            >
              {editing ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Usuario" value={form.username} onChange={set('username')} error={formErrors.username} disabled={!!editing} hint={editing ? 'No se puede cambiar' : 'Usa el documento o un apodo único'} />
          <Input label="Correo electrónico" type="email" icon={Mail} value={form.email} onChange={set('email')} error={formErrors.email} />
          <Input label={editing ? 'Nueva contraseña' : 'Contraseña'} type="password" icon={Lock} value={form.password} onChange={set('password')} error={formErrors.password} hint={editing ? 'Opcional en edición' : 'Mínimo 6 caracteres'} />
          <Select label="Rol" options={roleOptions} value={form.role_id} onChange={set('role_id')} error={formErrors.role_id} placeholder="Selecciona el rol" />
          <Input label="Nombres" value={form.nombres} onChange={set('nombres')} />
          <Input label="Apellidos" value={form.apellidos} onChange={set('apellidos')} />
          <Select label="Tipo de documento" options={TIPOS_DOC} value={form.tipo_documento} onChange={set('tipo_documento')} placeholder="Selecciona" allowEmpty={false} />
          <Input label="Número de documento" value={form.numero_documento} onChange={set('numero_documento')} />
        </div>
      </Modal>

      <Modal
        open={!!photoTarget}
        onClose={closePhoto}
        title="Foto de perfil"
        description="Esta foto aparece impresa en el carnet digital."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closePhoto}>
              Cancelar
            </Button>
            <Button icon={Camera} onClick={onUploadPhoto} loading={uploadPhoto.isPending} disabled={!photoFile}>
              Subir foto
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4">
          {previewUrl || photoUrl(photoTarget?.foto_perfil) ? (
            <img
              src={previewUrl || photoUrl(photoTarget?.foto_perfil)}
              alt={initials(photoTarget?.nombres || photoTarget?.name, photoTarget?.apellidos || photoTarget?.last_name, photoTarget?.email)}
              className="h-24 w-24 rounded-full object-cover shadow-soft ring-4 ring-sena-tint-100"
            />
          ) : (
            <Avatar
              size="xl"
              initials={initials(photoTarget?.nombres || photoTarget?.name, photoTarget?.apellidos || photoTarget?.last_name, photoTarget?.email)}
            />
          )}
          {previewUrl ? (
            <p className="text-xs font-medium text-sena-green-dark">Vista previa de la imagen seleccionada</p>
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-sena-tint-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sena-green-dark hover:file:bg-sena-tint-200"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmRow}
        onClose={() => setConfirmRow(null)}
        onConfirm={onDeactivate}
        loading={deactivateUser.isPending}
        title="Desactivar usuario"
        description={`¿Seguro que quieres desactivar a ${confirmRow?.nombres || confirmRow?.name || confirmRow?.username}? Perderá el acceso al sistema y a su carnet digital.`}
        confirmLabel="Desactivar"
      />
    </div>
  );
}