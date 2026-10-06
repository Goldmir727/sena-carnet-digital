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
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getErr } from '../lib/errors';
import { useUsers, useUsersSearch, useCreateUser, useUpdateUser, useDeactivateUser, useUploadPhoto, useImportUsersExcel, downloadImportTemplate } from '../api/users';
import { useRoles } from '../api/roles';
import ExcelImportPreview from '../components/import/ExcelImportPreview';
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

const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const EMPTY_FORM = {
  username: '',
  email: '',
  password: '',
  role_id: '',
  nombres: '',
  apellidos: '',
  tipo_documento: '',
  numero_documento: '',
  tipo_sangre: '',
};

function initials(nombres, apellidos, email) {
  const a = (nombres || '')[0] || '';
  const b = (apellidos || '')[0] || (email || '')[0] || '';
  return `${a}${b}`.toUpperCase();
}

export default function Usuarios() {
  const usersQuery = useUsers(estadoTab);
  const allQueryForCards = useUsers('todos');
  const rolesQuery = useRoles();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const searchQuery = useUsersSearch(debounced, estadoTab);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const uploadPhoto = useUploadPhoto();
  const importExcel = useImportUsersExcel();
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [rolTab, setRolTab] = useState('Todos');
  const [estadoTab, setEstadoTab] = useState('activos');
  const [reactivarRow, setReactivarRow] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const roleName = (u) => u.role || u.rol || ROLE_ID_NAME[u.role_id] || '';

  const TAB_ORDER = ['Aprendiz', 'Docente', 'Funcionario', 'Validador', 'Coordinador'];
  const TAB_LABEL = {
    Aprendiz: 'Aprendices',
    Docente: 'Docentes',
    Funcionario: 'Funcionarios',
    Validador: 'Validadores',
    Coordinador: 'Coordinadores',
  };
  const roleNames = Array.isArray(rolesQuery.data) && rolesQuery.data.length
    ? rolesQuery.data.map((r) => r.name)
    : Object.values(ROLE_ID_NAME);
  const tabs = ['Todos', ...TAB_ORDER.filter((n) => roleNames.includes(n))];

  const baseList = q.trim() ? searchQuery.data : usersQuery.data;
  const list = rolTab === 'Todos' ? baseList : (baseList || []).filter((u) => roleName(u) === rolTab);
  const displayRows = list || [];

  const activos = Array.isArray(allQueryForCards.data)
    ? allQueryForCards.data.filter((u) => u.is_active === 1 || u.is_active === true || ['ACTIVE', 'ACTIVO'].includes(u?.user_status)).length
    : 0;
  const suspendidos = Array.isArray(allQueryForCards.data)
    ? allQueryForCards.data.filter((u) => !(u.is_active === 1 || u.is_active === true || ['ACTIVE', 'ACTIVO'].includes(u?.user_status))).length
    : 0;
  const docentes = Array.isArray(allQueryForCards.data)
    ? allQueryForCards.data.filter((u) => (u.role || ROLE_ID_NAME[u.role_id]) === 'Docente').length
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
      tipo_sangre: row.tipo_sangre || row.blood_type || '',
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
      ...(form.tipo_sangre && { tipo_sangre: form.tipo_sangre }),
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
      ...(form.tipo_sangre ? { tipo_sangre: form.tipo_sangre } : { tipo_sangre: null }),
    };
    try {
      await updateUser.mutateAsync({ id: editing.id, ...payload });
      toast.success('Usuario actualizado');
      setEditing(null);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const onReactivar = async () => {
    try {
      await updateUser.mutateAsync({ id: reactivarRow.id, is_active: true });
      toast.success('Usuario reactivado');
      setReactivarRow(null);
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

  const onImportUsers = () => {
    if (!importFile) {
      toast.error('Selecciona un archivo .xlsx');
      return;
    }
    importExcel.mutate({ file: importFile }, {
      onSuccess: (r) => {
        setImportResult(r);
        toast.success(`${r.insertados} insertados, ${r.duplicados} duplicados, ${r.errores} errores`);
      },
      onError: (err) => toast.error(getErr(err)),
    });
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
            (r.is_active === 1 || r.is_active === true || ['ACTIVE', 'ACTIVO'].includes(r?.user_status))
              ? { label: 'Suspender', icon: UserX, danger: true, onClick: () => setConfirmRow(r) }
              : { label: 'Reactivar', icon: UserPlus, onClick: () => setReactivarRow(r) },
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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setImportResult(null); setImportFile(null); setImportPreview(null); setImportOpen(true); }}>
              Importar Excel
            </Button>
            <Button icon={UserPlus} onClick={openCreate}>
              Nuevo usuario
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Usuarios registrados" value={Array.isArray(allQueryForCards.data) ? allQueryForCards.data.length : '—'} accent="green" />
        <StatCard icon={UserIcon} label="Cuentas activas" value={Array.isArray(allQueryForCards.data) ? activos : '—'} accent="blue" hint="Calculado sobre todos los usuarios" />
        <StatCard icon={UserX} label="Suspendidos" value={Array.isArray(allQueryForCards.data) ? suspendidos : '—'} accent="red" />
        <StatCard icon={IdCard} label="Docentes" value={Array.isArray(allQueryForCards.data) ? docentes : '—'} accent="yellow" />
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

        <div className="flex flex-wrap gap-2">
          {['todos', 'activos', 'suspendidos'].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEstadoTab(e)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                estadoTab === e
                  ? 'border-sena-green bg-sena-green text-white shadow-soft'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sena-green hover:text-sena-green-dark'
              }`}
            >
              {e === 'todos' ? 'Todos' : e === 'activos' ? 'Activos' : 'Suspendidos'}
            </button>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-slate-200 sm:inline-block" />
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setRolTab(t)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                rolTab === t
                  ? 'border-sena-green bg-sena-green text-white shadow-soft'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sena-green hover:text-sena-green-dark'
              }`}
            >
              {t === 'Todos' ? 'Todos' : TAB_LABEL[t] || t}
            </button>
          ))}
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
          <Select label="Tipo de sangre" options={TIPOS_SANGRE} value={form.tipo_sangre} onChange={set('tipo_sangre')} placeholder="Sin especificar" hint="Opcional. Aparece impreso en el carnet." />
          {editing ? (
            <Input label="Centro de formación" value={editing.centro_nombre || '—'} disabled hint="Se define por el grupo/ficha del usuario" />
          ) : null}
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
        title="Suspender usuario"
        description={`¿Deseas suspender a ${confirmRow?.nombres || confirmRow?.name || confirmRow?.username}? Perderá el acceso al sistema y a su carnet digital.`}
        confirmLabel="Suspender"
      />
      <ConfirmDialog
        open={!!reactivarRow}
        onClose={() => setReactivarRow(null)}
        onConfirm={onReactivar}
        loading={updateUser.isPending}
        title="Reactivar usuario"
        description={`¿Deseas reactivar a ${reactivarRow?.nombres || reactivarRow?.name || reactivarRow?.username}? Recuperará el acceso al sistema y a su carnet digital.`}
        confirmLabel="Reactivar"
      />

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar usuarios desde Excel"
        description="Columnas: Documento, Correo, Nombres, Apellidos, Tipo, Usuario, Clave, Rol. Sin rol, se crea como Aprendiz."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              {importResult ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!importResult && (
              <Button
                icon={UserPlus}
                onClick={onImportUsers}
                loading={importExcel.isPending}
                disabled={!importFile || importLoading || !importPreview?.rows?.length || (importPreview?.faltantes || []).length > 0}
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
              <span className="font-medium"> · Opcionales:</span> tipo_documento, tipo_sangre, ficha
            </p>
            <p className="mt-1">También se aceptan alias: Documento, Correo, Nombre, Apellido. La columna Rol se ignora en el flujo de aprendices: siempre se crean con rol Aprendiz. La columna Ficha (también numero_ficha) busca la ficha por su número y matricula al aprendiz automáticamente. La contraseña inicial será el número de documento si no indicas Clave. Los duplicados por documento/correo se omiten.</p>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" icon={Download} onClick={async () => { try { await downloadImportTemplate(); toast.success('Plantilla descargada'); } catch (e) { toast.error(getErr(e)); } }}>
              Plantilla
            </Button>
          </div>
          <ExcelImportPreview
            onReady={({ file, preview, previewLoading }) => {
              setImportFile(file);
              setImportPreview(preview);
              setImportLoading(previewLoading);
              if (!file) setImportResult(null);
            }}
          />
          {importExcel.isPending && <p className="text-sm text-slate-500">Procesando archivo…</p>}
          {importResult && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p>Procesados: <strong>{importResult.procesados}</strong></p>
              <p>Insertados: <strong>{importResult.insertados}</strong></p>
              <p>Duplicados: <strong>{importResult.duplicados}</strong></p>
              <p>Errores: <strong>{importResult.errores}</strong></p>
              {(importResult.detalle || []).filter((d) => d.estado !== 'insertado').slice(0, 10).map((d, i) => (
                <p key={i} className="truncate text-xs text-slate-400">
                  Fila {d.fila}: {d.estado}{d.mensaje ? ` — ${d.mensaje}` : ''} ({d.documento || '—'})
                </p>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}