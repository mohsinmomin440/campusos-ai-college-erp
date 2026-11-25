import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, Plus, Receipt, Percent, Printer } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { where } from '@/firebase/firestore';
import { useTenantCrud, useTenantQuery, useTrustedFunction } from '@/hooks/useTenantCollection';
import { PERMISSIONS, ROLES } from '@/schemas/roles';
import { PageHeader, StatCard } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import { formatMinorUnits, parseDecimalToMinorUnits, sumMinorUnits } from '@/utils/money';
import { formatDate } from '@/utils/date';

const feeStructureSchema = z.object({
  title: z.string().min(2),
  category: z.enum(['tuition', 'hostel', 'exam', 'transport', 'library']),
  semesterId: z.string().default('sem-6'),
  amountDecimal: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid decimal amount (e.g. 25000.00).'),
});

const invoiceSchema = z.object({
  studentId: z.string().min(1, 'Select a student.'),
  title: z.string().min(2),
  dueDate: z.string().min(4),
  amountDecimal: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter valid fee amount.'),
});

const paymentSchema = z.object({
  amountDecimal: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter valid payment amount.'),
  method: z.enum(['cash', 'bank_transfer', 'upi', 'cheque', 'card_pos']),
  reference: z.string().min(2, 'Payment reference is required.'),
  notes: z.string().optional().default(''),
});

const STATUS_BADGE = {
  paid: 'success',
  partial: 'warning',
  pending: 'danger',
  refunded: 'neutral',
};

export default function FinancePage() {
  const { activeTenantId, activeTenant, user, role, linkedStudentIds, backendStatus, can } = useAuth();
  const currency = activeTenant?.currency || 'INR';

  const [tab, setTab] = useState('invoices');
  const [structOpen, setStructOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState(null);
  const [adjInvoice, setAdjInvoice] = useState(null);
  const [adjKind, setAdjKind] = useState('scholarship_discount');
  const [adjDecimal, setAdjDecimal] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [receiptPayment, setReceiptPayment] = useState(null);

  const financeScope = useMemo(() => {
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

  const structuresQ = useTenantQuery('feeStructures');
  const invoicesQ = useTenantQuery('invoices', {
    constraints: financeScope.constraints,
    enabled: financeScope.enabled,
    queryKeyExtra: financeScope.extra,
  });
  const paymentsQ = useTenantQuery('payments', {
    constraints: financeScope.constraints,
    enabled: financeScope.enabled,
    queryKeyExtra: financeScope.extra,
  });
  const studentsQ = useTenantQuery('students', { enabled: can(PERMISSIONS.FINANCE_WRITE) });

  const structCrud = useTenantCrud('feeStructures', { label: 'Fee structure' });
  const invCrud = useTenantCrud('invoices', { label: 'Student invoice' });

  const recordPaymentFn = useTrustedFunction('recordPayment', {
    invalidateCollections: ['invoices', 'payments'],
    successTitle: 'Payment recorded & receipt issued',
  });
  const adjustmentFn = useTrustedFunction('issueFeeAdjustment', {
    invalidateCollections: ['invoices', 'payments'],
    successTitle: 'Fee adjustment applied',
  });

  const structForm = useForm({ resolver: zodResolver(feeStructureSchema), defaultValues: { category: 'tuition', semesterId: 'sem-6' } });
  const invForm = useForm({ resolver: zodResolver(invoiceSchema) });
  const payForm = useForm({ resolver: zodResolver(paymentSchema), defaultValues: { method: 'upi' } });

  const totals = useMemo(() => {
    const invs = invoicesQ.data || [];
    const billedMinor = sumMinorUnits(invs.map((i) => Number(i.totalMinor || 0)));
    const paidMinor = sumMinorUnits(invs.map((i) => Number(i.paidMinor || 0)));
    const dueMinor = sumMinorUnits(invs.map((i) => Number(i.balanceMinor || 0)));
    return {
      billed: formatMinorUnits(billedMinor, currency),
      paid: formatMinorUnits(paidMinor, currency),
      due: formatMinorUnits(dueMinor, currency),
    };
  }, [invoicesQ.data, currency]);

  const onCreateStructure = async (values) => {
    const amountMinor = parseDecimalToMinorUnits(values.amountDecimal, currency);
    await structCrud.createMutation.mutateAsync({
      data: {
        title: values.title,
        category: values.category,
        semesterId: values.semesterId,
        amountMinor,
        currency,
      },
    });
    structForm.reset();
    setStructOpen(false);
  };

  const onCreateInvoice = async (values) => {
    const student = (studentsQ.data || []).find((s) => s.id === values.studentId);
    const totalMinor = parseDecimalToMinorUnits(values.amountDecimal, currency);
    await invCrud.createMutation.mutateAsync({
      data: {
        invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
        studentId: values.studentId,
        studentUid: student?.uid || '',
        studentName: student?.fullName || '',
        title: values.title,
        dueDate: values.dueDate,
        totalMinor,
        paidMinor: 0,
        discountMinor: 0,
        balanceMinor: totalMinor,
        currency,
        status: 'pending',
      },
    });
    invForm.reset();
    setInvOpen(false);
  };

  const onRecordPayment = async (values) => {
    if (!payInvoice) return;
    const amountMinor = parseDecimalToMinorUnits(values.amountDecimal, currency);
    const idempotencyKey = `pay_${payInvoice.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await recordPaymentFn.mutateAsync({
      tenantId: activeTenantId,
      invoiceId: payInvoice.id,
      amountMinor,
      currency,
      method: values.method,
      reference: values.reference,
      notes: values.notes,
      idempotencyKey,
    });
    payForm.reset();
    setPayInvoice(null);
  };

  const onSubmitAdjustment = async (e) => {
    e.preventDefault();
    if (!adjInvoice) return;
    const amountMinor = parseDecimalToMinorUnits(adjDecimal, currency);
    await adjustmentFn.mutateAsync({
      tenantId: activeTenantId,
      invoiceId: adjInvoice.id,
      kind: adjKind,
      amountMinor,
      reason: adjReason,
    });
    setAdjInvoice(null);
    setAdjDecimal('');
    setAdjReason('');
  };

  const invoiceColumns = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (i) => <span className="font-mono text-xs">{i.invoiceNumber || i.id.slice(0, 8)}</span> },
    { key: 'studentName', header: 'Student' },
    { key: 'title', header: 'Fee Item' },
    { key: 'totalMinor', header: 'Total', render: (i) => formatMinorUnits(i.totalMinor, i.currency || currency) },
    { key: 'paidMinor', header: 'Paid', render: (i) => formatMinorUnits(i.paidMinor, i.currency || currency) },
    { key: 'balanceMinor', header: 'Balance Due', render: (i) => <strong>{formatMinorUnits(i.balanceMinor, i.currency || currency)}</strong> },
    { key: 'status', header: 'Status', render: (i) => <Badge variant={STATUS_BADGE[i.status] || 'neutral'}>{i.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      render: (i) =>
        can(PERMISSIONS.FINANCE_WRITE) ? (
          <div className="flex flex-wrap gap-1.5">
            {i.balanceMinor > 0 && (
              <Button size="sm" onClick={() => {
                setPayInvoice(i);
                payForm.setValue('amountDecimal', ((i.balanceMinor || 0) / 100).toFixed(2));
              }}>
                Record Payment
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setAdjInvoice(i)} aria-label="Discount or Refund">
              <Percent className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : '—',
    },
  ];

  const paymentColumns = [
    { key: 'receiptNumber', header: 'Receipt #', render: (p) => <span className="font-mono text-xs font-medium">{p.receiptNumber}</span> },
    { key: 'studentName', header: 'Student' },
    { key: 'amountMinor', header: 'Amount', render: (p) => formatMinorUnits(p.amountMinor, p.currency || currency) },
    { key: 'method', header: 'Method', render: (p) => <Badge variant="neutral">{p.method}</Badge> },
    { key: 'reference', header: 'Reference' },
    { key: 'createdAt', header: 'Date', render: (p) => formatDate(p.createdAt) },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (p) => (
        <Button size="sm" variant="ghost" onClick={() => setReceiptPayment(p)}>
          <Receipt className="h-3.5 w-3.5" /> View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees &amp; Finance"
        description="Integer minor-unit accounting, student invoices, idempotent server-verified payments, scholarships, and receipts."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Finance' }]}
        actions={
          can(PERMISSIONS.FINANCE_WRITE) && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStructOpen(true)}>
                <Plus className="h-4 w-4" /> Fee Structure
              </Button>
              <Button onClick={() => setInvOpen(true)}>
                <Plus className="h-4 w-4" /> Issue Invoice
              </Button>
            </div>
          )
        }
      />

      {!backendStatus.paymentGatewayConfigured && (
        <StatusBanner
          tone="info"
          title="Online Payment Gateway Unconfigured"
          description="External online checkout webhooks require PAYMENT_WEBHOOK_SECRET in Cloud Functions secrets. Manual/counter payments remain active with full idempotency and audit logs."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Billed" value={totals.billed} icon={Wallet} tone="indigo" />
        <StatCard label="Total Collected" value={totals.paid} icon={Receipt} tone="emerald" />
        <StatCard label="Outstanding Dues" value={totals.due} icon={Wallet} tone="rose" />
      </div>

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'invoices', label: 'Student Invoices', count: (invoicesQ.data || []).length },
          { id: 'payments', label: 'Payments & Receipts', count: (paymentsQ.data || []).length },
          { id: 'structures', label: 'Fee Structures', count: (structuresQ.data || []).length },
        ]}
      />

      {tab === 'invoices' && (
        <DataTable columns={invoiceColumns} data={invoicesQ.data || []} loading={invoicesQ.isLoading} searchKeys={['invoiceNumber', 'studentName', 'title']} />
      )}

      {tab === 'payments' && (
        <DataTable columns={paymentColumns} data={paymentsQ.data || []} loading={paymentsQ.isLoading} searchKeys={['receiptNumber', 'studentName', 'reference']} />
      )}

      {tab === 'structures' && (
        <DataTable
          columns={[
            { key: 'title', header: 'Structure Name' },
            { key: 'category', header: 'Category', render: (s) => <Badge variant="indigo">{s.category}</Badge> },
            { key: 'semesterId', header: 'Semester' },
            { key: 'amountMinor', header: 'Fee Amount', render: (s) => formatMinorUnits(s.amountMinor, s.currency || currency) },
          ]}
          data={structuresQ.data || []}
          loading={structuresQ.isLoading}
        />
      )}

      <Dialog open={structOpen} onClose={() => setStructOpen(false)} title="Create Fee Structure">
        <form onSubmit={structForm.handleSubmit(onCreateStructure)} className="space-y-3.5">
          <div>
            <Label htmlFor="fs-title" required>Fee Title</Label>
            <Input id="fs-title" placeholder="BCA Semester 6 Tuition Fee" {...structForm.register('title')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="fs-cat">Category</Label>
              <Select id="fs-cat" {...structForm.register('category')}>
                <option value="tuition">Tuition</option>
                <option value="exam">Exam</option>
                <option value="hostel">Hostel</option>
                <option value="library">Library</option>
                <option value="transport">Transport</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="fs-sem">Semester</Label>
              <Input id="fs-sem" {...structForm.register('semesterId')} />
            </div>
            <div>
              <Label htmlFor="fs-amt" required>Amount ({currency})</Label>
              <Input id="fs-amt" placeholder="25000.00" {...structForm.register('amountDecimal')} />
              <FieldError message={structForm.formState.errors.amountDecimal?.message} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStructOpen(false)}>Cancel</Button>
            <Button type="submit" loading={structCrud.createMutation.isPending}>Save Structure</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={invOpen} onClose={() => setInvOpen(false)} title="Issue Student Invoice">
        <form onSubmit={invForm.handleSubmit(onCreateInvoice)} className="space-y-3.5">
          <div>
            <Label htmlFor="iv-stu" required>Student</Label>
            <Select id="iv-stu" {...invForm.register('studentId')}>
              <option value="">Select student</option>
              {(studentsQ.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.enrollmentNumber})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="iv-title" required>Description</Label>
            <Input id="iv-title" placeholder="Semester 6 Tuition & Lab Fee" {...invForm.register('title')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="iv-amt" required>Amount ({currency})</Label>
              <Input id="iv-amt" placeholder="25000.00" {...invForm.register('amountDecimal')} />
            </div>
            <div>
              <Label htmlFor="iv-due" required>Due Date</Label>
              <Input id="iv-due" type="date" {...invForm.register('dueDate')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setInvOpen(false)}>Cancel</Button>
            <Button type="submit" loading={invCrud.createMutation.isPending}>Issue Invoice</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(payInvoice)} onClose={() => setPayInvoice(null)} title={`Record Payment: ${payInvoice?.invoiceNumber || ''}`}>
        <form onSubmit={payForm.handleSubmit(onRecordPayment)} className="space-y-3.5">
          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            Student: <strong>{payInvoice?.studentName}</strong> • Balance:{' '}
            <strong>{formatMinorUnits(payInvoice?.balanceMinor || 0, currency)}</strong>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pay-amt" required>Amount ({currency})</Label>
              <Input id="pay-amt" {...payForm.register('amountDecimal')} />
              <FieldError message={payForm.formState.errors.amountDecimal?.message} />
            </div>
            <div>
              <Label htmlFor="pay-method" required>Method</Label>
              <Select id="pay-method" {...payForm.register('method')}>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="cash">Cash Counter</option>
                <option value="cheque">Cheque</option>
                <option value="card_pos">Card POS Terminal</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="pay-ref" required>Transaction / Counter Reference</Label>
            <Input id="pay-ref" placeholder="UTR / Receipt Ref" {...payForm.register('reference')} />
            <FieldError message={payForm.formState.errors.reference?.message} />
          </div>
          <div>
            <Label htmlFor="pay-notes">Remarks</Label>
            <Input id="pay-notes" {...payForm.register('notes')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPayInvoice(null)}>Cancel</Button>
            <Button type="submit" loading={recordPaymentFn.isPending}>Confirm Payment</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(adjInvoice)} onClose={() => setAdjInvoice(null)} title="Scholarship Concession or Refund">
        <form onSubmit={onSubmitAdjustment} className="space-y-3.5">
          <div>
            <Label htmlFor="adj-kind">Adjustment Type</Label>
            <Select id="adj-kind" value={adjKind} onChange={(e) => setAdjKind(e.target.value)}>
              <option value="scholarship_discount">Scholarship / Fee Discount</option>
              <option value="refund">Refund Previously Paid Amount</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="adj-amt" required>Amount ({currency})</Label>
            <Input id="adj-amt" value={adjDecimal} onChange={(e) => setAdjDecimal(e.target.value)} placeholder="5000.00" required />
          </div>
          <div>
            <Label htmlFor="adj-reason" required>Audit Reason</Label>
            <Input id="adj-reason" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Merit scholarship approval #SC-2026" required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAdjInvoice(null)}>Cancel</Button>
            <Button type="submit" loading={adjustmentFn.isPending}>Apply Adjustment</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(receiptPayment)} onClose={() => setReceiptPayment(null)} title="Official Payment Receipt">
        {receiptPayment && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="font-bold text-slate-900">{activeTenant?.name || 'CampusOS College'}</span>
                <Badge variant="success">Verified</Badge>
              </div>
              <p className="font-mono text-xs text-slate-500">Receipt: {receiptPayment.receiptNumber}</p>
              <hr className="border-slate-100" />
              <div className="flex justify-between text-xs"><span className="text-slate-500">Student</span><span className="font-medium">{receiptPayment.studentName}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Method</span><span>{receiptPayment.method}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Reference</span><span>{receiptPayment.reference}</span></div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-100">
                <span>Amount</span>
                <span>{formatMinorUnits(receiptPayment.amountMinor, receiptPayment.currency || currency)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 no-print">
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
