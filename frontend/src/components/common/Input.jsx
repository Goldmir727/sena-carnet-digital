export default function Input({ label, icon: Icon, error, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-sena-ink">{label}</label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        )}
        <input
          className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm text-sena-ink placeholder:text-slate-400 focus:border-sena-green focus:outline-none focus:ring-2 focus:ring-sena-green/30 ${
            Icon ? 'pl-10' : 'px-3'
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
