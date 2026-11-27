import React from 'react';
import { cn } from '@/lib/utils';

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FieldWrapper({
  label,
  error,
  hint,
  htmlFor,
  required,
  children,
}: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-medium text-[#18231E] dark:text-[#EDF2EE]"
        >
          {label}
          {required ? <span className="ml-0.5 text-[#D9534F]">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-[#D9534F]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[#929B94] dark:text-[#6C7A72]">{hint}</p>
      ) : null}
    </div>
  );
}

const baseControlClass =
  'w-full rounded-lg border border-[#E5E9E3] bg-white px-3 text-sm text-[#18231E] placeholder:text-[#929B94] transition-colors focus:border-[#2F765B] focus:outline-none focus:ring-2 focus:ring-[#2F765B]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE] dark:placeholder:text-[#6C7A72]';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, required, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <FieldWrapper
        label={label}
        error={error}
        hint={hint}
        htmlFor={inputId}
        required={required}
      >
        <input
          ref={ref}
          id={inputId}
          className={cn(
            baseControlClass,
            'h-10',
            error && 'border-[#D9534F] focus:border-[#D9534F] focus:ring-[#D9534F]/20',
            className,
          )}
          {...props}
        />
      </FieldWrapper>
    );
  },
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, required, children, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <FieldWrapper
        label={label}
        error={error}
        hint={hint}
        htmlFor={selectId}
        required={required}
      >
        <select
          ref={ref}
          id={selectId}
          className={cn(
            baseControlClass,
            'h-10 cursor-pointer',
            error && 'border-[#D9534F] focus:border-[#D9534F] focus:ring-[#D9534F]/20',
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </FieldWrapper>
    );
  },
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, required, ...props }, ref) => {
    const textareaId = id ?? props.name;
    return (
      <FieldWrapper
        label={label}
        error={error}
        hint={hint}
        htmlFor={textareaId}
        required={required}
      >
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            baseControlClass,
            'min-h-[84px] py-2.5 resize-y',
            error && 'border-[#D9534F] focus:border-[#D9534F] focus:ring-[#D9534F]/20',
            className,
          )}
          {...props}
        />
      </FieldWrapper>
    );
  },
);
Textarea.displayName = 'Textarea';
