import { ShieldCheck } from 'lucide-react';
import cn from '../../lib/cn';

export default function Logo({ size = 'md', className = '' }) {
  const sizes = {
    sm: { box: 'h-9 w-9 rounded-lg', icon: 'h-5 w-5' },
    md: { box: 'h-11 w-11 rounded-xl', icon: 'h-6 w-6' },
    lg: { box: 'h-14 w-14 rounded-2xl', icon: 'h-8 w-8' },
    xl: { box: 'h-20 w-20 rounded-3xl', icon: 'h-11 w-11' },
  };

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-sena-yellow shadow-glow',
        sizes[size].box,
        className
      )}
    >
      <ShieldCheck className={cn('text-sena-green-dark', sizes[size].icon)} strokeWidth={2.2} />
    </div>
  );
}