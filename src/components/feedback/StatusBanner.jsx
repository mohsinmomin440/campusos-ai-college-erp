import { AlertCircle, CheckCircle2, ServerOff } from 'lucide-react';
import { cn } from '@/utils/cn';

export function StatusBanner({ tone = 'info', title, description, className }) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  };
  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'error' ? ServerOff : AlertCircle;

  return (
    <div
      role="status"
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-xs', styles[tone] || styles.info, className)}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {description && <p className="mt-0.5 opacity-90">{description}</p>}
      </div>
    </div>
  );
}
