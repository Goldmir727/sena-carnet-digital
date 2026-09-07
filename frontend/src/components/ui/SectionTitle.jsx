import cn from '../../lib/cn';

export default function SectionTitle({
  title,
  description,
  actions,
  className = '',
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-sena-ink md:text-lg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}