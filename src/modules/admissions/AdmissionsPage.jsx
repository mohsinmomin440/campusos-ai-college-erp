import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, UserCheck, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenantCrud, useTenantQuery, useTrustedFunction } from '@/hooks/useTenantCollection';
import { PERMISSIONS } from '@/schemas/roles';
import { PageHeader, StatCard } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Textarea, FieldError } from '@/components/ui/Input';
import { formatDate } from '@/utils/date';

const admissionSchema = z.object({
  applicantName: z.string().min(2, 'Applicant name is required.'),
  email: z.string().email('Valid email required.'),
  phone: z.string().min(7, 'Phone number is required.'),
  programApplied: z.string().min(2, 'Program is required.'),
  previousPercentage: z.coerce.number().min(0).max(100),
  guardianName: z.string().optional().default(''),
  guardianPhone: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const STATUS_BADGE = {
  enquiry: 'neutral',
  submitted: 'info',
  under_review: 'warning',
  approved: 'indigo',
  enrolled: 'success',
  rejected: 'danger',
};

export default function AdmissionsPage() {
  const { activeTenantId, can } = useAuth();
  const [stageFilter, setStageFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewApp, setReviewApp] = useState(null);
  const [remarks, setRemarks] = useState('');

  const admissionsQ = useTenantQuery('admissions');
  const { createMutation } = useTenantCrud('admissions', { label: 'Application' });
  const decideFn = useTrustedFunction('decideAdmission', {
    invalidateCollections: ['admissions', 'students'],
    successTitle: 'Admission decision recorded',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(admissionSchema),
    defaultValues: { previousPercentage: 75 },
  });

  const rows = useMemo(() => admissionsQ.data || [], [admissionsQ.data]);
  const filteredRows = useMemo(
    () => (stageFilter === 'all' ? rows : rows.filter((r) => r.status === stageFilter)),
    [rows, stageFilter]
  );

  const onCreate = async (values) => {
    await createMutation.mutateAsync({
      data: {
        ...values,
        email: values.email.trim().toLowerCase(),
        status: 'submitted',
      },
    });
    reset();
    setCreateOpen(false);
  };

  const handleDecision = async (decision) => {
    if (!reviewApp) return;
    await decideFn.mutateAsync({
      tenantId: activeTenantId,
      applicationId: reviewApp.id,
      decision,
      remarks,
    });
    setReviewApp(null);
    setRemarks('');
  };

  const columns = [
    {
      key: 'applicantName',
      header: 'Applicant',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.applicantName}</p>
          <p className="text-xs text-slate-500">{r.email} • {r.phone}</p>
        </div>
      ),
    },
    { key: 'programApplied', header: 'Program' },
    {
      key: 'previousPercentage',
      header: 'Qualifying %',
      render: (r) => `${r.previousPercentage ?? '—'}%`,
    },
    {
      key: 'status',
      header: 'Stage',
      render: (r) => <Badge variant={STATUS_BADGE[r.status] || 'neutral'}>{r.status}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (r) => formatDate(r.createdAt),
    },
    {
      key: 'actions',
      header: 'Review',
      render: (r) =>
        can(PERMISSIONS.ADMISSIONS_DECIDE) && r.status !== 'enrolled' ? (
          <Button size="sm" variant="secondary" onClick={() => setReviewApp(r)}>
            Review / Decide
          </Button>
        ) : (
          <span className="text-xs text-slate-400">
            {r.convertedStudentId ? `Student #${r.convertedStudentId.slice(0, 6)}` : '—'}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions &amp; Enquiries"
        description="Track prospective applicants, verify qualifications, and convert approved applicants into student records atomically."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Admissions' }]}
        actions={
          can(PERMISSIONS.ADMISSIONS_WRITE) && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Application
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Applications" value={rows.length} icon={Clock} tone="indigo" />
        <StatCard label="Submitted / Review" value={rows.filter((r) => ['submitted', 'under_review'].includes(r.status)).length} icon={Clock} tone="amber" />
        <StatCard label="Enrolled Students" value={rows.filter((r) => r.status === 'enrolled').length} icon={UserCheck} tone="emerald" />
        <StatCard label="Rejected" value={rows.filter((r) => r.status === 'rejected').length} icon={XCircle} tone="rose" />
      </div>

      <Tabs
        activeTab={stageFilter}
        onChange={setStageFilter}
        tabs={[
          { id: 'all', label: 'All', count: rows.length },
          { id: 'submitted', label: 'Submitted', count: rows.filter((r) => r.status === 'submitted').length },
          { id: 'under_review', label: 'Under Review', count: rows.filter((r) => r.status === 'under_review').length },
          { id: 'approved', label: 'Approved', count: rows.filter((r) => r.status === 'approved').length },
          { id: 'enrolled', label: 'Enrolled', count: rows.filter((r) => r.status === 'enrolled').length },
          { id: 'rejected', label: 'Rejected', count: rows.filter((r) => r.status === 'rejected').length },
        ]}
      />

      <DataTable
        columns={columns}
        data={filteredRows}
        loading={admissionsQ.isLoading}
        error={admissionsQ.error}
        onRetry={admissionsQ.refetch}
        searchKeys={['applicantName', 'email', 'programApplied', 'status']}
        searchPlaceholder="Search applicants..."
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create Admission Application">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-3.5">
          <div>
            <Label htmlFor="a-name" required>Applicant Full Name</Label>
            <Input id="a-name" {...register('applicantName')} error={errors.applicantName} />
            <FieldError message={errors.applicantName?.message} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="a-email" required>Email</Label>
              <Input id="a-email" type="email" {...register('email')} error={errors.email} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="a-phone" required>Phone</Label>
              <Input id="a-phone" {...register('phone')} error={errors.phone} />
              <FieldError message={errors.phone?.message} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="a-prog" required>Program Applied</Label>
              <Input id="a-prog" placeholder="BCA Honours" {...register('programApplied')} error={errors.programApplied} />
              <FieldError message={errors.programApplied?.message} />
            </div>
            <div>
              <Label htmlFor="a-pct" required>Previous Qualifying %</Label>
              <Input id="a-pct" type="number" step="0.1" {...register('previousPercentage')} error={errors.previousPercentage} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="a-gname">Guardian Name</Label>
              <Input id="a-gname" {...register('guardianName')} />
            </div>
            <div>
              <Label htmlFor="a-gphone">Guardian Phone</Label>
              <Input id="a-gphone" {...register('guardianPhone')} />
            </div>
          </div>
          <div>
            <Label htmlFor="a-notes">Notes</Label>
            <Textarea id="a-notes" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Submit Application</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(reviewApp)}
        onClose={() => setReviewApp(null)}
        title={`Human Admission Review: ${reviewApp?.applicantName || ''}`}
        description="Final admission & enrollment decisions require authorized human review and write an audit entry."
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
            <p><strong>Program:</strong> {reviewApp?.programApplied}</p>
            <p><strong>Score:</strong> {reviewApp?.previousPercentage}%</p>
            <p><strong>Current Stage:</strong> {reviewApp?.status}</p>
          </div>
          <div>
            <Label htmlFor="rev-remarks">Review Remarks</Label>
            <Textarea
              id="rev-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Document verification and eligibility remarks..."
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="danger" loading={decideFn.isPending} onClick={() => handleDecision('rejected')}>
              Reject
            </Button>
            <Button variant="secondary" loading={decideFn.isPending} onClick={() => handleDecision('approved')}>
              Approve Only
            </Button>
            <Button variant="success" loading={decideFn.isPending} onClick={() => handleDecision('enrolled')}>
              <CheckCircle2 className="h-4 w-4" /> Approve &amp; Enroll Student
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
