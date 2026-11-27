import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0 to 100+
  status?: 'healthy' | 'warning' | 'exceeded' | 'gold';
  className?: string;
  heightClass?: string;
}

export function ProgressBar({
  value,
  status = 'healthy',
  className,
  heightClass = 'h-2',
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const fillClass =
    status === 'exceeded'
      ? 'bg-[#D9534F]'
      : status === 'warning'
        ? 'bg-[#D97757]'
        : status === 'gold'
          ? 'bg-[#D8A85D]'
          : 'bg-[#2F765B]';

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-[#EEF1EC] dark:bg-[#1C2722]',
        heightClass,
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', fillClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
