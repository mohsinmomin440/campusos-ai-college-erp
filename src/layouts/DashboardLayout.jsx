import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  Users,
  Briefcase,
  BookOpen,
  CalendarCheck2,
  Award,
  Wallet,
  Library,
  BriefcaseBusiness,
  Megaphone,
  FileText,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/schemas/roles';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { cn } from '@/utils/cn';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permissions: [] },
      { to: '/ai-assistant', label: 'AI Assistant', icon: Sparkles, permissions: [PERMISSIONS.AI_USE] },
    ],
  },
  {
    label: 'Campus Setup',
    items: [
      { to: '/platform', label: 'Platform Admin', icon: Building2, permissions: [PERMISSIONS.PLATFORM_MANAGE] },
      { to: '/administration', label: 'College Setup', icon: Settings, permissions: [PERMISSIONS.TENANT_SETTINGS, PERMISSIONS.USERS_MANAGE] },
      { to: '/academics', label: 'Academics & Timetable', icon: BookOpen, permissions: [PERMISSIONS.ACADEMICS_READ] },
    ],
  },
  {
    label: 'People & Admissions',
    items: [
      { to: '/admissions', label: 'Admissions', icon: UserPlus, permissions: [PERMISSIONS.ADMISSIONS_READ] },
      { to: '/students', label: 'Students', icon: Users, permissions: [PERMISSIONS.STUDENTS_READ] },
      { to: '/faculty', label: 'Faculty & Staff', icon: Briefcase, permissions: [PERMISSIONS.FACULTY_READ] },
    ],
  },
  {
    label: 'Academic Operations',
    items: [
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck2, permissions: [PERMISSIONS.ATTENDANCE_READ] },
      { to: '/examinations', label: 'Examinations & Results', icon: Award, permissions: [PERMISSIONS.EXAMS_READ] },
      { to: '/finance', label: 'Fees & Finance', icon: Wallet, permissions: [PERMISSIONS.FINANCE_READ] },
    ],
  },
  {
    label: 'Services & Insights',
    items: [
      { to: '/library', label: 'Library', icon: Library, permissions: [PERMISSIONS.LIBRARY_READ] },
      { to: '/placements', label: 'Placements', icon: BriefcaseBusiness, permissions: [PERMISSIONS.PLACEMENTS_READ] },
      { to: '/communication', label: 'Notices & Helpdesk', icon: Megaphone, permissions: [PERMISSIONS.COMMUNICATION_READ] },
      { to: '/documents', label: 'Documents & Certs', icon: FileText, permissions: [PERMISSIONS.DOCUMENTS_READ] },
      { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, permissions: [PERMISSIONS.REPORTS_READ] },
      { to: '/audit-logs', label: 'Audit & Security', icon: ShieldCheck, permissions: [PERMISSIONS.AUDIT_READ] },
    ],
  },
];

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const {
    user,
    profile,
    tenants,
    activeTenantId,
    activeTenant,
    roleLabel,
    canAny,
    switchTenant,
    logout,
    firebaseInfo,
    backendStatus,
  } = useAuth();

  const filteredGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => canAny(item.permissions)),
      })).filter((group) => group.items.length > 0),
    [canAny]
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex h-14 items-center justify-between border-b border-slate-100 px-3.5">
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-white font-bold text-sm">
              C
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold text-slate-900 truncate">CampusOS</p>
              <p className="text-[10px] text-slate-500 truncate">{activeTenant?.code || 'Multi-College ERP'}</p>
            </div>
          </div>
        )}
        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobile) && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => isMobile && setMobileOpen(false)}
                      title={collapsed && !isMobile ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-2.5 space-y-1">
        <NavLink
          to="/profile"
          onClick={() => isMobile && setMobileOpen(false)}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span className="truncate">My Profile &amp; Status</span>}
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className={cn('hidden lg:block shrink-0 transition-all duration-200', collapsed ? 'w-16' : 'w-60')}>
        <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-64 h-full">{sidebarContent(true)}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            {tenants.length > 0 ? (
              <div className="flex items-center gap-2 min-w-0">
                <label htmlFor="tenant-switcher" className="sr-only">
                  Active College Tenant
                </label>
                <Select
                  id="tenant-switcher"
                  value={activeTenantId || ''}
                  onChange={(e) => switchTenant(e.target.value)}
                  className="h-8 max-w-[220px] text-xs font-medium"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </Select>
                {activeTenant?.status === 'suspended' && (
                  <Badge variant="danger">Suspended</Badge>
                )}
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-500">No college tenant assigned</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Badge variant={firebaseInfo.mode === 'emulator' ? 'info' : firebaseInfo.configured ? 'success' : 'danger'}>
              {firebaseInfo.mode === 'emulator' ? 'Emulator' : firebaseInfo.configured ? 'Cloud' : 'Unconfigured'}
            </Badge>
            <Badge variant={backendStatus.geminiConfigured ? 'indigo' : 'neutral'} className="hidden sm:inline-flex">
              AI: {backendStatus.geminiConfigured ? 'Ready' : 'Not Configured'}
            </Badge>
            <NavLink
              to="/communication"
              aria-label="Notices and Notifications"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Bell className="h-4 w-4" />
            </NavLink>
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-slate-900">
                {profile?.displayName || user?.email || 'User'}
              </span>
              <span className="text-[11px] text-indigo-700 font-medium">{roleLabel}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
