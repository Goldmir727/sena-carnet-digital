import { AlertCircle, RotateCw } from 'lucide-react';
import Card from './Card';
import Button from './Button';

export default function ErrorState({ title = 'Algo salió mal', message, onRetry }) {
  return (
    <Card variant="flat" className="flex flex-col items-center justify-center py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertCircle className="h-7 w-7" strokeWidth={1.8} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-sena-ink">{title}</h3>
      {message && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{message}</p>
      )}
      {onRetry && (
        <Button variant="secondary" icon={RotateCw} onClick={onRetry} className="mt-5">
          Reintentar
        </Button>
      )}
    </Card>
  );
}