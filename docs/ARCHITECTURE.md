# CampusOS Architecture

## Web-Only Modular Design
CampusOS is strictly a responsive browser application built with React + Vite + JavaScript (`.jsx` for components, `.js` for utilities/services/hooks). No native mobile projects exist.

## Frontend Architecture (`src/`)
- `src/app/`: Root `App.jsx`, TanStack Query & Auth `providers.jsx`, lazy-loaded `router.jsx`.
- `src/components/`:
  - `ui/`: Reusable accessible primitives (`Button`, `Input`, `Select`, `Textarea`, `Card`, `Badge`, `Dialog`, `Tabs`, `Pagination`, `Toast`, `Skeleton`, `PageHeader`).
  - `tables/`: Searchable, paginated `DataTable`.
  - `feedback/`: `EmptyState`, `ErrorState`, `PermissionDenied`, `ConfirmDialog`, `StatusBanner`.
  - `ProtectedRoute.jsx`: UX route guard validating auth state, active tenant, and centralized RBAC permissions.
- `src/layouts/`: `AuthLayout.jsx` (with live Firebase/Gemini configuration badges) and `DashboardLayout.jsx` (collapsible sidebar, responsive mobile drawer, tenant switcher).
- `src/firebase/`: `firebase.js` (Zod env validation + emulator connection), `auth.js`, `firestore.js`, `storage.js`.
- `src/hooks/`: `AuthProvider.jsx`, `useAuth.js`, `useToast.js`, `useTenantCollection.js`.
- `src/schemas/roles.js`: Centralized RBAC role constants and permission matrix.
- `src/modules/`: Self-contained lazy-loaded ERP feature modules (`administration`, `admissions`, `students`, `faculty`, `academics`, `attendance`, `examinations`, `finance`, `library`, `placements`, `communication`, `documents`, `reports`, `ai`).

## Backend Architecture (`functions/src/`)
Privileged, multi-document, transactional, and secret-bearing operations run in Firebase Cloud Functions (Node.js ESM):
- `provisionTenant`, `updateTenantStatus`, `assignMemberRole`: Multi-tenant provisioning and role management with self-escalation checks and audit logging.
- `decideAdmission`: Transactional admission review and atomic student record creation.
- `publishExamResults`: Deterministic server-side percentage/grade calculation, batch publication, student notifications, and audit log.
- `recordPayment`, `issueFeeAdjustment`, `paymentWebhook`: Integer minor-unit fee accounting, idempotency keys (`payments/{idempotencyKey}`), and HMAC webhook signature boundary.
- `getAiStatus`, `runCampusAi`: Server-side Gemini integration with RBAC checks, sliding-window rate limits, PII minimization, and audit logging.
