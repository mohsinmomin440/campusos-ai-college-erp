import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

const VARIANT_CLASSES = {
  primary: 'bg-indigo-700 text-white hover:bg-indigo-800 shadow-xs focus-visible:ring-indigo-600',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs focus-visible:ring-slate-400',
  outline: 'border border-indigo-200 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100/70 focus-visible:ring-indigo-500',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs focus-visible:ring-rose-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs focus-visible:ring-emerald-600',
};

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-lg',
  lg: 'h-10 px-5 text-sm rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
};

export const Button = forwardRef(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', disabled, loading, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
