export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-sena-green text-white hover:bg-sena-green-dark',
    secondary: 'bg-slate-200 text-sena-ink hover:bg-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-sena-green hover:bg-sena-green-light',
  };

  return (
    <button
      type={type}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
