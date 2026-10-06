import { useState } from 'react';
import { Building2, Plus, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCentros, useCreateCentro, useUpdateCentro } from '../api/centros';
import { getErr } from '../lib/errors';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import ErrorState from '../components/ui/ErrorState';
import Dropdown from '../components/ui/Dropdown';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Badge from '../components/ui/Badge';

const EMPTY_FORM = {
  nombre: '',
  codigo: '',
  regional: '',
  ciudad: '',
  direccion: '',
  telefono: '',
  email: '',
};

export default function Centros() {
  const centrosQuery = useCentros();
  const createCentro = useCreateCentro();
  const updateCentro = useUpdateCentro();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [statusRow, setStatusRow] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target ? e.target.value : e }));

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      nombre: row.nombre || '',
      codigo: row.codigo || '',
      regional: row.regional || '',
      ciudad: row.ciudad || '',
      direccion: row.direccion || '',
      telefono: row.telefono || '',
      email: row.email || '',
    });
    setFormErrors({});
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setOpen(true);
  };

  const save = async () => {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!form.codigo.trim()) errs.codigo = 'El código es obligatorio';
    if (!form.regional.trim()) errs.regional = 'La regional es obligatoria';
    if (!form.ciudad.trim()) errs.ciudad = 'La ciudad es obligatoria';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Correo inválido';
    }
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim(),
      regional: form.regional.trim(),
      ciudad: form.ciudad.trim(),
      ...(form.direccion.trim() && { direccion: form.direccion.trim() }),
      ...(form.telefono.trim() && { telefono: form.telefono.trim() }),
      ...(form.email.trim() && { email: form.email.trim() }),
    };
    try {
      if (editing) {
        await updateCentro.mutateAsync({ id: editing.id, ...payload });
        toast.success('Centro actualizado correctamente');
      } else {
        await createCentro.mutateAsync(payload);
        toast.success('Centro creado correctamente');
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      setFormErrors({});
      setEditing(null);
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  const columns = [
    {
      key: 'nombre',
      label: 'Centro',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-sena-ink">{r.nombre || '—'}</p>
            <p className="truncate text-xs text-slate-400">
              {[r.codigo, r.regional].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'ciudad',
      label: 'Ciudad',
      render: (r) => <span className="text-slate-600">{r.ciudad || '—'}</span>,
    },
    {
      key: 'contacto',
      label: 'Contacto',
      render: (r) => (
        <span className="text-slate-600">
          {[r.telefono, r.email].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (r) => (
        r.status === 'activo' ? <Badge variant="green">Activo</Badge> : <Badge variant="slate">Inactivo</Badge>
      ),
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (r) => (
        <Dropdown
          items={[
            { label: 'Editar', icon: Pencil, onClick: () => openEdit(r) },
            { divider: true },
            r.status === 'activo'
              ? { label: 'Desactivar', icon: null, danger: true, onClick: () => setStatusRow({ centro: r, target: 'inactivo' }) }
              : { label: 'Activar', icon: null, onClick: () => setStatusRow({ centro: r, target: 'activo' }) },
          ]}
        />
      ),
    },
  ];

  const isBackendMissing = centrosQuery.error?.response?.status === 404;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coordinación"
        title="Centros de formación"
        description="Gestiona los centros a los que se vinculan los grupos y aprendices."
        icon={Building2}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Centros' }]}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Nuevo centro
          </Button>
        }
      />

      {centrosQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los centros"
          message={
            isBackendMissing
              ? 'El backend aún no expone GET /centros/ (ticket B1). El formulario ya está listo para cuando lo activen.'
              : getErr(centrosQuery.error)
          }
          onRetry={centrosQuery.refetch}
        />
      ) : (
        <Table
          columns={columns}
          rows={centrosQuery.data || []}
          loading={centrosQuery.isLoading}
          emptyTitle="Sin centros"
          emptyMessage="Crea el primer centro de formación para vincularlo a los grupos."
          keyField="id"
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar centro de formación' : 'Nuevo centro de formación'}
        description="Los grupos (fichas) se vincularán a este centro."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button icon={editing ? Pencil : Plus} onClick={save} loading={createCentro.isPending || updateCentro.isPending}>
              {editing ? 'Guardar cambios' : 'Crear centro'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre del centro" value={form.nombre} onChange={set('nombre')} error={formErrors.nombre} placeholder="Ej. Centro de Comercio y Servicios" />
          <Input label="Código" value={form.codigo} onChange={set('codigo')} error={formErrors.codigo} placeholder="Ej. 9506" />
          <Input label="Regional" value={form.regional} onChange={set('regional')} error={formErrors.regional} placeholder="Ej. Regional Bolívar" />
          <Input label="Ciudad" value={form.ciudad} onChange={set('ciudad')} error={formErrors.ciudad} placeholder="Ej. Cartagena" />
          <Input label="Dirección" value={form.direccion} onChange={set('direccion')} placeholder="Opcional" />
          <Input label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="Opcional" />
          <Input label="Correo" type="email" value={form.email} onChange={set('email')} error={formErrors.email} placeholder="Opcional" />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!statusRow}
        onClose={() => setStatusRow(null)}
        onConfirm={async () => {
          try {
            await updateCentro.mutateAsync({ id: statusRow.centro.id, status: statusRow.target });
            toast.success(statusRow.target === 'activo' ? 'Centro activado' : 'Centro desactivado');
            setStatusRow(null);
          } catch (e) {
            toast.error(getErr(e));
          }
        }}
        loading={updateCentro.isPending}
        title={statusRow?.target === 'activo' ? 'Activar centro' : 'Desactivar centro'}
        description={
          statusRow?.target === 'activo'
            ? `¿Deseas activar el centro ${statusRow?.centro?.nombre}?`
            : `¿Deseas desactivar el centro ${statusRow?.centro?.nombre}? Los grupos asociados dejarán de poder usarlo, pero sus datos e historial se conservan.`
        }
        confirmLabel={statusRow?.target === 'activo' ? 'Activar' : 'Desactivar'}
      />
    </div>
  );
}
