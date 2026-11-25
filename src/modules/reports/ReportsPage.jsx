import { useMemo, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useTenantQuery } from '@/hooks/useTenantCollection';
import { PERMISSIONS } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable } from '@/components/tables/DataTable';
import { exportRowsToCsv } from '@/utils/csv';
import { formatMinorUnits } from '@/utils/money';

const PIE_COLORS = ['#4338ca', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function ReportsPage() {
  const { activeTenant, can } = useAuth();
  const currency = activeTenant?.currency || 'INR';

  const studentsQ = useTenantQuery('students', { enabled: can(PERMISSIONS.STUDENTS_READ) });
  const admissionsQ = useTenantQuery('admissions', { enabled: can(PERMISSIONS.ADMISSIONS_READ) });
  const attendanceQ = useTenantQuery('attendance', { enabled: can(PERMISSIONS.ATTENDANCE_READ) });
  const invoicesQ = useTenantQuery('invoices', { enabled: can(PERMISSIONS.FINANCE_READ) });
  const resultsQ = useTenantQuery('results', { enabled: can(PERMISSIONS.EXAMS_READ) });
  const placementsQ = useTenantQuery('placementApplications', { enabled: can(PERMISSIONS.PLACEMENTS_READ) });

  const availableTabs = [
    ...(can(PERMISSIONS.STUDENTS_READ) ? [{ id: 'students', label: 'Students Report', count: (studentsQ.data || []).length }] : []),
    ...(can(PERMISSIONS.ADMISSIONS_READ) ? [{ id: 'admissions', label: 'Admissions Funnel', count: (admissionsQ.data || []).length }] : []),
    ...(can(PERMISSIONS.FINANCE_READ) ? [{ id: 'finance', label: 'Finance Dues', count: (invoicesQ.data || []).length }] : []),
    ...(can(PERMISSIONS.EXAMS_READ) ? [{ id: 'results', label: 'Exam Results', count: (resultsQ.data || []).length }] : []),
    ...(can(PERMISSIONS.PLACEMENTS_READ) ? [{ id: 'placements', label: 'Placements', count: (placementsQ.data || []).length }] : []),
  ];

  const [reportType, setReportType] = useState(availableTabs[0]?.id || 'students');
  const activeReportType = availableTabs.some((t) => t.id === reportType)
    ? reportType
    : availableTabs[0]?.id || 'students';

  const financeSummary = useMemo(() => {
    const invs = invoicesQ.data || [];
    const statusMap = { paid: 0, partial: 0, pending: 0, refunded: 0 };
    invs.forEach((i) => {
      statusMap[i.status] = (statusMap[i.status] || 0) + 1;
    });
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
  }, [invoicesQ.data]);

  const attendanceChart = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    (attendanceQ.data || []).forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [attendanceQ.data]);

  const exportConfig = {
    students: {
      rows: studentsQ.data || [],
      headers: [
        { label: 'Enrollment', key: 'enrollmentNumber' },
        { label: 'Full Name', key: 'fullName' },
        { label: 'Email', key: 'email' },
        { label: 'Semester', key: 'semesterId' },
        { label: 'Status', key: 'status' },
      ],
      columns: [
        { key: 'enrollmentNumber', header: 'Enrollment #' },
        { key: 'fullName', header: 'Student Name' },
        { key: 'email', header: 'Email' },
        { key: 'semesterId', header: 'Semester' },
        { key: 'status', header: 'Status' },
      ],
    },
    admissions: {
      rows: admissionsQ.data || [],
      headers: [
        { label: 'Applicant', key: 'applicantName' },
        { label: 'Program', key: 'programApplied' },
        { label: 'Score %', key: 'previousPercentage' },
        { label: 'Status', key: 'status' },
      ],
      columns: [
        { key: 'applicantName', header: 'Applicant' },
        { key: 'programApplied', header: 'Program' },
        { key: 'previousPercentage', header: 'Qualifying %' },
        { key: 'status', header: 'Stage' },
      ],
    },
    finance: {
      rows: invoicesQ.data || [],
      headers: [
        { label: 'Invoice #', key: 'invoiceNumber' },
        { label: 'Student', key: 'studentName' },
        { label: 'Total Minor', key: 'totalMinor' },
        { label: 'Balance Minor', key: 'balanceMinor' },
        { label: 'Status', key: 'status' },
      ],
      columns: [
        { key: 'invoiceNumber', header: 'Invoice #' },
        { key: 'studentName', header: 'Student' },
        { key: 'totalMinor', header: 'Total', render: (i) => formatMinorUnits(i.totalMinor, currency) },
        { key: 'balanceMinor', header: 'Due', render: (i) => formatMinorUnits(i.balanceMinor, currency) },
        { key: 'status', header: 'Status' },
      ],
    },
    results: {
      rows: resultsQ.data || [],
      headers: [
        { label: 'Exam', key: 'examTitle' },
        { label: 'Student', key: 'studentName' },
        { label: 'Subject', key: 'subjectName' },
        { label: 'Marks', key: 'marksObtained' },
        { label: 'Grade', key: 'grade' },
      ],
      columns: [
        { key: 'examTitle', header: 'Exam' },
        { key: 'studentName', header: 'Student' },
        { key: 'subjectName', header: 'Subject' },
        { key: 'marksObtained', header: 'Marks' },
        { key: 'grade', header: 'Grade' },
      ],
    },
    placements: {
      rows: placementsQ.data || [],
      headers: [
        { label: 'Student', key: 'studentName' },
        { label: 'Company', key: 'companyName' },
        { label: 'Role', key: 'roleTitle' },
        { label: 'Stage', key: 'status' },
      ],
      columns: [
        { key: 'studentName', header: 'Student' },
        { key: 'companyName', header: 'Company' },
        { key: 'roleTitle', header: 'Role' },
        { key: 'status', header: 'Stage' },
      ],
    },
  };

  const current = exportConfig[activeReportType];

  const handleExport = () => {
    exportRowsToCsv(`campusos-${activeReportType}-report.csv`, current.headers, current.rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports &amp; Analytics"
        description="Live tenant-scoped institutional analytics with formula-safe CSV exports."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Reports' }]}
        actions={
          <Button onClick={handleExport} disabled={current.rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV ({current.rows.length})
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {can(PERMISSIONS.ATTENDANCE_READ) && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Attendance Status Distribution</CardTitle>
                <CardDescription>Computed from {attendanceQ.data?.length || 0} recorded sessions</CardDescription>
              </div>
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4338ca" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {can(PERMISSIONS.FINANCE_READ) && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Fee Invoice Breakdown</CardTitle>
                <CardDescription>Across {invoicesQ.data?.length || 0} student invoices</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={financeSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                    {financeSummary.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs
        activeTab={activeReportType}
        onChange={setReportType}
        tabs={availableTabs}
      />

      <DataTable columns={current.columns} data={current.rows} />
    </div>
  );
}
