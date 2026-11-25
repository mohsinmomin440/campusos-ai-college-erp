import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Library, Plus, BookCheck, RotateCcw } from 'lucide-react';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
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
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { todayIsoDate } from '@/utils/date';
import { formatMinorUnits } from '@/utils/money';

const bookSchema = z.object({
  isbn: z.string().min(4),
  title: z.string().min(2),
  author: z.string().min(2),
  category: z.string().min(2),
  totalCopies: z.coerce.number().int().min(1).default(1),
});

export default function LibraryPage() {
  const { activeTenantId, activeTenant, user, role, can } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currency = activeTenant?.currency || 'INR';

  const [tab, setTab] = useState('catalog');
  const [bookOpen, setBookOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [busy, setBusy] = useState(false);

  const booksQ = useTenantQuery('libraryBooks');
  const isStaffLoanReader =
    role === ROLES.PLATFORM_SUPER_ADMIN ||
    role === ROLES.COLLEGE_ADMIN ||
    role === ROLES.LIBRARIAN ||
    role === ROLES.AUDITOR;
  const loansQ = useTenantQuery('bookLoans', {
    constraints: isStaffLoanReader ? [] : user?.uid ? [where('studentUid', '==', user.uid)] : [],
    enabled: isStaffLoanReader || role === ROLES.STUDENT,
    queryKeyExtra: [isStaffLoanReader ? 'all' : user?.uid],
  });
  const studentsQ = useTenantQuery('students', { enabled: can(PERMISSIONS.LIBRARY_WRITE) });
  const bookCrud = useTenantCrud('libraryBooks', { label: 'Book' });

  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(bookSchema),
    defaultValues: { totalCopies: 3 },
  });

  const onAddBook = async (values) => {
    await bookCrud.createMutation.mutateAsync({
      data: {
        ...values,
        availableCopies: values.totalCopies,
      },
    });
    reset();
    setBookOpen(false);
  };

  const handleIssueBook = async (e) => {
    e.preventDefault();
    const book = (booksQ.data || []).find((b) => b.id === selectedBookId);
    const student = (studentsQ.data || []).find((s) => s.id === selectedStudentId);
    if (!book || !student) return;
    setBusy(true);
    try {
      const db = requireDb();
      const bookRef = doc(db, 'tenants', activeTenantId, 'libraryBooks', book.id);
      const loanRef = doc(db, 'tenants', activeTenantId, 'bookLoans', `loan_${Date.now()}`);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(bookRef);
        const avail = Number(snap.data()?.availableCopies ?? 0);
        if (avail <= 0) throw new Error('No copies currently available.');
        tx.update(bookRef, { availableCopies: avail - 1, updatedAt: serverTimestamp() });
        tx.set(loanRef, {
          tenantId: activeTenantId,
          bookId: book.id,
          bookTitle: book.title,
          studentId: student.id,
          studentUid: student.uid || '',
          studentName: student.fullName,
          issuedDate: todayIsoDate(),
          dueDate,
          status: 'issued',
          fineMinor: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'libraryBooks'] }),
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'bookLoans'] }),
      ]);
      toast({ variant: 'success', title: `Issued "${book.title}" to ${student.fullName}` });
      setIssueOpen(false);
    } catch (err) {
      toast({ variant: 'error', title: 'Issue failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleReturnBook = async (loan) => {
    setBusy(true);
    try {
      const db = requireDb();
      const bookRef = doc(db, 'tenants', activeTenantId, 'libraryBooks', loan.bookId);
      const loanRef = doc(db, 'tenants', activeTenantId, 'bookLoans', loan.id);

      const overdueDays = Math.max(
        0,
        Math.floor((Date.now() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      const fineMinor = overdueDays * 500; // ₹5.00 per day in integer minor units

      await runTransaction(db, async (tx) => {
        const bookSnap = await tx.get(bookRef);
        if (bookSnap.exists()) {
          tx.update(bookRef, {
            availableCopies: Number(bookSnap.data().availableCopies ?? 0) + 1,
            updatedAt: serverTimestamp(),
          });
        }
        tx.update(loanRef, {
          status: 'returned',
          returnedDate: todayIsoDate(),
          fineMinor,
          updatedAt: serverTimestamp(),
        });
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'libraryBooks'] }),
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'bookLoans'] }),
      ]);
      toast({
        variant: 'success',
        title: `Returned "${loan.bookTitle}"`,
        description: fineMinor > 0 ? `Overdue fine calculated: ${formatMinorUnits(fineMinor, currency)}` : 'Returned on time.',
      });
    } catch (err) {
      toast({ variant: 'error', title: 'Return failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const activeLoans = (loansQ.data || []).filter((l) => l.status === 'issued');
  const overdueLoans = activeLoans.filter((l) => l.dueDate < todayIsoDate());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library Management"
        description="Book catalog, inventory tracking, atomic issue/return circulation, and deterministic overdue fines."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Library' }]}
        actions={
          can(PERMISSIONS.LIBRARY_WRITE) && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setIssueOpen(true)}>
                <BookCheck className="h-4 w-4" /> Issue Book
              </Button>
              <Button onClick={() => setBookOpen(true)}>
                <Plus className="h-4 w-4" /> Add Book
              </Button>
            </div>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Catalog Titles" value={(booksQ.data || []).length} icon={Library} tone="indigo" />
        <StatCard label="Active Loans" value={activeLoans.length} icon={BookCheck} tone="emerald" />
        <StatCard label="Overdue Books" value={overdueLoans.length} icon={RotateCcw} tone="rose" />
      </div>

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'catalog', label: 'Book Catalog', count: (booksQ.data || []).length },
          { id: 'loans', label: 'Circulation & Fines', count: (loansQ.data || []).length },
        ]}
      />

      {tab === 'catalog' ? (
        <DataTable
          columns={[
            { key: 'title', header: 'Book Title', render: (b) => <div><p className="font-medium text-slate-900">{b.title}</p><p className="text-xs text-slate-500">{b.author} • ISBN {b.isbn}</p></div> },
            { key: 'category', header: 'Category', render: (b) => <Badge variant="neutral">{b.category}</Badge> },
            { key: 'availability', header: 'Copies Available', render: (b) => <Badge variant={b.availableCopies > 0 ? 'success' : 'danger'}>{b.availableCopies} / {b.totalCopies}</Badge> },
          ]}
          data={booksQ.data || []}
          loading={booksQ.isLoading}
          searchKeys={['title', 'author', 'isbn', 'category']}
        />
      ) : (
        <DataTable
          columns={[
            { key: 'bookTitle', header: 'Book' },
            { key: 'studentName', header: 'Borrower' },
            { key: 'issuedDate', header: 'Issued' },
            { key: 'dueDate', header: 'Due Date' },
            {
              key: 'status',
              header: 'Status',
              render: (l) => (
                <Badge variant={l.status === 'returned' ? 'success' : l.dueDate < todayIsoDate() ? 'danger' : 'warning'}>
                  {l.status === 'issued' && l.dueDate < todayIsoDate() ? 'Overdue' : l.status}
                </Badge>
              ),
            },
            { key: 'fineMinor', header: 'Fine', render: (l) => formatMinorUnits(l.fineMinor || 0, currency) },
            {
              key: 'actions',
              header: 'Return',
              render: (l) =>
                can(PERMISSIONS.LIBRARY_WRITE) && l.status === 'issued' ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleReturnBook(l)}>
                    Return
                  </Button>
                ) : '—',
            },
          ]}
          data={loansQ.data || []}
          loading={loansQ.isLoading}
        />
      )}

      <Dialog open={bookOpen} onClose={() => setBookOpen(false)} title="Add Book to Catalog">
        <form onSubmit={handleSubmit(onAddBook)} className="space-y-3.5">
          <div><Label htmlFor="bk-isbn" required>ISBN</Label><Input id="bk-isbn" {...register('isbn')} /></div>
          <div><Label htmlFor="bk-title" required>Book Title</Label><Input id="bk-title" {...register('title')} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="bk-auth" required>Author</Label><Input id="bk-auth" {...register('author')} /></div>
            <div><Label htmlFor="bk-cat" required>Category</Label><Input id="bk-cat" {...register('category')} /></div>
            <div><Label htmlFor="bk-copies" required>Copies</Label><Input id="bk-copies" type="number" {...register('totalCopies')} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setBookOpen(false)}>Cancel</Button>
            <Button type="submit" loading={bookCrud.createMutation.isPending}>Save Book</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={issueOpen} onClose={() => setIssueOpen(false)} title="Issue Book to Student">
        <form onSubmit={handleIssueBook} className="space-y-3.5">
          <div>
            <Label htmlFor="is-book" required>Book</Label>
            <Select id="is-book" value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)} required>
              <option value="">Select available book</option>
              {(booksQ.data || []).filter((b) => b.availableCopies > 0).map((b) => (
                <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} avail)</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="is-stu" required>Student</Label>
            <Select id="is-stu" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} required>
              <option value="">Select student</option>
              {(studentsQ.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.enrollmentNumber})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="is-due" required>Due Date</Label>
            <Input id="is-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Issue Book</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
