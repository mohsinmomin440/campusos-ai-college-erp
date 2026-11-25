import { useCallback, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastContext } from '@/hooks/useToast';
import { cn } from '@/utils/cn';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((item) => {
          const Icon =
            item.variant === 'success'
              ? CheckCircle2
              : item.variant === 'error'
                ? AlertCircle
                : Info;
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg',
                item.variant === 'success' && 'border-emerald-200',
                item.variant === 'error' && 'border-rose-200',
                item.variant === 'info' && 'border-slate-200'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 mt-0.5',
                  item.variant === 'success' && 'text-emerald-600',
                  item.variant === 'error' && 'text-rose-600',
                  item.variant === 'info' && 'text-indigo-600'
                )}
              />
              <div className="flex-1 min-w-0">
                {item.title && <p className="text-sm font-semibold text-slate-900">{item.title}</p>}
                {item.description && <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
