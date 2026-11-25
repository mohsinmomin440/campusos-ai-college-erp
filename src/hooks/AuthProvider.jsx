import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './useAuth';
import { getFirebaseClients } from '@/firebase/firebase';
import {
  subscribeAuthState,
  loadUserContext,
  loginWithEmail,
  registerUserAccount,
  logoutCurrentUser,
  requestPasswordReset,
  resendVerificationEmail,
} from '@/firebase/auth';
import { callTrustedFunction, doc, getDoc, requireDb } from '@/firebase/firestore';
import { hasPermission, hasAnyPermission, ROLE_LABELS } from '@/schemas/roles';

export function AuthProvider({ children }) {
  const firebaseInfo = useMemo(() => getFirebaseClients(), []);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem('campusos_active_tenant') : null) || null
  );
  const [loading, setLoading] = useState(true);
  const [contextError, setContextError] = useState(null);
  const [bootstrapInitialized, setBootstrapInitialized] = useState(true);
  const [backendStatus, setBackendStatus] = useState({
    checked: false,
    reachable: false,
    firebaseAdminConfigured: false,
    geminiConfigured: false,
    paymentGatewayConfigured: false,
    emulator: firebaseInfo.useEmulators,
  });

  const refreshBackendHealth = useCallback(async () => {
    if (!firebaseInfo.configured) {
      setBackendStatus({
        checked: true,
        reachable: false,
        firebaseAdminConfigured: false,
        geminiConfigured: false,
        paymentGatewayConfigured: false,
        emulator: false,
      });
      return;
    }
    try {
      const data = await callTrustedFunction('healthCheck');
      setBackendStatus({
        checked: true,
        reachable: Boolean(data?.ok),
        firebaseAdminConfigured: data?.firebaseAdminConfigured ?? true,
        geminiConfigured: Boolean(data?.geminiConfigured),
        paymentGatewayConfigured: Boolean(data?.paymentGatewayConfigured),
        emulator: Boolean(data?.emulator),
      });
    } catch {
      setBackendStatus((prev) => ({ ...prev, checked: true, reachable: false, firebaseAdminConfigured: false }));
    }
  }, [firebaseInfo.configured]);

  const refreshContext = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setProfile(null);
      setTenants([]);
      setMemberships([]);
      setLoading(false);
      return;
    }
    try {
      setContextError(null);
      if (firebaseUser.emailVerified || firebaseInfo.useEmulators) {
        try {
          await callTrustedFunction('claimPendingInvitations');
        } catch {
          // Non-fatal if user has no invitations or functions are unreachable
        }
      }
      const ctx = await loadUserContext(firebaseUser);
      setProfile(ctx.profile);
      setTenants(ctx.tenants);
      setMemberships(ctx.memberships);
      if (ctx.tenants.length === 0) {
        try {
          const boot = await callTrustedFunction('getBootstrapStatus');
          setBootstrapInitialized(Boolean(boot?.initialized));
        } catch {
          try {
            const bootDoc = await getDoc(doc(requireDb(), 'system', 'bootstrap'));
            setBootstrapInitialized(bootDoc.exists());
          } catch {
            setBootstrapInitialized(true);
          }
        }
      } else {
        setBootstrapInitialized(true);
      }
      setActiveTenantId((prev) => {
        if (prev && ctx.memberships.some((m) => m.tenantId === prev)) return prev;
        const preferred = ctx.profile?.defaultTenantId;
        if (preferred && ctx.memberships.some((m) => m.tenantId === preferred)) return preferred;
        return ctx.memberships[0]?.tenantId || null;
      });
    } catch (err) {
      setContextError(err?.message || 'Unable to load tenant membership context.');
    } finally {
      setLoading(false);
    }
  }, [firebaseInfo.useEmulators]);

  useEffect(() => {
    refreshBackendHealth();
    if (!firebaseInfo.configured) {
      setLoading(false);
      return undefined;
    }
    const unsub = subscribeAuthState((firebaseUser) => {
      setUser(firebaseUser);
      refreshContext(firebaseUser);
    });
    return () => unsub();
  }, [firebaseInfo.configured, refreshContext, refreshBackendHealth]);

  const switchTenant = useCallback((tenantId) => {
    setActiveTenantId(tenantId);
    if (typeof window !== 'undefined' && tenantId) {
      window.localStorage.setItem('campusos_active_tenant', tenantId);
    }
  }, []);

  const activeTenant = useMemo(
    () => tenants.find((t) => t.id === activeTenantId) || null,
    [tenants, activeTenantId]
  );

  const activeMembership = useMemo(
    () => memberships.find((m) => m.tenantId === activeTenantId) || null,
    [memberships, activeTenantId]
  );

  const role = activeMembership?.role || profile?.platformRole || null;
  const roleLabel = role ? ROLE_LABELS[role] || role : 'Unassigned';
  const linkedStudentIds = useMemo(
    () => (Array.isArray(activeMembership?.linkedStudentIds) ? activeMembership.linkedStudentIds : []),
    [activeMembership]
  );

  const can = useCallback((permission) => hasPermission(role, permission), [role]);
  const canAny = useCallback((permissions) => hasAnyPermission(role, permissions), [role]);

  const value = useMemo(
    () => ({
      firebaseInfo,
      backendStatus,
      refreshBackendHealth,
      user,
      profile,
      tenants,
      memberships,
      activeTenantId,
      activeTenant,
      activeMembership,
      linkedStudentIds,
      role,
      roleLabel,
      loading,
      contextError,
      bootstrapInitialized,
      isAuthenticated: Boolean(user),
      isSuperAdmin: profile?.platformRole === 'platform_super_admin',
      can,
      canAny,
      switchTenant,
      refreshContext: () => refreshContext(user),
      login: loginWithEmail,
      register: registerUserAccount,
      logout: logoutCurrentUser,
      sendPasswordReset: requestPasswordReset,
      resendVerification: resendVerificationEmail,
    }),
    [
      firebaseInfo,
      backendStatus,
      refreshBackendHealth,
      user,
      profile,
      tenants,
      memberships,
      activeTenantId,
      activeTenant,
      activeMembership,
      linkedStudentIds,
      role,
      roleLabel,
      loading,
      contextError,
      bootstrapInitialized,
      can,
      canAny,
      switchTenant,
      refreshContext,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
