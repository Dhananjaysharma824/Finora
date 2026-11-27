import { cn } from '@/lib/utils';

interface FinoraLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function FinoraLogo({ collapsed = false, className }: FinoraLogoProps) {
  return (
    <div className={cn('flex items-center overflow-hidden select-none', className)}>
      <img
        src={collapsed ? '/favicon.png' : '/finora_logo.png'}
        alt="Finora"
        className={cn(
          'shrink-0 object-contain',
          collapsed
            ? 'h-9 w-9'
            : 'h-14 w-auto max-w-[180px] scale-125 origin-left',
        )}
      />
    </div>
  );
}
