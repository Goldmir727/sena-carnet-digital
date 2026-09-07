import Card from './Card';

export default function CardStat({ icon: Icon, label, value, accent = 'sena-green' }) {
  const accents = {
    'sena-green': 'bg-sena-green-light text-sena-green',
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-sena-yellow/20 text-sena-ink',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accents[accent] || accents['sena-green']}`}>
        {Icon && <Icon className="h-6 w-6" />}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-sena-ink">{value ?? '—'}</p>
        <p className="truncate text-sm text-slate-500">{label}</p>
      </div>
    </Card>
  );
}
