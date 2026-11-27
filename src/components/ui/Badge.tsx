import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'forest' | 'gold' | 'coral';
  dotColor?: string;
}

const badgeVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral:
    'bg-[#EEF1EC] text-[#66736A] dark:bg-[#1C2722] dark:text-[#9EADA4]',
  success:
    'bg-[#E5EFE8] text-[#153D32] dark:bg-[#1A3329] dark:text-[#7FD1AE]',
  forest:
    'bg-[#153D32] text-[#F7F8F5] dark:bg-[#2F765B] dark:text-[#F7F8F5]',
  warning:
    'bg-[#FAF3E6] text-[#8F6522] dark:bg-[#332917] dark:text-[#E5BE7D]',
  gold:
    'bg-[#FAF3E6] text-[#9A6F26] dark:bg-[#332917] dark:text-[#D8A85D]',
  coral:
    'bg-[#FBECE7] text-[#B25335] dark:bg-[#34201A] dark:text-[#E6987E]',
  danger:
    'bg-[#FBEAEA] text-[#B33935] dark:bg-[#361B1A] dark:text-[#EB8582]',
};

export function Badge({
  className,
  variant = 'neutral',
  dotColor,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {dotColor ? (
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      ) : null}
      {children}
    </span>
  );
}
