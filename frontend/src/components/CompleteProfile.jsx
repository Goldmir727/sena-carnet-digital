import { useState } from 'react';
import { Camera, CheckCircle2, Droplet, Building2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUpdateUser, useUploadPhoto } from '../api/users';
import { getErr } from '../lib/errors';
import PageHeader from './ui/PageHeader';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Badge from './ui/Badge';

const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const MAX_FOTO_MB = 5;

function initials(nombres, apellidos, email) {
  const a = (nombres || '')[0] || '';
  const b = (apellidos || '')[0] || (email || '')[0] || '';
  return `${a}${b}`.toUpperCase();
}

function photoUrl(foto) {
  if (!foto) return null;
  if (/^https?:\/\//i.test(foto)) return foto;
  const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  const clean = String(foto).replace(/\\/g, '/').replace(/^\/+/, '');
  return `${base}/${clean}`;
}

/**
 * Onboarding obligatorio del Aprendiz: completa los datos críticos
 * del carnet (tipo de sangre + foto). El centro es derivado del
 * grupo y se muestra solo como lectura.
 */
export default function CompleteProfile({ user }) {
  const updateUser = useUpdateUser();
  const uploadPhoto = useUploadPhoto();

  const [tipoSangre, setTipoSangre] = useState(user?.tipo_sangre || user?.blood_type || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});

  const currentPhoto = preview || photoUrl(user?.foto_perfil);
  const faltantes = [
    ...(!user?.tipo_sangre && !tipoSangre ? ['Tipo de sangre'] : []),
    ...(!user?.foto_perfil && !file ? ['Foto de perfil'] : []),
  ];
  const saving = updateUser.isPending || uploadPhoto.isPending;

  const onPickFile = (e) => {
    const picked = e.target.files?.[0] || null;
    if (preview) URL.revokeObjectURL(preview);
    if (!picked) {
      setPreview(null);
      setFile(null);
      return;
    }
    if (!picked.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen');
      return;
    }
    if (picked.size > MAX_FOTO_MB * 1024 * 1024) {
      toast.error(`La foto no puede superar ${MAX_FOTO_MB} MB`);
      return;
    }
    setPreview(URL.createObjectURL(picked));
    setFile(picked);
  };

  const onSubmit = async () => {
    const errs = {};
    if (!tipoSangre) errs.tipo_sangre = 'Selecciona tu tipo de sangre';
    if (!user?.foto_perfil && !file) errs.foto = 'Sube tu foto de perfil';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      if (tipoSangre !== (user?.tipo_sangre || user?.blood_type || '')) {
        await updateUser.mutateAsync({ id: user.id, tipo_sangre: tipoSangre });
      }
      if (file) {
        await uploadPhoto.mutateAsync({ id: user.id, file });
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setFile(null);
      }
      toast.success('Perfil completado. Ya puedes ver tu carnet');
    } catch (e) {
      toast.error(getErr(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bienvenido"
        title="Completa tu perfil"
        description="Necesitamos estos datos para generar tu carnet digital. Solo te tomará un minuto."
        icon={UserCheck}
        breadcrumb={[{ label: 'Inicio', to: '/' }, { label: 'Completar perfil' }]}
      />

      {faltantes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sena-yellow/40 bg-sena-yellow/10 px-4 py-3">
          <span className="text-sm font-medium text-sena-ink">Te falta:</span>
          {faltantes.map((f) => (
            <Badge key={f} variant="yellow">{f}</Badge>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sena-tint-100 text-sena-green">
              <Droplet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-sena-ink">Datos del carnet</h2>
              <p className="text-xs text-slate-400">Esta información aparece impresa en tu carnet</p>
            </div>
          </div>
          <div className="grid gap-4 pt-4 sm:grid-cols-2">
            <Input label="Nombres" value={`${user?.nombres || user?.name || ''}`} disabled />
            <Input label="Apellidos" value={`${user?.apellidos || user?.last_name || ''}`} disabled />
            <Input
              label="Documento"
              value={`${user?.tipo_documento || ''} ${user?.numero_documento || ''}`.trim() || '—'}
              disabled
            />
            <Input label="Correo electrónico" value={user?.email || '—'} disabled />
            <Select
              label="Tipo de sangre"
              options={TIPOS_SANGRE}
              value={tipoSangre}
              onChange={(e) => setTipoSangre(e.target.value)}
              error={errors.tipo_sangre}
              placeholder="Selecciona tu tipo"
              hint="Incluye el RH: por ejemplo O+ u O−"
            />
            <Input
              label="Centro de formación"
              icon={Building2}
              value={user?.centro_nombre || '—'}
              disabled
              hint="Lo asigna coordinación según tu grupo"
            />
          </div>
        </Card>

        <Card className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col items-center px-2 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sena-tint-100 text-sena-green">
              <Camera className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-sena-ink">Foto de perfil</h2>
            <p className="mt-1 text-center text-xs text-slate-400">
              Foto tipo documento, fondo claro. Saldrá impresa en tu carnet.
            </p>
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt="Vista previa"
                className="mt-4 h-28 w-28 rounded-full object-cover shadow-soft ring-4 ring-sena-tint-100"
              />
            ) : (
              <div className="mt-4 flex h-28 w-28 items-center justify-center rounded-full bg-sena-green text-3xl font-bold text-white shadow-soft ring-4 ring-sena-tint-100">
                {initials(user?.nombres || user?.name, user?.apellidos || user?.last_name, user?.email)}
              </div>
            )}
            {errors.foto && <p className="mt-2 text-xs font-medium text-red-600">{errors.foto}</p>}
            <input
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="mt-4 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-sena-tint-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sena-green-dark hover:file:bg-sena-tint-200"
            />
            <div className="mt-5 w-full">
              <Button fullWidth icon={CheckCircle2} onClick={onSubmit} loading={saving}>
                Guardar y ver mi carnet
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
