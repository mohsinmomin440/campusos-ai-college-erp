import crypto from 'node:crypto';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getDb, requireTenantRole, ROLES, writeAuditLog } from '../../utils/auth.js';

/**
 * Computes authoritative invoice totals in integer minor units (no float math).
 */
export function applyPaymentToInvoice({ totalMinor, paidMinor, paymentMinor }) {
  if (!Number.isInteger(totalMinor) || !Number.isInteger(paidMinor) || !Number.isInteger(paymentMinor)) {
    throw new Error('All monetary values must be integer minor units.');
  }
  if (paymentMinor <= 0) {
    throw new Error('Payment amount must be greater than zero minor units.');
  }
  const balanceBefore = totalMinor - paidMinor;
  if (paymentMinor > balanceBefore) {
    throw new Error(`Payment (${paymentMinor}) exceeds outstanding balance (${balanceBefore}).`);
  }
  const nextPaid = paidMinor + paymentMinor;
  const nextBalance = totalMinor - nextPaid;
  const nextStatus = nextBalance === 0 ? 'paid' : 'partial';
  return { nextPaid, nextBalance, nextStatus };
}

const recordPaymentSchema = z.object({
  tenantId: z.string().min(3),
  invoiceId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().min(3).max(3).default('INR'),
  method: z.enum(['cash', 'bank_transfer', 'upi', 'cheque', 'card_pos']),
  reference: z.string().min(2).max(120),
  idempotencyKey: z.string().min(6).max(120),
  notes: z.string().max(400).optional().default(''),
});

const issueAdjustmentSchema = z.object({
  tenantId: z.string().min(3),
  invoiceId: z.string().min(1),
  kind: z.enum(['scholarship_discount', 'refund']),
  amountMinor: z.number().int().positive(),
  reason: z.string().min(4).max(300),
});

export const recordPayment = onCall(async (request) => {
  const parsed = recordPaymentSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const input = parsed.data;
  const ctx = await requireTenantRole(request, input.tenantId, [
    ROLES.PLATFORM_SUPER_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.ACCOUNTANT,
  ]);

  const db = getDb();
  const tenantRef = db.collection('tenants').doc(input.tenantId);
  const paymentRef = tenantRef.collection('payments').doc(input.idempotencyKey);
  const invoiceRef = tenantRef.collection('invoices').doc(input.invoiceId);

  const txResult = await db.runTransaction(async (tx) => {
    const existingPay = await tx.get(paymentRef);
    if (existingPay.exists) {
      return { idempotentReplay: true, payment: existingPay.data() };
    }

    const invSnap = await tx.get(invoiceRef);
    if (!invSnap.exists) {
      throw new HttpsError('not-found', 'Student invoice not found.');
    }
    const invoice = invSnap.data();

    if ((invoice.currency || 'INR') !== input.currency) {
      throw new HttpsError('failed-precondition', 'Payment currency does not match invoice currency.');
    }

    let calc;
    try {
      calc = applyPaymentToInvoice({
        totalMinor: Number(invoice.totalMinor ?? 0),
        paidMinor: Number(invoice.paidMinor ?? 0),
        paymentMinor: input.amountMinor,
      });
    } catch (err) {
      throw new HttpsError('failed-precondition', err.message);
    }

    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}-${input.idempotencyKey.slice(0, 4).toUpperCase()}`;
    const paymentDoc = {
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      studentId: invoice.studentId,
      studentUid: invoice.studentUid || '',
      studentName: invoice.studentName || '',
      amountMinor: input.amountMinor,
      currency: input.currency,
      method: input.method,
      reference: input.reference,
      receiptNumber,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes,
      status: 'completed',
      recordedByUid: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
    };

    tx.set(paymentRef, paymentDoc);
    tx.update(invoiceRef, {
      paidMinor: calc.nextPaid,
      balanceMinor: calc.nextBalance,
      status: calc.nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { idempotentReplay: false, payment: paymentDoc, nextBalance: calc.nextBalance, nextStatus: calc.nextStatus };
  });

  if (!txResult.idempotentReplay) {
    await writeAuditLog({
      tenantId: input.tenantId,
      actorUid: ctx.uid,
      actorRole: ctx.role,
      module: 'finance',
      action: 'payment_recorded',
      targetId: input.idempotencyKey,
      summary: `Recorded ${input.currency} ${input.amountMinor} minor units against invoice ${input.invoiceId} (Receipt ${txResult.payment.receiptNumber}).`,
      metadata: { invoiceId: input.invoiceId, method: input.method, amountMinor: input.amountMinor },
    });
  }

  return {
    ok: true,
    idempotentReplay: txResult.idempotentReplay,
    receiptNumber: txResult.payment.receiptNumber,
    paymentId: input.idempotencyKey,
  };
});

export const issueFeeAdjustment = onCall(async (request) => {
  const parsed = issueAdjustmentSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const input = parsed.data;
  const ctx = await requireTenantRole(request, input.tenantId, [
    ROLES.PLATFORM_SUPER_ADMIN,
    ROLES.COLLEGE_ADMIN,
    ROLES.ACCOUNTANT,
  ]);

  const db = getDb();
  const tenantRef = db.collection('tenants').doc(input.tenantId);
  const invoiceRef = tenantRef.collection('invoices').doc(input.invoiceId);

  const result = await db.runTransaction(async (tx) => {
    const invSnap = await tx.get(invoiceRef);
    if (!invSnap.exists) {
      throw new HttpsError('not-found', 'Invoice not found.');
    }
    const inv = invSnap.data();
    const totalMinor = Number(inv.totalMinor ?? 0);
    const paidMinor = Number(inv.paidMinor ?? 0);

    if (input.kind === 'scholarship_discount') {
      const balance = totalMinor - paidMinor;
      if (input.amountMinor > balance) {
        throw new HttpsError('failed-precondition', 'Discount cannot exceed current unpaid balance.');
      }
      const nextTotal = totalMinor - input.amountMinor;
      const nextBalance = nextTotal - paidMinor;
      const nextStatus = nextBalance === 0 ? 'paid' : paidMinor > 0 ? 'partial' : 'pending';
      tx.update(invoiceRef, {
        totalMinor: nextTotal,
        discountMinor: Number(inv.discountMinor ?? 0) + input.amountMinor,
        balanceMinor: nextBalance,
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { nextTotal, nextBalance, nextStatus };
    }

    // Refund against previously paid amount
    if (input.amountMinor > paidMinor) {
      throw new HttpsError('failed-precondition', 'Refund cannot exceed paid amount.');
    }
    const nextPaid = paidMinor - input.amountMinor;
    const nextBalance = totalMinor - nextPaid;
    const nextStatus = nextPaid === 0 ? 'refunded' : 'partial';
    tx.update(invoiceRef, {
      paidMinor: nextPaid,
      balanceMinor: nextBalance,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const refundRef = tenantRef.collection('payments').doc();
    tx.set(refundRef, {
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      studentId: inv.studentId,
      studentUid: inv.studentUid || '',
      studentName: inv.studentName || '',
      amountMinor: -input.amountMinor,
      currency: inv.currency || 'INR',
      method: 'refund',
      reference: `REF-${Date.now().toString(36).toUpperCase()}`,
      receiptNumber: `REF-${Date.now().toString(36).toUpperCase()}`,
      notes: input.reason,
      status: 'refunded',
      recordedByUid: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { nextPaid, nextBalance, nextStatus };
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    actorUid: ctx.uid,
    actorRole: ctx.role,
    module: 'finance',
    action: input.kind,
    targetId: input.invoiceId,
    summary: `Applied ${input.kind} of ${input.amountMinor} minor units on invoice ${input.invoiceId}. Reason: ${input.reason}`,
  });

  return { ok: true, ...result };
});

/**
 * Payment provider webhook boundary.
 * Verifies HMAC SHA-256 signature using server-only PAYMENT_WEBHOOK_SECRET.
 * Never fabricates payments when unconfigured.
 */
export const paymentWebhook = onRequest(async (req, res) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({
      ok: false,
      configured: false,
      error: 'Payment gateway webhook secret is not configured on the server.',
    });
    return;
  }

  const signature = req.get('x-campusos-signature') || '';
  const rawBody = JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    res.status(401).json({ ok: false, error: 'Invalid webhook signature.' });
    return;
  }

  res.status(200).json({ ok: true, verified: true });
});
