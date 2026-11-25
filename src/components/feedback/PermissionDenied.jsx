import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function PermissionDenied({
  title = 'Access Restricted',
  message = 'Your current role or tenant membership does not authorize viewing or modifying this resource.',
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/60 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-600">{message}</p>
      <Link to="/dashboard" className="mt-4">
        <Button variant="secondary" size="sm">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
