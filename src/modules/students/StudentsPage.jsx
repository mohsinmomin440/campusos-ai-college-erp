import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Eye, Edit } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenantCrud, useTenantQuery } from '@/hooks/useTenantCollection';
import { PERMISSIONS } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';

const studentSchema = z.object({
  enrollmentNumber: z.string().min(3, 'Enrollment number is required.'),
  fullName: z.string().min(2, 'Student full name is required.'),
  email: z.string().email('Valid email required.'),
  phone: z.string().optional().default(''),
  departmentId: z.string().optional().default(''),
  courseId: z.string().optional().default(''),
  semesterId: z.string().default('sem-1'),
  guardianName: z.string().optional().default(''),
  guardianPhone: z.string().optional().default(''),
  status: z.enum(['applicant', 'active', 'suspended', 'graduated', 'withdrawn']).default('active'),
});

const STATUS_VARIANTS = {
  active: 'success',
  applicant: 'info',
  suspended: 'danger',
  graduated: 'indigo',
  withdrawn: 'neutral',
};

export default function StudentsPage() {
  const { can } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const studentsQ = useTenantQuery('students');
  const departmentsQ = useTenantQuery('departments');
  const coursesQ = useTenantQuery('courses');
  const { createMutation, updateMutation } = useTenantCrud('students', { label: 'Student' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(studentSchema),
  });

  const openCreate = () => {
    setEditing(null);
    reset({
      enrollmentNumber: `CMP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
      fullName: '',
      email: '',
      phone: '',
      departmentId: departmentsQ.data?.[0]?.id || '',
      courseId: coursesQ.data?.[0]?.id || '',
      semesterId: 'sem-1',
      guardianName: '',
      guardianPhone: '',
      status: 'active',
    });
    setFormOpen(true);
  };

  const openEdit = (student) => {
    setEditing(student);
    reset({
      enrollmentNumber: student.enrollmentNumber || '',
      fullName: student.fullName || '',
      email: student.email || '',
      phone: student.phone || '',
      departmentId: student.departmentId || '',
      courseId: student.courseId || '',
      semesterId: student.semesterId || 'sem-1',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      status: student.status || 'active',
    });
    setFormOpen(true);
  };

  const onSubmit = async (values) => {
    const payload = { ...values, email: values.email.trim().toLowerCase() };
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: payload });
    } else {
      await createMutation.mutateAsync({ data: payload });
    }
    setFormOpen(false);
  };

  const deptMap = useMemo(
    () => Object.fromEntries((departmentsQ.data || []).map((d) => [d.id, d.name])),
    [departmentsQ.data]
  );
  const courseMap = useMemo(
    () => Object.fromEntries((coursesQ.data || []).map((c) => [c.id, c.name])),
    [coursesQ.data]
  );

  const filtered = useMemo(() => {
    const rows = studentsQ.data || [];
    return statusFilter === 'all' ? rows : rows.filter((s) => s.status === statusFilter);
  }, [studentsQ.data, statusFilter]);

  const columns = [
    {
      key: 'fullName',
      header: 'Student',
      render: (s) => (
        <div>
          <p className="font-medium text-slate-900">{s.fullName}</p>
          <p className="font-mono text-xs text-slate-500">{s.enrollmentNumber}</p>
        </div>
      ),
    },
    { key: 'email', header: 'Email' },
    {
      key: 'departmentId',
      header: 'Department / Course',
      render: (s) => (
        <span className="text-xs text-slate-700">
          {deptMap[s.departmentId] || s.departmentId || '—'} / {courseMap[s.courseId] || s.courseId || '—'}
        </span>
      ),
    },
    { key: 'semesterId', header: 'Semester' },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <Badge variant={STATUS_VARIANTS[s.status] || 'neutral'}>{s.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setViewing(s)} aria-label={`View ${s.fullName}`}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {can(PERMISSIONS.STUDENTS_WRITE) && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(s)} aria-label={`Edit ${s.fullName}`}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Directory"
        description="Manage student enrollments, academic cohort assignments, guardian contacts, and status lifecycle."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Students' }]}
        actions={
          can(PERMISSIONS.STUDENTS_WRITE) && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Register Student
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={studentsQ.isLoading}
        error={studentsQ.error}
        onRetry={studentsQ.refetch}
        searchKeys={['fullName', 'enrollmentNumber', 'email']}
        searchPlaceholder="Search by name, enrollment ID, or email..."
        toolbarExtra={
          <Select
            aria-label="Filter by student status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="applicant">Applicant</option>
            <option value="suspended">Suspended</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Withdrawn</option>
          </Select>
        }
      />

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Student: ${editing.fullName}` : 'Register Student'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-enroll" required>Enrollment Number</Label>
              <Input id="s-enroll" {...register('enrollmentNumber')} error={errors.enrollmentNumber} />
              <FieldError message={errors.enrollmentNumber?.message} />
            </div>
            <div>
              <Label htmlFor="s-status">Status</Label>
              <Select id="s-status" {...register('status')}>
                <option value="active">Active</option>
                <option value="applicant">Applicant</option>
                <option value="suspended">Suspended</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="s-name" required>Full Name</Label>
            <Input id="s-name" {...register('fullName')} error={errors.fullName} />
            <FieldError message={errors.fullName?.message} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-email" required>Email</Label>
              <Input id="s-email" type="email" {...register('email')} error={errors.email} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" {...register('phone')} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="s-dept">Department</Label>
              <Select id="s-dept" {...register('departmentId')}>
                <option value="">Select</option>
                {(departmentsQ.data || []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="s-course">Course</Label>
              <Select id="s-course" {...register('courseId')}>
                <option value="">Select</option>
                {(coursesQ.data || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="s-sem">Semester</Label>
              <Select id="s-sem" {...register('semesterId')}>
                {['sem-1', 'sem-2', 'sem-3', 'sem-4', 'sem-5', 'sem-6'].map((s) => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-gname">Guardian Name</Label>
              <Input id="s-gname" {...register('guardianName')} />
            </div>
            <div>
              <Label htmlFor="s-gphone">Guardian Phone</Label>
              <Input id="s-gphone" {...register('guardianPhone')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Update Student' : 'Register Student'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.fullName || 'Student Profile'}>
        {viewing && (
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-slate-500">Enrollment ID</dt><dd className="font-mono font-medium">{viewing.enrollmentNumber}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd><Badge variant={STATUS_VARIANTS[viewing.status] || 'neutral'}>{viewing.status}</Badge></dd></div>
            <div><dt className="text-slate-500">Email</dt><dd>{viewing.email}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd>{viewing.phone || '—'}</dd></div>
            <div><dt className="text-slate-500">Department</dt><dd>{deptMap[viewing.departmentId] || viewing.departmentId || '—'}</dd></div>
            <div><dt className="text-slate-500">Course</dt><dd>{courseMap[viewing.courseId] || viewing.courseId || '—'}</dd></div>
            <div><dt className="text-slate-500">Guardian</dt><dd>{viewing.guardianName || '—'}</dd></div>
            <div><dt className="text-slate-500">Guardian Phone</dt><dd>{viewing.guardianPhone || '—'}</dd></div>
          </dl>
        )}
      </Dialog>
    </div>
  );
}
