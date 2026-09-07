import Badge from './Badge';

const STATUS_MAP = {
  activo: { variant: 'green', label: 'Activo' },
  activa: { variant: 'green', label: 'Activo' },
  activos: { variant: 'green', label: 'Activo' },
  activado: { variant: 'green', label: 'Activo' },
  emitido: { variant: 'green', label: 'Emitido' },
  pendiente: { variant: 'yellow', label: 'Pendiente' },
  'no emitido': { variant: 'slate', label: 'No emitido' },
  inactivo: { variant: 'slate', label: 'Inactivo' },
  revocado: { variant: 'red', label: 'Revocado' },
  cancelado: { variant: 'red', label: 'Cancelado' },
  suspendido: { variant: 'red', label: 'Suspendido' },
  vencido: { variant: 'red', label: 'Vencido' },
  expirado: { variant: 'red', label: 'Expirado' },
  ausente: { variant: 'red', label: 'Ausente' },
  presente: { variant: 'green', label: 'Presente' },
  tarde: { variant: 'yellow', label: 'Tarde' },
  asiste: { variant: 'green', label: 'Asiste' },
  no_asiste: { variant: 'red', label: 'No asiste' },
  validado: { variant: 'green', label: 'Validado' },
};

export default function StatusBadge({ status, className = '' }) {
  const key = status ? String(status).toLowerCase() : '';
  const cfg = STATUS_MAP[key] || { variant: 'slate', label: String(status ?? '—') };
  return (
    <Badge variant={cfg.variant} className={className}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-40" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {cfg.label}
    </Badge>
  );
}