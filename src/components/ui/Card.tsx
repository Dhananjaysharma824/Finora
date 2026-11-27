import React from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-[#E5E9E3] bg-white shadow-[0_1px_2px_rgba(24,35,30,0.03)] transition-colors duration-150 dark:border-[#24332C] dark:bg-[#151E1A]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 px-5 pt-5 pb-3', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-display text-[15px] font-semibold tracking-[-0.01em] text-[#18231E] dark:text-[#EDF2EE]',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs text-[#66736A] dark:text-[#9EADA4]', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 pb-5', className)} {...props}>
      {children}
    </div>
  );
}
