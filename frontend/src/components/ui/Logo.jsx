import cn from '../../lib/cn';

const SIZES = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

export default function Logo({ size = 'md', className = '' }) {
  return (
    <img
      src="/logo-sena.png"
      alt="Logo oficial del SENA"
      width={320}
      height={320}
      draggable={false}
      className={cn('shrink-0 object-contain', SIZES[size], className)}
    />
  );
}
