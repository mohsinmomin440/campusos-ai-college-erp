import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export const Input = forwardRef(function Input({ className, type = 'text', error, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-900 shadow-2xs transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        error ? 'border-rose-500 focus-visible:ring-rose-500' : 'border-slate-300',
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, error, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'flex w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-50',
        error ? 'border-rose-500 focus-visible:ring-rose-500' : 'border-slate-300',
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-900 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-50',
        error ? 'border-rose-500 focus-visible:ring-rose-500' : 'border-slate-300',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ className, htmlFor, required, children, ...props }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5', className)}
      {...props}
    >
      {children}
      {required && <span className="text-rose-600 ml-0.5">*</span>}
    </label>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
      {message}
    </p>
  );
}
