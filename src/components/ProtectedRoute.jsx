import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PermissionDenied } from '@/components/feedback/PermissionDenied';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { Skeleton } from '@/components/ui/Skeleton';

export function ProtectedRoute({ permissions = [], requireTenant = false, children }) {
  const { loading, isAuthenticated, activeTenantId, canAny, firebaseInfo } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!firebaseInfo.configured) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireTenant && !activeTenantId) {
    return (
      <StatusBanner
        tone="warning"
        title="No Active College Tenant"
        description="Your account is authenticated, but not yet assigned to an active college tenant. Visit Profile or ask a College Admin to assign your membership."
      />
    );
  }

  if (permissions.length > 0 && !canAny(permissions)) {
    return <PermissionDenied />;
  }

  return children;
}
