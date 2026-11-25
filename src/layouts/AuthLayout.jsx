import { Outlet } from 'react-router-dom';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';

export function AuthLayout() {
  const { firebaseInfo, backendStatus } = useAuth();

  const statusBadge = !firebaseInfo.configured
    ? { variant: 'danger', text: 'Firebase Not Configured' }
    : firebaseInfo.mode === 'emulator'
      ? { variant: 'info', text: 'Firebase Emulator Mode' }
      : { variant: 'success', text: 'Firebase Cloud Connected' };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-700 text-white shadow-xs">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <span className="font-heading text-base font-bold text-slate-900">CampusOS</span>
              <p className="text-[11px] text-slate-500">One Campus. One Platform. Intelligent Management.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
            {backendStatus.checked && (
              <Badge variant={backendStatus.geminiConfigured ? 'success' : 'neutral'}>
                Gemini AI: {backendStatus.geminiConfigured ? 'Configured' : 'Not Configured'}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 px-4">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            Tenant-isolated Firebase RBAC &amp; Server-side Gemini Governance
          </span>
          <span>Web Platform</span>
        </div>
      </footer>
    </div>
  );
}
