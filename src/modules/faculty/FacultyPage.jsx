import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Briefcase, Plus, Users, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenantCrud, useTenantQuery } from '@/hooks/useTenantCollection';
import { PERMISSIONS } from '@/schemas/roles';
import { PageHeader, StatCard } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';

const staffSchema = z.object({
  employeeCode: z.string().min(2, 'Employee ID required.'),
  fullName: z.string().min(2, 'Full name required.'),
  email: z.string().email('Valid email required.'),
  departmentId: z.string().optional().default(''),
  designation: z.string().min(2, 'Designation required.'),
  workloadHours: z.coerce.number().int().min(0).max(50).default(16),
  assignedSubjects: z.string().optional().default(''),
  status: z.enum(['active', 'on_leave', 'inactive']).default('active'),
});

export default function FacultyPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('faculty');
  const [dialogOpen, setDialogOpen] = useState(false);

  const facultyQ = useTenantQuery('faculty');
  const staffQ = useTenantQuery('staff');
  const departmentsQ = useTenantQuery('departments');

  const facultyCrud = useTenantCrud('faculty', { label: 'Faculty member' });
  const staffCrud = useTenantCrud('staff', { label: 'Staff member' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(staffSchema),
    defaultValues: { workloadHours: 16, status: 'active' },
  });

  const deptMap = useMemo(
    () => Object.fromEntries((departmentsQ.data || []).map((d) => [d.id, d.name])),
    [departmentsQ.data]
  );

  const activeData = tab === 'faculty' ? facultyQ.data || [] : staffQ.data || [];
  const activeQuery = tab === 'faculty' ? facultyQ : staffQ;

  const onSubmit = async (values) => {
    const crud = tab === 'faculty' ? facultyCrud : staffCrud;
    await crud.createMutation.mutateAsync({ data: values });
    reset();
    setDialogOpen(false);
  };

  const avgWorkload = useMemo(() => {
    const list = facultyQ.data || [];
    if (!list.length) return 0;
    const sum = list.reduce((acc, f) => acc + Number(f.workloadHours || 0), 0);
    return Math.round((sum / list.length) * 10) / 10;
  }, [facultyQ.data]);

  const columns = [
    {
      key: 'fullName',
      header: 'Name',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.fullName}</p>
          <p className="font-mono text-xs text-slate-500">{r.employeeCode} • {r.email}</p>
        </div>
      ),
    },
    { key: 'designation', header: 'Designation' },
    {
      key: 'departmentId',
      header: 'Department',
      render: (r) => deptMap[r.departmentId] || r.departmentId || 'Administration',
    },
    ...(tab === 'faculty'
      ? [
          { key: 'assignedSubjects', header: 'Assigned Subjects', render: (r) => r.assignedSubjects || '—' },
          { key: 'workloadHours', header: 'Workload (hrs/wk)', render: (r) => `${r.workloadHours ?? 0} hrs` },
        ]
      : []),
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'active' ? 'success' : r.status === 'on_leave' ? 'warning' : 'neutral'}>
          {r.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty &amp; Staff Directory"
        description="Manage department assignments, designations, teaching workload, and staff directory records."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Faculty & Staff' }]}
        actions={
          can(PERMISSIONS.FACULTY_WRITE) && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add {tab === 'faculty' ? 'Faculty' : 'Staff'}
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Teaching Faculty" value={(facultyQ.data || []).length} icon={Briefcase} tone="indigo" />
        <StatCard label="Support Staff" value={(staffQ.data || []).length} icon={Users} tone="emerald" />
        <StatCard label="Avg Faculty Workload" value={`${avgWorkload} hrs/wk`} icon={Clock} tone="amber" />
      </div>

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'faculty', label: 'Teaching Faculty', count: (facultyQ.data || []).length },
          { id: 'staff', label: 'Administrative Staff', count: (staffQ.data || []).length },
        ]}
      />

      <DataTable
        columns={columns}
        data={activeData}
        loading={activeQuery.isLoading}
        error={activeQuery.error}
        onRetry={activeQuery.refetch}
        searchKeys={['fullName', 'employeeCode', 'designation', 'assignedSubjects']}
        searchPlaceholder="Search faculty or staff..."
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={`Add ${tab === 'faculty' ? 'Teaching Faculty' : 'Administrative Staff'}`}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="f-code" required>Employee ID</Label>
              <Input id="f-code" placeholder="FAC-101" {...register('employeeCode')} error={errors.employeeCode} />
              <FieldError message={errors.employeeCode?.message} />
            </div>
            <div>
              <Label htmlFor="f-status">Status</Label>
              <Select id="f-status" {...register('status')}>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="f-name" required>Full Name</Label>
            <Input id="f-name" {...register('fullName')} error={errors.fullName} />
            <FieldError message={errors.fullName?.message} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="f-email" required>Email</Label>
              <Input id="f-email" type="email" {...register('email')} error={errors.email} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="f-desig" required>Designation</Label>
              <Input id="f-desig" placeholder="Assistant Professor" {...register('designation')} error={errors.designation} />
              <FieldError message={errors.designation?.message} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="f-dept">Department</Label>
              <Select id="f-dept" {...register('departmentId')}>
                <option value="">General</option>
                {(departmentsQ.data || []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-hrs">Weekly Workload (Hours)</Label>
              <Input id="f-hrs" type="number" {...register('workloadHours')} />
            </div>
          </div>
          {tab === 'faculty' && (
            <div>
              <Label htmlFor="f-subj">Assigned Subjects</Label>
              <Input id="f-subj" placeholder="DBMS, Cloud Computing" {...register('assignedSubjects')} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" loading={facultyCrud.createMutation.isPending || staffCrud.createMutation.isPending}>
              Save Profile
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
