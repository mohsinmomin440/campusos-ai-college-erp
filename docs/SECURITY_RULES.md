# Security Rules & Authorization Model

## Principles
1. **Default Deny**: Both `firestore.rules` and `storage.rules` deny all reads and writes unless explicitly matched.
2. **Trusted Membership Source**: Role authorization reads `tenants/{tenantId}/members/{request.auth.uid}` (`status == 'active'`) and verifies `tenants/{tenantId}.status == 'active'`.
3. **No Self-Escalation**: Users cannot modify their own `role`, `status`, `tenantId`, `linkedStudentIds`, or `platformRole`.
4. **Record-Level Ownership**:
   - Students can read only their own student record, attendance, published results (`published == true`), fee invoices, payments, book loans, and notifications.
   - Parents can read only records belonging to `linkedStudentIds` on their member document.
5. **Server-Only Privileged Writes**:
   - `payments/*`, `auditLogs/*`, and `aiLogs/*` reject all direct client writes.
   - Direct client writes to `results/*` cannot set `published: true`.
   - Cloud Functions independently verify `request.auth`, tenant membership, role permissions, and input schemas using Zod before running Admin SDK operations.
6. **Storage Constraints**:
   - Restricted to `/tenants/{tenantId}/{folder}/{ownerUid}/{fileName}` for active tenant members.
   - Enforces max 5 MB upload size and MIME allow-list (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`).
