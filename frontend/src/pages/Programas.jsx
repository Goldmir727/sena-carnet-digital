import { useState } from 'react';
import { BookOpen, Plus, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProgramas, useCreatePrograma, useUpdatePrograma } from '../api/programas';
import { getErr } from '../lib/errors';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import ErrorState from '../components/ui/ErrorState';
import Dropdown from '../components/ui/Dropdown';

const EMPTY_FORM = { name: '', modality: '', duration: '', level: '', description: '' };

const MODALIDADES = ['presencial', 'virtual', 'mixta'];

export default function Programas() {
  const programasQuery = useProgramas();
  const createPrograma = useCreatePrograma();
  const updatePrograma = useUpdatePrograma();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target ? e.target.value : e }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || '',
      modality: row.modality || '',
      duration: row.duration != null ? String(row.duration) : '',
      level: row.level || '',
      description: row.description || '',
    });
    setFormErrors({});
    setOpen(true);
  };

  const save = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio';
    else if (form.name.trim().length < 3) errs.name = 'Mínimo 3 caracteres';
    if (form.duration && (!/^\d+$/.test(form.duration) || Number(form.duration) <= 0)) {
      errs.duration = 'Debe ser un número mayor a 0';
    }
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    const payload = {
      name: form.name.trim(),
      ...(form.modality && { modality: form.modality }),
      ...(form.duration && { duration: Number(form.duration) }),
      ...(form.level.trim() && { level: form.level.trim() }),
      ...(form.description.trim() && { description: form.description.trim() }),
    };
    try {
      if (editing) {
        await updatePrograma.mutateAsync({ id: editing.id, ...payload });
        toast.success('Programa actualizado');
      } else {
        await createPrograma.mutateAsync(payload);
        toast.success('Programa creado correctamente');
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
      key: 'name',
      label: 'Programa',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sena-tint-100 text-sena-green">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-sena-ink">{r.name || '—'}</p>
            <p className="truncate text-xs text-slate-400">{r.description || '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'modality', label: 'Modalidad', render: (r) => <span className="text-slate-600">{r.modality || '—'}</span> },
    { key: 'duration', label: 'Duración', render: (r) => <span className="text-slate-600">{r.duration ?? '—'}</span> },
    { key: 'level', label: 'Nivel', render: (r) => <span className="text-slate-600">{r.level || '—'}</span> },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (r) => (
        <Dropdown
          items={[{ label: 'Editar', icon: Pencil, onClick: () => openEdit(r) }]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coordinación"
        title="Programas de formación"
        description="Gestiona los programas a los que se vinculan las fichas de formación."
        icon={BookOpen}
        breadcrumb={[{ label: 'Inicio', to: '/panel' }, { label: 'Programas' }]}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Nuevo programa
          </Button>
        }
      />

      {programasQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los programas"
          message={getErr(programasQuery.error)}
          onRetry={programasQuery.refetch}
        />
      ) : (
        <Table
          columns={columns}
          rows={programasQuery.data || []}
          loading={programasQuery.isLoading}
          emptyTitle="Sin programas"
          emptyMessage="Crea el primer programa de formación."
          keyField="id"
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar programa' : 'Nuevo programa'}
        description="Los programas se vinculan a las fichas desde Grupos → Nuevo grupo."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button icon={editing ? Pencil : Plus} onClick={save} loading={createPrograma.isPending || updatePrograma.isPending}>
              {editing ? 'Guardar cambios' : 'Crear programa'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre del programa" value={form.name} onChange={set('name')} error={formErrors.name} placeholder="Ej. ADSO - Análisis y Desarrollo de Software" />
          <Select label="Modalidad" options={MODALIDADES} value={form.modality} onChange={set('modality')} placeholder="Selecciona" />
          <Input label="Duración" type="number" value={form.duration} onChange={set('duration')} error={formErrors.duration} placeholder="Ej. 24" />
          <Input label="Nivel" value={form.level} onChange={set('level')} placeholder="Ej. Tecnólogo" />
          <div className="sm:col-span-2">
            <Textarea label="Descripción" value={form.description} onChange={set('description')} rows={3} placeholder="Opcional" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
