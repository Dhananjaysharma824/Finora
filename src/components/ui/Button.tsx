import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#153D32] text-[#F7F8F5] hover:bg-[#102F27] active:bg-[#0D261F] dark:bg-[#2F765B] dark:hover:bg-[#26624B] shadow-[0_1px_2px_rgba(16,47,39,0.18)]',
  secondary:
    'bg-[#EEF1EC] text-[#18231E] hover:bg-[#E5E9E3] dark:bg-[#1C2722] dark:text-[#EDF2EE] dark:hover:bg-[#24332C]',
  outline:
    'bg-white text-[#18231E] border border-[#E5E9E3] hover:bg-[#F7F8F5] dark:bg-[#151E1A] dark:text-[#EDF2EE] dark:border-[#24332C] dark:hover:bg-[#1C2722]',
  ghost:
    'bg-transparent text-[#66736A] hover:bg-[#EEF1EC] hover:text-[#18231E] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] dark:hover:text-[#EDF2EE]',
  danger:
    'bg-[#D9534F] text-white hover:bg-[#C44541] active:bg-[#B03C38]',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-5 text-sm gap-2 rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F765B]/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 cursor-pointer whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
      </button>
    );
  },
);

Button.displayName = 'Button';
