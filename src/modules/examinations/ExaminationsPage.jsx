import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award, Plus, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { where } from '@/firebase/firestore';
import { useTenantCrud, useTenantQuery, useTrustedFunction } from '@/hooks/useTenantCollection';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';

const examSchema = z.object({
  title: z.string().min(3),
  subjectName: z.string().min(2),
  semesterId: z.string().default('sem-6'),
  examDate: z.string().min(4),
  maxMarks: z.coerce.number().int().min(10).max(500).default(100),
  passMarks: z.coerce.number().int().min(1).max(400).default(40),
});

const marksSchema = z.object({
  examId: z.string().min(1, 'Select an examination.'),
  studentId: z.string().min(1, 'Select a student.'),
  marksObtained: z.coerce.number().min(0, 'Marks must be non-negative.'),
});

export default function ExaminationsPage() {
  const { activeTenantId, user, role, linkedStudentIds, can } = useAuth();
  const [tab, setTab] = useState('exams');
  const [examOpen, setExamOpen] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false);

  const resultsScope = useMemo(() => {
    if (role === ROLES.STUDENT && user?.uid) {
      return {
        constraints: [where('published', '==', true), where('studentUid', '==', user.uid)],
        enabled: true,
        extra: ['student', user.uid],
      };
    }
    if (role === ROLES.PARENT) {
      return {
        constraints: linkedStudentIds.length
          ? [where('published', '==', true), where('studentId', 'in', linkedStudentIds.slice(0, 10))]
          : [],
        enabled: linkedStudentIds.length > 0,
        extra: ['parent', linkedStudentIds.join(',')],
      };
    }
    return { constraints: [], enabled: true, extra: ['staff'] };
  }, [role, user?.uid, linkedStudentIds]);

  const examsQ = useTenantQuery('examinations');
  const resultsQ = useTenantQuery('results', {
    constraints: resultsScope.constraints,
    enabled: resultsScope.enabled,
    queryKeyExtra: resultsScope.extra,
  });
  const studentsQ = useTenantQuery('students', { enabled: can(PERMISSIONS.EXAMS_MARKS_WRITE) });

  const examCrud = useTenantCrud('examinations', { label: 'Examination' });
  const resultCrud = useTenantCrud('results', { label: 'Draft marks' });
  const publishFn = useTrustedFunction('publishExamResults', {
    invalidateCollections: ['examinations', 'results'],
    successTitle: 'Exam results verified & published',
  });

  const examForm = useForm({
    resolver: zodResolver(examSchema),
    defaultValues: { semesterId: 'sem-6', maxMarks: 100, passMarks: 40 },
  });

  const marksForm = useForm({
    resolver: zodResolver(marksSchema),
  });

  const examsMap = useMemo(
    () => Object.fromEntries((examsQ.data || []).map((e) => [e.id, e])),
    [examsQ.data]
  );

  const onCreateExam = async (values) => {
    await examCrud.createMutation.mutateAsync({
      data: { ...values, status: 'scheduled' },
    });
    examForm.reset();
    setExamOpen(false);
  };

  const onSaveMarks = async (values) => {
    const exam = examsMap[values.examId];
    const student = (studentsQ.data || []).find((s) => s.id === values.studentId);
    const maxMarks = Number(exam?.maxMarks || 100);
    if (values.marksObtained > maxMarks) {
      marksForm.setError('marksObtained', { message: `Cannot exceed max marks (${maxMarks}).` });
      return;
    }
    await resultCrud.createMutation.mutateAsync({
      customId: `${values.examId}_${values.studentId}`,
      data: {
        examId: values.examId,
        examTitle: exam?.title || '',
        subjectName: exam?.subjectName || '',
        studentId: values.studentId,
        studentUid: student?.uid || '',
        studentName: student?.fullName || '',
        marksObtained: values.marksObtained,
        maxMarks,
        published: false,
      },
    });
    marksForm.reset();
    setMarksOpen(false);
  };

  const examColumns = [
    { key: 'title', header: 'Examination' },
    { key: 'subjectName', header: 'Subject' },
    { key: 'examDate', header: 'Date' },
    { key: 'maxMarks', header: 'Max / Pass', render: (e) => `${e.maxMarks} / ${e.passMarks}` },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <Badge variant={e.status === 'published' ? 'success' : 'warning'}>{e.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Publication',
      render: (e) =>
        can(PERMISSIONS.EXAMS_PUBLISH) && e.status !== 'published' ? (
          <Button
            size="sm"
            variant="primary"
            loading={publishFn.isPending}
            onClick={() => publishFn.mutateAsync({ tenantId: activeTenantId, examId: e.id })}
          >
            <Send className="h-3.5 w-3.5" /> Compute &amp; Publish
          </Button>
        ) : (
          <span className="text-xs text-slate-500">{e.status === 'published' ? 'Published' : 'Draft'}</span>
        ),
    },
  ];

  const resultColumns = [
    { key: 'examTitle', header: 'Exam' },
    { key: 'subjectName', header: 'Subject' },
    { key: 'studentName', header: 'Student' },
    { key: 'marksObtained', header: 'Marks', render: (r) => `${r.marksObtained} / ${r.maxMarks || 100}` },
    { key: 'percentage', header: '%', render: (r) => (r.published ? `${r.percentage}%` : 'Pending') },
    {
      key: 'grade',
      header: 'Grade',
      render: (r) =>
        r.published ? (
          <Badge variant={r.passed ? 'success' : 'danger'}>
            {r.grade} ({r.passed ? 'PASS' : 'FAIL'})
          </Badge>
        ) : (
          <Badge variant="neutral">Draft</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examinations &amp; Results"
        description="Schedule examinations, record faculty draft marks, and verify/publish grades server-side via Cloud Functions."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Examinations' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {can(PERMISSIONS.EXAMS_MARKS_WRITE) && (
              <>
                <Button variant="secondary" onClick={() => setExamOpen(true)}>
                  <Plus className="h-4 w-4" /> Schedule Exam
                </Button>
                <Button onClick={() => setMarksOpen(true)}>
                  <Award className="h-4 w-4" /> Enter Draft Marks
                </Button>
              </>
            )}
          </div>
        }
      />

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'exams', label: 'Exam Schedule', count: (examsQ.data || []).length },
          { id: 'results', label: 'Marks & Results', count: (resultsQ.data || []).length },
        ]}
      />

      {tab === 'exams' ? (
        <DataTable columns={examColumns} data={examsQ.data || []} loading={examsQ.isLoading} />
      ) : (
        <DataTable columns={resultColumns} data={resultsQ.data || []} loading={resultsQ.isLoading} searchKeys={['studentName', 'subjectName', 'examTitle']} />
      )}

      <Dialog open={examOpen} onClose={() => setExamOpen(false)} title="Schedule Examination">
        <form onSubmit={examForm.handleSubmit(onCreateExam)} className="space-y-3.5">
          <div>
            <Label htmlFor="ex-title" required>Exam Title</Label>
            <Input id="ex-title" placeholder="Mid-Semester Exam Nov 2026" {...examForm.register('title')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ex-subj" required>Subject</Label>
              <Input id="ex-subj" placeholder="Distributed Systems" {...examForm.register('subjectName')} />
            </div>
            <div>
              <Label htmlFor="ex-date" required>Exam Date</Label>
              <Input id="ex-date" type="date" {...examForm.register('examDate')} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="ex-sem">Semester</Label>
              <Input id="ex-sem" {...examForm.register('semesterId')} />
            </div>
            <div>
              <Label htmlFor="ex-max">Max Marks</Label>
              <Input id="ex-max" type="number" {...examForm.register('maxMarks')} />
            </div>
            <div>
              <Label htmlFor="ex-pass">Pass Marks</Label>
              <Input id="ex-pass" type="number" {...examForm.register('passMarks')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setExamOpen(false)}>Cancel</Button>
            <Button type="submit" loading={examCrud.createMutation.isPending}>Schedule</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={marksOpen} onClose={() => setMarksOpen(false)} title="Enter Draft Student Marks">
        <form onSubmit={marksForm.handleSubmit(onSaveMarks)} className="space-y-3.5">
          <div>
            <Label htmlFor="mk-exam" required>Examination</Label>
            <Select id="mk-exam" {...marksForm.register('examId')}>
              <option value="">Select exam</option>
              {(examsQ.data || []).map((e) => (
                <option key={e.id} value={e.id}>{e.title} — {e.subjectName} (Max {e.maxMarks})</option>
              ))}
            </Select>
            <FieldError message={marksForm.formState.errors.examId?.message} />
          </div>
          <div>
            <Label htmlFor="mk-stu" required>Student</Label>
            <Select id="mk-stu" {...marksForm.register('studentId')}>
              <option value="">Select student</option>
              {(studentsQ.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.enrollmentNumber})</option>
              ))}
            </Select>
            <FieldError message={marksForm.formState.errors.studentId?.message} />
          </div>
          <div>
            <Label htmlFor="mk-val" required>Marks Obtained</Label>
            <Input id="mk-val" type="number" {...marksForm.register('marksObtained')} />
            <FieldError message={marksForm.formState.errors.marksObtained?.message} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setMarksOpen(false)}>Cancel</Button>
            <Button type="submit" loading={resultCrud.createMutation.isPending}>Save Draft Marks</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
