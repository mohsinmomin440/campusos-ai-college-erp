import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenantCrud, useTenantQuery } from '@/hooks/useTenantCollection';
import { PERMISSIONS } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { detectTimetableClash } from '@/utils/timetable';

const deptSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  hodName: z.string().optional().default(''),
});

const courseSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  departmentId: z.string().optional().default(''),
  durationSemesters: z.coerce.number().int().min(1).max(12).default(6),
});

const subjectSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  courseId: z.string().optional().default(''),
  credits: z.coerce.number().int().min(1).max(10).default(4),
  semesterId: z.string().default('sem-1'),
});

const timetableSchema = z.object({
  dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
  startTime: z.string().min(4),
  endTime: z.string().min(4),
  classId: z.string().min(2, 'Class/Section is required.'),
  subjectName: z.string().min(2, 'Subject name is required.'),
  facultyName: z.string().min(2, 'Faculty name is required.'),
  room: z.string().min(1, 'Room is required.'),
});

export default function AcademicsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('departments');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clashError, setClashError] = useState('');

  const deptsQ = useTenantQuery('departments');
  const coursesQ = useTenantQuery('courses');
  const subjectsQ = useTenantQuery('subjects');
  const classesQ = useTenantQuery('classes');
  const timetableQ = useTenantQuery('timetables');

  const deptCrud = useTenantCrud('departments', { label: 'Department' });
  const courseCrud = useTenantCrud('courses', { label: 'Course' });
  const subjectCrud = useTenantCrud('subjects', { label: 'Subject' });
  const classCrud = useTenantCrud('classes', { label: 'Class / Division' });
  const timetableCrud = useTenantCrud('timetables', { label: 'Timetable slot' });

  const deptForm = useForm({ resolver: zodResolver(deptSchema) });
  const courseForm = useForm({ resolver: zodResolver(courseSchema), defaultValues: { durationSemesters: 6 } });
  const subjectForm = useForm({ resolver: zodResolver(subjectSchema), defaultValues: { credits: 4, semesterId: 'sem-1' } });
  const classForm = useForm({ defaultValues: { name: '', academicYear: '2026-27', semesterId: 'sem-1', division: 'A' } });
  const ttForm = useForm({
    resolver: zodResolver(timetableSchema),
    defaultValues: { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' },
  });

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    setClashError('');
    if (tab === 'departments') {
      await deptForm.handleSubmit(async (v) => {
        await deptCrud.createMutation.mutateAsync({ data: v });
        deptForm.reset();
        setDialogOpen(false);
      })();
    } else if (tab === 'courses') {
      await courseForm.handleSubmit(async (v) => {
        await courseCrud.createMutation.mutateAsync({ data: v });
        courseForm.reset();
        setDialogOpen(false);
      })();
    } else if (tab === 'subjects') {
      await subjectForm.handleSubmit(async (v) => {
        await subjectCrud.createMutation.mutateAsync({ data: v });
        subjectForm.reset();
        setDialogOpen(false);
      })();
    } else if (tab === 'classes') {
      await classForm.handleSubmit(async (v) => {
        await classCrud.createMutation.mutateAsync({ data: v });
        classForm.reset();
        setDialogOpen(false);
      })();
    } else {
      await ttForm.handleSubmit(async (v) => {
        const clash = detectTimetableClash(timetableQ.data || [], v);
        if (clash) {
          setClashError(clash);
          return;
        }
        await timetableCrud.createMutation.mutateAsync({ data: v });
        ttForm.reset();
        setDialogOpen(false);
      })();
    }
  };

  const canWrite = can(PERMISSIONS.ACADEMICS_WRITE) || can(PERMISSIONS.TIMETABLE_WRITE);

  const tabMeta = {
    departments: {
      query: deptsQ,
      columns: [
        { key: 'code', header: 'Code', render: (r) => <Badge variant="indigo">{r.code}</Badge> },
        { key: 'name', header: 'Department Name' },
        { key: 'hodName', header: 'Head of Department', render: (r) => r.hodName || '—' },
      ],
    },
    courses: {
      query: coursesQ,
      columns: [
        { key: 'code', header: 'Code', render: (r) => <Badge variant="indigo">{r.code}</Badge> },
        { key: 'name', header: 'Program / Course' },
        { key: 'durationSemesters', header: 'Semesters' },
      ],
    },
    subjects: {
      query: subjectsQ,
      columns: [
        { key: 'code', header: 'Code', render: (r) => <Badge variant="neutral">{r.code}</Badge> },
        { key: 'name', header: 'Subject Title' },
        { key: 'credits', header: 'Credits' },
        { key: 'semesterId', header: 'Semester' },
      ],
    },
    classes: {
      query: classesQ,
      columns: [
        { key: 'name', header: 'Class / Batch' },
        { key: 'division', header: 'Division' },
        { key: 'semesterId', header: 'Semester' },
        { key: 'academicYear', header: 'Academic Year' },
      ],
    },
    timetable: {
      query: timetableQ,
      columns: [
        { key: 'dayOfWeek', header: 'Day', render: (r) => <Badge variant="indigo">{r.dayOfWeek}</Badge> },
        { key: 'time', header: 'Time Slot', render: (r) => `${r.startTime} – ${r.endTime}` },
        { key: 'classId', header: 'Class' },
        { key: 'subjectName', header: 'Subject' },
        { key: 'facultyName', header: 'Faculty' },
        { key: 'room', header: 'Room' },
      ],
    },
  };

  const current = tabMeta[tab];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academics &amp; Timetable"
        description="Configure departments, degree courses, subjects, class divisions, and clash-checked timetables."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Academics & Timetable' }]}
        actions={
          canWrite && (
            <Button onClick={() => { setClashError(''); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Add {tab === 'timetable' ? 'Slot' : tab.slice(0, -1)}
            </Button>
          )
        }
      />

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'departments', label: 'Departments', count: (deptsQ.data || []).length },
          { id: 'courses', label: 'Courses', count: (coursesQ.data || []).length },
          { id: 'subjects', label: 'Subjects', count: (subjectsQ.data || []).length },
          { id: 'classes', label: 'Classes & Years', count: (classesQ.data || []).length },
          { id: 'timetable', label: 'Timetable', count: (timetableQ.data || []).length },
        ]}
      />

      <DataTable
        columns={current.columns}
        data={current.query.data || []}
        loading={current.query.isLoading}
        error={current.query.error}
        onRetry={current.query.refetch}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={`Add ${tab}`}>
        <form onSubmit={handleCreate} className="space-y-3.5">
          {clashError && (
            <StatusBanner tone="error" title="Timetable Clash Detected" description={clashError} />
          )}

          {tab === 'departments' && (
            <>
              <div>
                <Label htmlFor="d-code" required>Department Code</Label>
                <Input id="d-code" placeholder="CS" {...deptForm.register('code')} />
                <FieldError message={deptForm.formState.errors.code?.message} />
              </div>
              <div>
                <Label htmlFor="d-name" required>Department Name</Label>
                <Input id="d-name" placeholder="Computer Applications" {...deptForm.register('name')} />
                <FieldError message={deptForm.formState.errors.name?.message} />
              </div>
              <div>
                <Label htmlFor="d-hod">HOD Name</Label>
                <Input id="d-hod" placeholder="Dr. S. Kulkarni" {...deptForm.register('hodName')} />
              </div>
            </>
          )}

          {tab === 'courses' && (
            <>
              <div>
                <Label htmlFor="co-code" required>Course Code</Label>
                <Input id="co-code" placeholder="BCA" {...courseForm.register('code')} />
              </div>
              <div>
                <Label htmlFor="co-name" required>Course Name</Label>
                <Input id="co-name" placeholder="Bachelor of Computer Applications" {...courseForm.register('name')} />
              </div>
              <div>
                <Label htmlFor="co-sems">Duration (Semesters)</Label>
                <Input id="co-sems" type="number" {...courseForm.register('durationSemesters')} />
              </div>
            </>
          )}

          {tab === 'subjects' && (
            <>
              <div>
                <Label htmlFor="su-code" required>Subject Code</Label>
                <Input id="su-code" placeholder="BCA601" {...subjectForm.register('code')} />
              </div>
              <div>
                <Label htmlFor="su-name" required>Subject Name</Label>
                <Input id="su-name" placeholder="Artificial Intelligence & Cloud Systems" {...subjectForm.register('name')} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="su-cred">Credits</Label>
                  <Input id="su-cred" type="number" {...subjectForm.register('credits')} />
                </div>
                <div>
                  <Label htmlFor="su-sem">Semester</Label>
                  <Input id="su-sem" {...subjectForm.register('semesterId')} />
                </div>
              </div>
            </>
          )}

          {tab === 'classes' && (
            <>
              <div>
                <Label htmlFor="cl-name" required>Class Name</Label>
                <Input id="cl-name" placeholder="BCA Sem 6" {...classForm.register('name', { required: true })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="cl-div">Division</Label>
                  <Input id="cl-div" {...classForm.register('division')} />
                </div>
                <div>
                  <Label htmlFor="cl-sem">Semester</Label>
                  <Input id="cl-sem" {...classForm.register('semesterId')} />
                </div>
                <div>
                  <Label htmlFor="cl-yr">Academic Year</Label>
                  <Input id="cl-yr" {...classForm.register('academicYear')} />
                </div>
              </div>
            </>
          )}

          {tab === 'timetable' && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="tt-day">Day</Label>
                  <Select id="tt-day" {...ttForm.register('dayOfWeek')}>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tt-start">Start</Label>
                  <Input id="tt-start" type="time" {...ttForm.register('startTime')} />
                </div>
                <div>
                  <Label htmlFor="tt-end">End</Label>
                  <Input id="tt-end" type="time" {...ttForm.register('endTime')} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tt-class" required>Class / Section</Label>
                  <Input id="tt-class" placeholder="BCA Sem 6 - A" {...ttForm.register('classId')} />
                </div>
                <div>
                  <Label htmlFor="tt-room" required>Room / Lab</Label>
                  <Input id="tt-room" placeholder="Lab 302" {...ttForm.register('room')} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tt-subj" required>Subject</Label>
                  <Input id="tt-subj" placeholder="Cloud Architecture" {...ttForm.register('subjectName')} />
                </div>
                <div>
                  <Label htmlFor="tt-fac" required>Faculty Name</Label>
                  <Input id="tt-fac" placeholder="Prof. R. Iyer" {...ttForm.register('facultyName')} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
