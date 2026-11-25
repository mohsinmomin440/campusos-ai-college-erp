import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  CalendarCheck2,
  Wallet,
  Megaphone,
  Sparkles,
  BookOpen,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useTenantQuery } from '@/hooks/useTenantCollection';
import { where } from '@/firebase/firestore';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader, StatCard } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { PlatformBootstrapCard } from '@/components/PlatformBootstrapCard';
import { formatMinorUnits, sumMinorUnits } from '@/utils/money';
import { formatDate } from '@/utils/date';

export function DashboardPage() {
  const {
    activeTenant,
    activeTenantId,
    user,
    role,
    roleLabel,
    linkedStudentIds,
    bootstrapInitialized,
    can,
    firebaseInfo,
    backendStatus,
  } = useAuth();

  const studentOrParentScope = useMemo(() => {
    if (role === ROLES.STUDENT && user?.uid) {
      return { constraints: [where('studentUid', '==', user.uid)], enabled: true, extra: ['student', user.uid] };
    }
    if (role === ROLES.PARENT) {
      return {
        constraints: linkedStudentIds.length ? [where('studentId', 'in', linkedStudentIds.slice(0, 10))] : [],
        enabled: linkedStudentIds.length > 0,
        extra: ['parent', linkedStudentIds.join(',')],
      };
    }
    return { constraints: [], enabled: true, extra: ['staff'] };
  }, [role, user?.uid, linkedStudentIds]);

  const ticketConstraints = useMemo(
    () =>
      can(PERMISSIONS.TICKETS_MANAGE) || role === ROLES.AUDITOR || role === ROLES.PLATFORM_SUPER_ADMIN
        ? []
        : user?.uid
          ? [where('createdByUid', '==', user.uid)]
          : [],
    [can, role, user?.uid]
  );

  const studentsQ = useTenantQuery('students', { enabled: can(PERMISSIONS.STUDENTS_READ) });
  const admissionsQ = useTenantQuery('admissions', { enabled: can(PERMISSIONS.ADMISSIONS_READ) });
  const attendanceQ = useTenantQuery('attendance', {
    constraints: studentOrParentScope.constraints,
    enabled: can(PERMISSIONS.ATTENDANCE_READ) && studentOrParentScope.enabled,
    queryKeyExtra: studentOrParentScope.extra,
  });
  const invoicesQ = useTenantQuery('invoices', {
    constraints: studentOrParentScope.constraints,
    enabled: can(PERMISSIONS.FINANCE_READ) && studentOrParentScope.enabled,
    queryKeyExtra: studentOrParentScope.extra,
  });
  const noticesQ = useTenantQuery('notices', { enabled: can(PERMISSIONS.COMMUNICATION_READ) });
  const ticketsQ = useTenantQuery('tickets', {
    constraints: ticketConstraints,
    enabled: can(PERMISSIONS.COMMUNICATION_READ) && Boolean(user?.uid),
    queryKeyExtra: [ticketConstraints.length ? user?.uid : 'all'],
  });

  const stats = useMemo(() => {
    const students = studentsQ.data || [];
    const admissions = admissionsQ.data || [];
    const attendance = attendanceQ.data || [];
    const invoices = invoicesQ.data || [];

    const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attendancePct = attendance.length ? `${Math.round((presentCount / attendance.length) * 100)}%` : '—';

    const outstandingMinor = sumMinorUnits(invoices.map((i) => Number(i.balanceMinor || 0)));
    const collectedMinor = sumMinorUnits(invoices.map((i) => Number(i.paidMinor || 0)));

    return {
      studentCount: students.length,
      pendingAdmissions: admissions.filter((a) => ['submitted', 'under_review'].includes(a.status)).length,
      attendancePct,
      attendanceTotal: attendance.length,
      outstandingFormatted: formatMinorUnits(outstandingMinor, activeTenant?.currency || 'INR'),
      collectedFormatted: formatMinorUnits(collectedMinor, activeTenant?.currency || 'INR'),
    };
  }, [studentsQ.data, admissionsQ.data, attendanceQ.data, invoicesQ.data, activeTenant]);

  const chartData = useMemo(() => {
    const admissions = admissionsQ.data || [];
    const stages = ['submitted', 'under_review', 'approved', 'enrolled', 'rejected'];
    return stages.map((stage) => ({
      stage: stage.replace('_', ' '),
      count: admissions.filter((a) => a.status === stage).length,
    }));
  }, [admissionsQ.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeTenant ? `${activeTenant.name} Workspace` : 'CampusOS Dashboard'}
        description={`Signed in as ${roleLabel}. Real-time data scoped to ${activeTenant?.code || 'your college tenant'}.`}
        actions={
          <Link
            to="/ai-assistant"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-800 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Open Gemini AI Assistant
          </Link>
        }
      />

      {!activeTenantId && !bootstrapInitialized && <PlatformBootstrapCard />}

      {!activeTenantId && bootstrapInitialized && (
        <StatusBanner
          tone="warning"
          title="No college tenant assigned"
          description="Verify your email address and ask your College Admin to assign or invite your email to a college workspace."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Students"
          value={can(PERMISSIONS.STUDENTS_READ) ? stats.studentCount : 'Restricted'}
          hint="Enrolled in current college"
          icon={Users}
          tone="indigo"
        />
        <StatCard
          label="Pending Admissions"
          value={can(PERMISSIONS.ADMISSIONS_READ) ? stats.pendingAdmissions : 'Restricted'}
          hint="Awaiting review or enrollment"
          icon={UserPlus}
          tone="amber"
        />
        <StatCard
          label="Recorded Attendance Rate"
          value={can(PERMISSIONS.ATTENDANCE_READ) ? stats.attendancePct : 'Restricted'}
          hint={`Across ${stats.attendanceTotal} session records`}
          icon={CalendarCheck2}
          tone="emerald"
        />
        <StatCard
          label="Fee Balance Due"
          value={can(PERMISSIONS.FINANCE_READ) ? stats.outstandingFormatted : 'Restricted'}
          hint={`Collected: ${stats.collectedFormatted}`}
          icon={Wallet}
          tone="rose"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Admissions Pipeline Overview</CardTitle>
              <CardDescription>Live Firestore distribution across admission stages</CardDescription>
            </div>
            {can(PERMISSIONS.ADMISSIONS_READ) && (
              <Link to="/admissions" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">
                Manage Admissions <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="h-64">
            {can(PERMISSIONS.ADMISSIONS_READ) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4338ca" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Admissions metrics are restricted for your role ({roleLabel}).
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Service &amp; Governance Health</CardTitle>
              <CardDescription>Verified live runtime boundaries</CardDescription>
            </div>
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Firebase Client</span>
              <Badge variant={firebaseInfo.mode === 'emulator' ? 'info' : 'success'}>
                {firebaseInfo.mode}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Cloud Functions</span>
              <Badge variant={backendStatus.reachable ? 'success' : 'warning'}>
                {backendStatus.reachable ? 'Reachable' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Gemini AI Server</span>
              <Badge variant={backendStatus.geminiConfigured ? 'success' : 'neutral'}>
                {backendStatus.geminiConfigured ? 'Configured' : 'Disabled (No Key)'}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-600">Open Helpdesk Tickets</span>
              <Badge variant="indigo">
                {(ticketsQ.data || []).filter((t) => t.status !== 'resolved').length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-indigo-600" />
              <CardTitle>Recent Campus Notices</CardTitle>
            </div>
            <Link to="/communication" className="text-xs font-medium text-indigo-700 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {(noticesQ.data || []).length === 0 ? (
              <p className="text-xs text-slate-500">No notices published for this college yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(noticesQ.data || []).slice(0, 4).map((notice) => (
                  <li key={notice.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{notice.title}</p>
                      <Badge variant="neutral">{notice.audience || 'All'}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{notice.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(notice.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              <CardTitle>Quick Role Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2.5 sm:grid-cols-2">
            {[
              { label: 'Students Directory', to: '/students', perm: PERMISSIONS.STUDENTS_READ },
              { label: 'Mark Attendance', to: '/attendance', perm: PERMISSIONS.ATTENDANCE_WRITE },
              { label: 'Academic Timetable', to: '/academics', perm: PERMISSIONS.ACADEMICS_READ },
              { label: 'Fee Invoices & Receipts', to: '/finance', perm: PERMISSIONS.FINANCE_READ },
              { label: 'Exam Marks & Results', to: '/examinations', perm: PERMISSIONS.EXAMS_READ },
              { label: 'Reports & CSV Exports', to: '/reports', perm: PERMISSIONS.REPORTS_READ },
            ]
              .filter((action) => can(action.perm))
              .map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-800 transition-colors"
                >
                  <span>{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
