import cn from '../../lib/cn';

const STYLES = {
  // Superficie blanca elevada (destacada)
  raised: 'bg-white/90 backdrop-blur-sm shadow-card',
  // Borde sutil transparente (casi integrarse al canvas)
  bordered: 'bg-transparent border border-white/70',
  // Borde con tint institucional
  tint: 'bg-sena-tint-50/70 border border-sena-tint-200',
  // Hundida (reading surface)
  sunken: 'surface-sunken',
  // Sin tratamiento (cuerpo de página nativo)
  ghost: 'bg-transparent',
  // Cielo oscuro institucional (con gradiente identitario)
  dark: 'bg-sena-hero text-white',
};

export default function Zone({
  children,
  variant = 'raised',
  className = '',
  bleed = false,
  ...props
}) {
  return (
    <section
      className={cn('relative', STYLES[variant], bleed ? '' : 'rounded-2xl', className)}
      {...props}
    >
      {children}
    </section>
  );
}