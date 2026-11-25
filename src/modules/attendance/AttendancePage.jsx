import { useMemo, useState } from 'react';
import { CalendarCheck2, AlertTriangle, Check, X } from 'lucide-react';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { requireDb, where } from '@/firebase/firestore';
import { useTenantCrud, useTenantQuery } from '@/hooks/useTenantCollection';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader, StatCard } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/hooks/useToast';
import { todayIsoDate } from '@/utils/date';

const STATUS_BADGE = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
};

export default function AttendancePage() {
  const { activeTenantId, activeTenant, user, role, linkedStudentIds, can } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(can(PERMISSIONS.ATTENDANCE_WRITE) ? 'mark' : 'records');
  const [sessionDate, setSessionDate] = useState(todayIsoDate());
  const [classId, setClassId] = useState('BCA-S6-A');
  const [subjectId, setSubjectId] = useState('BCA601');
  const [marks, setMarks] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [corrModal, setCorrModal] = useState(null);
  const [corrStatus, setCorrStatus] = useState('present');
  const [corrReason, setCorrReason] = useState('');

  const attendanceScope = useMemo(() => {
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

  const studentsQ = useTenantQuery('students', { enabled: can(PERMISSIONS.STUDENTS_READ) });
  const attendanceQ = useTenantQuery('attendance', {
    constraints: attendanceScope.constraints,
    enabled: attendanceScope.enabled,
    queryKeyExtra: attendanceScope.extra,
  });
  const canSeeCorrections =
    can(PERMISSIONS.ATTENDANCE_WRITE) || can(PERMISSIONS.ATTENDANCE_APPROVE) || role === ROLES.AUDITOR;
  const correctionsQ = useTenantQuery('attendanceCorrections', { enabled: canSeeCorrections });
  const correctionsCrud = useTenantCrud('attendanceCorrections', { label: 'Correction request' });

  const threshold = Number(activeTenant?.attendanceThresholdPercent || 75);

  const studentSummaries = useMemo(() => {
    const records = attendanceQ.data || [];
    const byStudent = {};
    for (const r of records) {
      if (!byStudent[r.studentId]) {
        byStudent[r.studentId] = {
          studentId: r.studentId,
          studentName: r.studentName || r.studentId,
          total: 0,
          attended: 0,
        };
      }
      byStudent[r.studentId].total += 1;
      if (r.status === 'present' || r.status === 'late') {
        byStudent[r.studentId].attended += 1;
      }
    }
    return Object.values(byStudent).map((item) => ({
      ...item,
      percent: item.total ? Math.round((item.attended / item.total) * 1000) / 10 : 100,
    }));
  }, [attendanceQ.data]);

  const lowAttendanceAlerts = studentSummaries.filter((s) => s.percent < threshold);

  const handleSaveSession = async () => {
    const students = (studentsQ.data || []).filter((s) => s.status === 'active');
    if (!students.length) {
      toast({ variant: 'error', title: 'No active students found to mark attendance.' });
      return;
    }
    setSubmitting(true);
    try {
      const db = requireDb();
      // Deterministic ID prevents duplicate attendance records for the same student/class/subject/date
      await Promise.all(
        students.map((student) => {
          const compositeId = `${sessionDate}_${classId}_${subjectId}_${student.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          const status = marks[student.id] || 'present';
          return setDoc(
            doc(db, 'tenants', activeTenantId, 'attendance', compositeId),
            {
              tenantId: activeTenantId,
              date: sessionDate,
              classId,
              subjectId,
              studentId: student.id,
              studentUid: student.uid || '',
              studentName: student.fullName,
              status,
              markedByUid: user.uid,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        })
      );
      await queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'attendance'] });
      toast({ variant: 'success', title: `Attendance saved for ${students.length} students (${sessionDate}).` });
    } catch (err) {
      toast({ variant: 'error', title: 'Failed to save attendance', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const submitCorrection = async () => {
    if (!corrModal || !corrReason.trim()) return;
    await correctionsCrud.createMutation.mutateAsync({
      data: {
        attendanceId: corrModal.id,
        studentName: corrModal.studentName,
        date: corrModal.date,
        subjectId: corrModal.subjectId,
        currentStatus: corrModal.status,
        requestedStatus: corrStatus,
        reason: corrReason.trim(),
        requestedByUid: user.uid,
        status: 'pending',
      },
    });
    setCorrModal(null);
    setCorrReason('');
  };

  const reviewCorrection = async (corr, decision) => {
    try {
      const db = requireDb();
      await updateDoc(doc(db, 'tenants', activeTenantId, 'attendanceCorrections', corr.id), {
        status: decision,
        reviewedByUid: user.uid,
        updatedAt: serverTimestamp(),
      });
      if (decision === 'approved') {
        await updateDoc(doc(db, 'tenants', activeTenantId, 'attendance', corr.attendanceId), {
          status: corr.requestedStatus,
          correctedByUid: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'attendanceCorrections'] }),
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'attendance'] }),
      ]);
      toast({ variant: 'success', title: `Correction ${decision}` });
    } catch (err) {
      toast({ variant: 'error', title: 'Action failed', description: err.message });
    }
  };

  const recordColumns = [
    { key: 'date', header: 'Date' },
    { key: 'studentName', header: 'Student' },
    { key: 'classId', header: 'Class' },
    { key: 'subjectId', header: 'Subject' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge variant={STATUS_BADGE[r.status] || 'neutral'}>{r.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Correction',
      render: (r) =>
        can(PERMISSIONS.ATTENDANCE_WRITE) ? (
          <Button size="sm" variant="ghost" onClick={() => { setCorrModal(r); setCorrStatus('present'); }}>
            Request Change
          </Button>
        ) : '—',
    },
  ];

  const correctionColumns = [
    { key: 'studentName', header: 'Student' },
    { key: 'date', header: 'Session Date' },
    { key: 'change', header: 'Requested Change', render: (c) => `${c.currentStatus} → ${c.requestedStatus}` },
    { key: 'reason', header: 'Reason' },
    {
      key: 'status',
      header: 'Workflow',
      render: (c) => (
        <Badge variant={c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'danger' : 'warning'}>
          {c.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Approval',
      render: (c) =>
        can(PERMISSIONS.ATTENDANCE_APPROVE) && c.status === 'pending' ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="success" onClick={() => reviewCorrection(c, 'approved')}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="danger" onClick={() => reviewCorrection(c, 'rejected')}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Management"
        description="Session-based attendance entry with duplicate prevention, shortage thresholds, and correction approvals."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Attendance' }]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Session Entries" value={(attendanceQ.data || []).length} icon={CalendarCheck2} tone="indigo" />
        <StatCard label="Policy Threshold" value={`${threshold}%`} hint="Minimum required attendance" icon={CalendarCheck2} tone="emerald" />
        <StatCard label="Low-Attendance Alerts" value={lowAttendanceAlerts.length} hint="Students below threshold" icon={AlertTriangle} tone="rose" />
      </div>

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          ...(can(PERMISSIONS.ATTENDANCE_WRITE) ? [{ id: 'mark', label: 'Mark Session' }] : []),
          { id: 'records', label: 'Attendance History', count: (attendanceQ.data || []).length },
          { id: 'alerts', label: 'Percentages & Alerts', count: lowAttendanceAlerts.length },
          ...(canSeeCorrections ? [{ id: 'corrections', label: 'Corrections', count: (correctionsQ.data || []).length }] : []),
        ]}
      />

      {tab === 'mark' && can(PERMISSIONS.ATTENDANCE_WRITE) && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Subject Session Roll Call</CardTitle>
            <Button onClick={handleSaveSession} loading={submitting}>
              Save Session Attendance
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="att-date">Session Date</Label>
                <Input id="att-date" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="att-class">Class / Section</Label>
                <Input id="att-class" value={classId} onChange={(e) => setClassId(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="att-subj">Subject Code</Label>
                <Input id="att-subj" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {(studentsQ.data || []).filter((s) => s.status === 'active').map((student) => (
                <div key={student.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{student.fullName}</p>
                    <p className="font-mono text-xs text-slate-500">{student.enrollmentNumber}</p>
                  </div>
                  <Select
                    aria-label={`Attendance status for ${student.fullName}`}
                    value={marks[student.id] || 'present'}
                    onChange={(e) => setMarks((m) => ({ ...m, [student.id]: e.target.value }))}
                    className="w-36"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'records' && (
        <DataTable
          columns={recordColumns}
          data={attendanceQ.data || []}
          loading={attendanceQ.isLoading}
          error={attendanceQ.error}
          onRetry={attendanceQ.refetch}
          searchKeys={['studentName', 'subjectId', 'classId', 'date']}
        />
      )}

      {tab === 'alerts' && (
        <DataTable
          columns={[
            { key: 'studentName', header: 'Student' },
            { key: 'attended', header: 'Attended Sessions' },
            { key: 'total', header: 'Total Sessions' },
            {
              key: 'percent',
              header: 'Attendance %',
              render: (s) => (
                <Badge variant={s.percent < threshold ? 'danger' : 'success'}>
                  {s.percent}% {s.percent < threshold ? '(Below Threshold)' : '(Eligible)'}
                </Badge>
              ),
            },
          ]}
          data={studentSummaries}
          loading={attendanceQ.isLoading}
        />
      )}

      {tab === 'corrections' && (
        <DataTable
          columns={correctionColumns}
          data={correctionsQ.data || []}
          loading={correctionsQ.isLoading}
        />
      )}

      <Dialog open={Boolean(corrModal)} onClose={() => setCorrModal(null)} title="Request Attendance Correction">
        <div className="space-y-3.5">
          <p className="text-xs text-slate-600">
            Student: <strong>{corrModal?.studentName}</strong> ({corrModal?.date})
          </p>
          <div>
            <Label htmlFor="corr-st">Requested Status</Label>
            <Select id="corr-st" value={corrStatus} onChange={(e) => setCorrStatus(e.target.value)}>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
              <option value="absent">Absent</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="corr-reason" required>Audit Reason</Label>
            <Input
              id="corr-reason"
              value={corrReason}
              onChange={(e) => setCorrReason(e.target.value)}
              placeholder="Medical certificate verified / biometric sync correction"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCorrModal(null)}>Cancel</Button>
            <Button onClick={submitCorrection} loading={correctionsCrud.createMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
