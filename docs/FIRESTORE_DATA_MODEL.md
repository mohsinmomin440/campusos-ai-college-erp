# Firestore Data Model & Consistency Rules

## Multi-Tenant Scoping
All institution-specific records live under `tenants/{tenantId}/...`. Identity profiles live under `users/{uid}` and trusted role memberships live under `tenants/{tenantId}/members/{uid}`.

### Top-Level & Tenant Subcollections
- `users/{uid}` — Safe user metadata (`uid`, `email`, `displayName`, `defaultTenantId`, `tenantIds`, optional `platformRole`).
- `tenants/{tenantId}` — College record (`name`, `code`, `status`, `subscriptionPlan`, `currency`, `attendanceThresholdPercent`).
- `tenants/{tenantId}/members/{uid}` — Trusted membership (`role`, `status`, `linkedStudentIds`).
- `tenants/{tenantId}/departments/{id}`, `courses/{id}`, `subjects/{id}`, `classes/{id}`, `timetables/{id}`
- `tenants/{tenantId}/admissions/{applicationId}` — Applicant data, stage, `convertedStudentId`.
- `tenants/{tenantId}/students/{studentId}` — Enrollment ID, `uid`, `departmentId`, `courseId`, `semesterId`, guardian contact, status.
- `tenants/{tenantId}/faculty/{facultyId}`, `staff/{staffId}`
- `tenants/{tenantId}/attendance/{date_class_subject_student}` — Deterministic ID prevents duplicate roll-call entries.
- `tenants/{tenantId}/attendanceCorrections/{id}` — Pending/approved/rejected audit workflow.
- `tenants/{tenantId}/examinations/{examId}` & `results/{examId_studentId}` — Draft marks entered by faculty; server computes `percentage`, `grade`, `passed`, `published: true`.
- `tenants/{tenantId}/feeStructures/{id}`, `invoices/{invoiceId}`, `payments/{idempotencyKey}` — Money stored strictly as integer minor units (`totalMinor`, `paidMinor`, `balanceMinor`, `amountMinor`) + `currency`.
- `tenants/{tenantId}/libraryBooks/{bookId}` & `bookLoans/{loanId}` — Transactional `availableCopies` decrements/increments.
- `tenants/{tenantId}/placements/{driveId}` & `placementApplications/{driveId_uid}`
- `tenants/{tenantId}/notices/{id}`, `events/{id}`, `tickets/{id}`, `notifications/{id}`
- `tenants/{tenantId}/documents/{id}` & `knowledgeDocuments/{id}`
- `tenants/{tenantId}/auditLogs/{id}`, `aiLogs/{id}`, `aiRateLimits/{uid}` — Server-only writes.

## Composite Indexes
Defined in `firestore.indexes.json` for student filtering, attendance lookups by student or class/subject/date, published results, student invoices, notifications, and audit logs.
