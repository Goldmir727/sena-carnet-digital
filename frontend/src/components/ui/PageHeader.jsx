import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import cn from '../../lib/cn';

function Breadcrumb({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="flex items-center gap-1 text-sm text-slate-400" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const content = last ? (
          <span className="font-medium text-slate-600">{item.label}</span>
        ) : item.to ? (
          <Link to={item.to} className="transition hover:text-sena-green">
            {item.label}
          </Link>
        ) : (
          <span>{item.label}</span>
        );
        return (
          <span key={i} className="flex items-center gap-1">
            {content}
            {!last && <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        );
      })}
    </nav>
  );
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  breadcrumb,
  actions,
  className = '',
}) {
  return (
    <div className={cn('animate-fade-up', className)}>
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3.5">
          {Icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sena-tint-100 text-sena-green">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
          )}
          <div>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sena-green">{eyebrow}</p>
            )}
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-sena-ink md:text-3xl">{title}</h1>
            {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 lg:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}