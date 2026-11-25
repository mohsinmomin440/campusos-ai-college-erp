import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DataTable } from '@/components/tables/DataTable';
import { PermissionDenied } from '@/components/feedback/PermissionDenied';
import { LoginPage } from '@/modules/auth/AuthPages';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { AuthContext } from '@/hooks/useAuth';
import { hasAnyPermission, hasPermission, PERMISSIONS, ROLES } from '@/schemas/roles';

function renderWithMockAuth(ui, overrides = {}) {
  const role = overrides.role || ROLES.STUDENT;
  const mockAuth = {
    firebaseInfo: { configured: true, mode: 'emulator', useEmulators: true },
    backendStatus: { checked: true, reachable: true, geminiConfigured: false, paymentGatewayConfigured: false },
    user: { uid: 'u-1', email: 'student@campusos.test', emailVerified: true },
    profile: { displayName: 'Diya Sharma', uid: 'u-1' },
    tenants: [{ id: 'st-xavier-bca', name: 'St. Xavier', code: 'SXIC', status: 'active' }],
    activeTenantId: 'st-xavier-bca',
    activeTenant: { id: 'st-xavier-bca', name: 'St. Xavier', code: 'SXIC', status: 'active' },
    role,
    roleLabel: role,
    loading: false,
    isAuthenticated: true,
    isSuperAdmin: false,
    can: (p) => hasPermission(role, p),
    canAny: (ps) => hasAnyPermission(role, ps),
    switchTenant: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={mockAuth}>{ui}</AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('Design System & UI Components', () => {
  it('renders DataTable rows, filters via search, and shows empty state', async () => {
    const user = userEvent.setup();
    const rows = [
      { id: '1', name: 'Diya Sharma', code: 'BCA01' },
      { id: '2', name: 'Arjun Patel', code: 'BCA02' },
    ];
    render(
      <DataTable
        columns={[
          { key: 'name', header: 'Student Name' },
          { key: 'code', header: 'Code' },
        ]}
        data={rows}
        searchKeys={['name', 'code']}
      />
    );

    expect(screen.getByText('Diya Sharma')).toBeInTheDocument();
    expect(screen.getByText('Arjun Patel')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search records...');
    await user.type(searchInput, 'Diya');
    expect(screen.getByText('Diya Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Arjun Patel')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'NonExistentXYZ');
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('renders ErrorState with retry callback', async () => {
    const onRetry = vi.fn();
    render(<DataTable columns={[]} data={[]} error={new Error('Firestore denied')} onRetry={onRetry} />);
    expect(screen.getByText('Firestore denied')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders PermissionDenied clearly', () => {
    render(
      <MemoryRouter>
        <PermissionDenied />
      </MemoryRouter>
    );
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });

  it('shows honest Firebase unconfigured notice on LoginPage when Firebase is unconfigured', () => {
    renderWithMockAuth(<LoginPage />, {
      isAuthenticated: false,
      user: null,
      profile: null,
      role: null,
      firebaseInfo: { configured: false, mode: 'not_configured', useEmulators: false },
    });
    expect(screen.getByText(/Firebase Configuration Required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('blocks unauthorized role in ProtectedRoute and allows authorized role', () => {
    const { unmount } = renderWithMockAuth(
      <ProtectedRoute permissions={[PERMISSIONS.PLATFORM_MANAGE]}>
        <div>Secret Platform Panel</div>
      </ProtectedRoute>,
      { role: ROLES.STUDENT }
    );
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.queryByText('Secret Platform Panel')).not.toBeInTheDocument();
    unmount();

    renderWithMockAuth(
      <ProtectedRoute permissions={[PERMISSIONS.PLATFORM_MANAGE]}>
        <div>Secret Platform Panel</div>
      </ProtectedRoute>,
      { role: ROLES.PLATFORM_SUPER_ADMIN }
    );
    expect(screen.getByText('Secret Platform Panel')).toBeInTheDocument();
  });

  it('renders role-aware navigation items in DashboardLayout', () => {
    renderWithMockAuth(
      <Routes>
        <Route path="*" element={<DashboardLayout />} />
      </Routes>,
      { role: ROLES.STUDENT }
    );
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Fees & Finance')).toBeInTheDocument();
    expect(screen.queryByText('Platform Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit & Security')).not.toBeInTheDocument();
  });
});
