import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[10px] border border-dashed border-[#E5E9E3] bg-[#F7F8F5]/60 px-6 py-12 text-center dark:border-[#24332C] dark:bg-[#151E1A]/60',
        className,
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E5EFE8] text-[#153D32] dark:bg-[#1A3329] dark:text-[#7FD1AE]">
        {icon}
      </div>
      <h4 className="font-display text-sm font-semibold text-[#18231E] dark:text-[#EDF2EE]">
        {title}
      </h4>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#66736A] dark:text-[#9EADA4]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
