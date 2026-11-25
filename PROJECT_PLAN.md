# CampusOS — AI-Powered College Management System

> **Tagline:** One Campus. One Platform. Intelligent Management.  
> **Product:** Responsive, browser-based College ERP / CRM  
> **Scope:** Complete college management foundation with Gemini-powered assistance  
> **Frontend:** React + Vite + JavaScript (`.jsx`)  
> **Backend / Database:** Firebase  
> **AI:** Google Gemini through trusted server-side Cloud Functions  
> **Approach:** New project — web only

---

## 1. Product vision

CampusOS is a multi-role, multi-college web application that centralizes admissions, student records, faculty, academics, attendance, examinations, fees, library, placements, communication, documents and AI-assisted workflows.

**This is a WEB-ONLY project.** Users access CampusOS through desktop, tablet and mobile browsers. Responsive browser support is required, but it does not mean a native mobile app.

### Explicitly out of scope
- Android or iOS applications.
- React Native, Expo, Flutter or native mobile projects.
- `apps/mobile`, Android or iOS folders/build configurations.
- Client-side exposure of Gemini API keys or Firebase Admin credentials.
- AI making final admission, grading, disciplinary, eligibility or financial decisions.

---

## 2. User roles

Use Firebase Authentication for identity and Firestore-backed role/tenant membership records for authorization context. Enforce access in Firestore Security Rules and trusted Cloud Functions; frontend route guards are UX only.

| Role | Responsibilities |
|---|---|
| Platform Owner | Provision colleges and platform-level configuration |
| College Admin | College settings, users, departments, academic setup |
| Principal / Registrar | College-wide oversight and approvals |
| HOD | Department operations, faculty and academic oversight |
| Faculty | Assigned classes, attendance, assessments and marks |
| Admission Officer | Enquiries, applications and admissions |
| Accountant | Fee plans, invoices, payments and finance reports |
| Librarian | Book catalog, loans, returns and fines |
| Placement Officer | Companies, placement drives and student applications |
| Student | Own profile, timetable, attendance, results, fees and notices |
| Parent / Guardian | Linked student's permitted information |
| Auditor / Read-only Support | Explicitly scoped read-only access |

Never trust a role, tenant ID, student ID or permission supplied by the browser. Resolve authorization from verified identity and trusted membership data.

---

## 3. Functional modules

### 3.1 Platform and college administration
- College profiles, branding, contact details and settings.
- Tenant provisioning and tenant status.
- Departments, programs, courses, subjects, batches, sections and classrooms.
- Academic years, semesters, grading schemes and calendars.
- User invitations, activation/deactivation and role assignments.
- Permission management and audit logs.

### 3.2 Admissions
- Enquiry capture and follow-up history.
- Applicant profile, application pipeline and status tracking.
- Secure document metadata and verification status.
- Human-reviewed admission decisions.
- Convert accepted applications into student records.
- Admission funnel reports.

### 3.3 Student information
- Student profiles, enrollment numbers and academic history.
- Guardian relationships and emergency contacts.
- Program, department, batch, semester and section assignments.
- Document checklist and verification.
- Status lifecycle: applicant, active, suspended, graduated, withdrawn.
- Change history.

### 3.4 Faculty and staff
- Staff profiles and employment details.
- Department, subject and class assignments.
- Faculty workload and staff directory.
- Staff attendance and leave requests/approvals.

### 3.5 Academics and timetable
- Programs, courses, subjects and curriculum mapping.
- Semester, batch and section management.
- Faculty and room allocation.
- Timetable creation and clash validation.
- Academic calendar, holidays and events.

### 3.6 Attendance
- Subject/session-based attendance.
- Present, absent, late and excused statuses.
- Attendance entry limited to assigned faculty/classes.
- Correction workflow with reason and audit history.
- Monthly summaries and configurable shortage thresholds.
- Relevant student/guardian notifications.

### 3.7 Examinations and results
- Exam types, schedules and assessment components.
- Marks entry with draft, submitted and approved states.
- Configurable grade scales and calculations.
- Controlled result publication.
- Student transcript and marksheet PDF export.
- Recheck/revaluation request tracking.

### 3.8 Fees and finance
- Fee heads, fee plans and semester-wise structures.
- Student invoices, concessions and scholarships.
- Payment records, receipts and outstanding balances.
- Manual payment recording with reference and audit trail.
- Optional payment gateway adapter.
- Refund/adjustment approval workflow and finance reports.

Use integer minor currency units or carefully validated decimal strings; never use JavaScript floating-point arithmetic for authoritative money calculations. Verify payment webhooks server-side, use idempotency keys and never store card details.

### 3.9 Library
- Book titles, authors, categories, ISBNs and physical copies.
- Issue, return, renewal and reservation.
- Due dates, fine rules and borrowing history.
- Inventory reports.

### 3.10 Placement and internship
- Company profiles and placement drives.
- Eligibility rules and job/internship listings.
- Student applications and selection stages.
- Interview scheduling and offer/outcome records.
- Placement analytics.

### 3.11 Communication and support
- Notices, announcements and circulars.
- Audience targeting by tenant, role, department, program, semester or section.
- In-app notifications.
- Complaint/helpdesk tickets and assignment.
- Events and calendar.
- Optional email/SMS provider adapters.

### 3.12 Documents and exports
- Secure document metadata and access checks.
- Bonafide, enrollment and leaving-certificate workflows.
- ID cards and marksheets.
- Permission-checked PDF/CSV exports.
- Firebase Storage for files, with restrictive Storage Rules and signed/authorized access patterns.

### 3.13 Reports and analytics
- Admissions and enrollment.
- Attendance and academic performance.
- Fee collection and outstanding dues.
- Library and placement outcomes.
- Filters by academic year, department, program and semester.
- Role- and tenant-scoped exports.

### 3.14 Gemini AI capabilities
Use Gemini only through trusted server-side Cloud Functions (or a separately secured backend if later justified). Keep API keys in server-side secrets, never in React environment variables or browser bundles.

Initial AI features:
1. **College knowledge assistant:** Answer from approved college handbook, policies, calendar and FAQ documents using retrieval-grounded context. Include source references and say when evidence is insufficient.
2. **Report assistant:** Convert natural-language questions into a strict, allow-listed report specification. Do not let the model generate or execute arbitrary Firestore queries.
3. **Attendance insights:** Explain deterministic threshold-based attendance trends; do not make disciplinary decisions.
4. **Academic summaries:** Summarize authorized and approved metrics, showing source values.
5. **Notice drafting:** Create editable drafts for authorized staff; require explicit human approval before publishing.
6. **Timetable suggestions:** Suggest options against deterministic room/faculty/time constraints; staff approves the final timetable.
7. **Support-ticket categorization:** Suggest category/priority; staff confirms.

AI governance:
- Authenticate caller and verify tenant/role/record permissions before reading context.
- Minimize/redact personal data sent to Gemini.
- Treat uploaded/retrieved text as untrusted input, not instructions.
- Never let AI set grades, admit/reject students, change fees, discipline students or execute consequential actions.
- Label generated content and require human review.
- Add per-user/tenant rate limits, token/cost budgets, timeouts and safe fallback.
- Log actor, tenant, feature, model, latency and outcome without retaining unnecessary sensitive prompt content.
- AI features remain disabled until Gemini is configured and tested.

---

## 4. Premium web design system

### Visual direction
- Premium, modern academic SaaS dashboard.
- Clean neutral surfaces, restrained indigo/blue accent, subtle borders and shadows.
- Light theme initially; dark theme can follow after core UI.
- Clear typography, consistent spacing and data-dense but readable tables.
- Avoid excessive gradients, glassmorphism and decorative animation.

### Application shell
- Collapsible left navigation grouped by module.
- Top bar with college/academic-year context, search, notifications and profile.
- Breadcrumbs, page titles and responsive content grid.
- Role-aware menus (not security boundaries).

### Required pages
- Sign-in, forgot/reset password, invitation acceptance.
- Role-specific dashboard.
- Students list/create/edit/profile.
- Faculty/staff list and profile.
- Departments, programs, subjects, academic years and sections.
- Timetable and calendar.
- Attendance sessions and reports.
- Exams, marks entry and results.
- Fee plans, invoices, payments and receipts.
- Library catalog and circulation.
- Placement companies, drives and applications.
- Notices, notifications and support tickets.
- AI assistant and AI configuration/status.
- Reports, audit logs and settings.

### Accessibility and responsive UX
- Responsive browser layouts for desktop, tablet and phone.
- Keyboard navigation, semantic HTML, visible focus and accessible labels.
- Loading, empty, error, success and permission-denied states.
- Pagination and filters for large datasets.
- Confirm destructive actions and explain validation errors.

---

## 5. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + JavaScript (`.jsx`) |
| Styling | Tailwind CSS + shadcn/ui-compatible components |
| Routing | React Router |
| Forms | React Hook Form + Zod |
| Client/server data | TanStack Query where useful; Firebase SDK |
| Backend | Firebase Cloud Functions (Node.js JavaScript initially) |
| Database | Cloud Firestore |
| Authentication | Firebase Authentication |
| File storage | Firebase Storage |
| Authorization | Firestore Security Rules + Cloud Functions checks |
| Admin access | Firebase Admin SDK, server-side only |
| AI | Gemini API through Cloud Functions |
| Charts | Recharts |
| Realtime | Firestore listeners only where realtime is valuable |
| Tests | Vitest + React Testing Library; Functions emulator tests; Playwright |
| Local development | Firebase Emulator Suite |
| Hosting | Firebase Hosting |
| Monitoring | Firebase/Google Cloud logs and monitoring |

Use JavaScript for the frontend and `.jsx` for React components as requested. Keep non-component JavaScript files as `.js`. Do not introduce TypeScript/`.tsx` unless the user explicitly changes this decision.

---

## 6. Architecture and folder structure

Start with a modular web frontend and Firebase backend. Avoid creating an unnecessary Express server if Cloud Functions cover the required trusted server operations.

```text
CampusOS/
├── public/
│   ├── favicon.svg
│   └── assets/
│
├── src/                              # React browser app only
│   ├── app/
│   │   ├── App.jsx
│   │   ├── providers.jsx
│   │   └── router.jsx
│   ├── assets/
│   ├── components/
│   │   ├── ui/
│   │   ├── data-table/
│   │   ├── forms/
│   │   └── feedback/
│   ├── layouts/
│   │   ├── AuthLayout.jsx
│   │   └── DashboardLayout.jsx
│   ├── modules/
│   │   ├── dashboard/
│   │   ├── admissions/
│   │   ├── students/
│   │   ├── guardians/
│   │   ├── faculty/
│   │   ├── staff/
│   │   ├── administration/
│   │   ├── academics/
│   │   ├── timetable/
│   │   ├── attendance/
│   │   ├── examinations/
│   │   ├── finance/
│   │   ├── library/
│   │   ├── placements/
│   │   ├── communication/
│   │   ├── documents/
│   │   ├── reports/
│   │   └── ai-assistant/
│   ├── hooks/
│   ├── services/
│   ├── firebase/
│   │   ├── firebase.js
│   │   ├── auth.js
│   │   └── firestore.js
│   ├── utils/
│   ├── schemas/
│   ├── styles/
│   └── main.jsx
│
├── functions/                        # Trusted server-side code
│   ├── src/
│   │   ├── index.js
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── users/
│   │   │   ├── admissions/
│   │   │   ├── finance/
│   │   │   ├── reports/
│   │   │   ├── notifications/
│   │   │   └── ai/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
│
├── tests/
│   ├── rules/
│   ├── functions/
│   └── e2e/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FIRESTORE_DATA_MODEL.md
│   ├── SECURITY_RULES.md
│   ├── AI_GOVERNANCE.md
│   └── DEPLOYMENT.md
├── firebase.json
├── .firebaserc.example
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .env.example
├── PROJECT_PLAN.md
├── CLAUDE_CODE_MASTER_PROMPT.md
├── README.md
└── package.json
```

**Explicit exclusion:** no `apps/mobile`, `mobile/`, React Native, Expo, Flutter, Android or iOS folders.

### Firestore data model principles

Suggested top-level collections:

```text
tenants/{tenantId}
users/{uid}
tenants/{tenantId}/members/{uid}
tenants/{tenantId}/departments/{departmentId}
tenants/{tenantId}/programs/{programId}
tenants/{tenantId}/academicYears/{yearId}
tenants/{tenantId}/subjects/{subjectId}
tenants/{tenantId}/students/{studentId}
tenants/{tenantId}/guardians/{guardianId}
tenants/{tenantId}/staff/{staffId}
tenants/{tenantId}/admissions/{applicationId}
tenants/{tenantId}/sections/{sectionId}
tenants/{tenantId}/timetableSlots/{slotId}
tenants/{tenantId}/attendanceSessions/{sessionId}
tenants/{tenantId}/attendanceRecords/{recordId}
tenants/{tenantId}/exams/{examId}
tenants/{tenantId}/marks/{markId}
tenants/{tenantId}/feePlans/{planId}
tenants/{tenantId}/invoices/{invoiceId}
tenants/{tenantId}/payments/{paymentId}
tenants/{tenantId}/books/{bookId}
tenants/{tenantId}/bookLoans/{loanId}
tenants/{tenantId}/companies/{companyId}
tenants/{tenantId}/placementDrives/{driveId}
tenants/{tenantId}/notices/{noticeId}
tenants/{tenantId}/notifications/{notificationId}
tenants/{tenantId}/supportTickets/{ticketId}
tenants/{tenantId}/documents/{documentId}
tenants/{tenantId}/auditLogs/{logId}
tenants/{tenantId}/knowledgeDocuments/{documentId}
```

These are logical starting points, not permission rules. Refine document boundaries and denormalized read models based on actual query patterns.

Firestore design constraints:
- Model around known query patterns; Firestore is not a relational database and does not support arbitrary SQL joins.
- Denormalize selectively and document every duplicated field plus its update strategy.
- Keep documents bounded; use subcollections or separate collections for growing histories.
- Create composite indexes for actual compound queries.
- Use batched writes/transactions only within Firestore limits; design larger workflows as resumable server-side jobs.
- Avoid unbounded arrays and unbounded listener queries.
- Store money as integer minor units plus currency code.
- Use server timestamps for authoritative event times.
- Use deterministic IDs or idempotency records for retry-sensitive operations.
- Use soft status transitions for records needing history.
- Keep a tenant ID in tenant-owned records and validate it against trusted membership.
- Do not assume that hiding a collection in the UI secures it.

### Security model

- Firebase Authentication establishes identity.
- `users/{uid}` contains safe profile metadata only.
- `tenants/{tenantId}/members/{uid}` is the trusted membership/role source.
- Custom claims may be used for coarse global flags, but do not rely on large or frequently changing permission payloads in claims.
- Firestore Rules validate `request.auth`, membership, role and resource scope.
- Sensitive multi-document operations run in Cloud Functions with Firebase Admin SDK and explicit authorization checks. Admin SDK bypasses Firestore Rules, so every callable/HTTP function must independently verify authentication, tenant membership and permission.
- Storage Rules must validate tenant membership, path ownership, file size and content type.
- Test rules using Firebase Emulator Suite with allow and deny cases.
- Never deploy permissive rules such as `allow read, write: if true`.

### Data access flow

```text
React browser (.jsx)
  -> Firebase Authentication
  -> Firestore SDK for rule-protected reads and simple permitted writes
  -> Callable/HTTPS Cloud Functions for privileged workflows
       -> verify auth + tenant membership + permission
       -> validate request
       -> perform Admin SDK transaction / trusted operation
       -> write audit event
  -> Firestore / Storage
```

Use Cloud Functions for payment confirmation, role changes, admission conversion, marks publication, secure exports, Gemini calls and other privileged workflows.

---

## 7. Local development and Windows PowerShell setup

### Prerequisites
- Git
- Node.js LTS and npm
- Java runtime if required by the Firebase Emulator Suite version in use
- Firebase CLI
- A Firebase project for deployment testing
- Claude Code installed and authenticated

### Create project

```powershell
Set-Location D:\Applications
New-Item -ItemType Directory -Name CampusOS
Set-Location .\CampusOS
git init

New-Item -ItemType Directory -Force -Path `
  src\app, src\assets, src\components\ui, src\layouts, `
  src\modules, src\hooks, src\services, src\firebase, `
  src\utils, src\schemas, src\styles, `
  functions\src, tests\rules, tests\functions, tests\e2e, docs | Out-Null
```

### Install/use Firebase CLI

```powershell
npm install -g firebase-tools
firebase --version
firebase login
```

Initialize Firebase after creating or selecting your Firebase project:

```powershell
firebase init
```

Select Hosting, Firestore, Functions, Storage and Emulators as needed. Configure Hosting's public directory to the Vite build output (`dist`) and configure SPA rewrites to `/index.html`.

### Start local emulators

After Firebase initialization and emulator configuration:

```powershell
firebase emulators:start
```

### Environment configuration

Create `.env.example` for browser-safe Firebase web configuration values and server-only secrets separately. Firebase web app configuration is not a substitute for security rules. Never put Gemini API keys, service-account JSON or Admin SDK credentials in `VITE_*` variables or browser code.

Example browser `.env.example`:

```dotenv
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_USE_FIREBASE_EMULATORS=true
```

Configure Gemini credentials using Cloud Functions secrets (for example, Firebase Functions secret configuration supported by the chosen CLI/runtime). Do not commit secrets.

### Project scripts

Claude Code must create real scripts before documenting or invoking them. Root scripts should include equivalents for:

```powershell
npm run dev
npm run build
npm run lint
npm run test
npm run test:rules
npm run test:e2e
```

Use `firebase emulators:start` for local Firebase services. Do not claim a command passed unless it was run and its output inspected.

---

## 8. Implementation roadmap

| Phase | Deliverables | Exit criteria |
|---|---|---|
| 0. Discovery and setup | Repo, Vite React JSX, Firebase config, emulator setup, scripts, docs | App starts; emulators configured; no mobile files |
| 1. Design system | Tokens, components, responsive shell, navigation | Responsive UI and accessibility baseline |
| 2. Identity and security | Firebase Auth, tenant membership, RBAC, Rules, protected routes | Emulator allow/deny tests pass |
| 3. College administration | Tenants, departments, programs, years, subjects, sections | Tenant isolation and CRUD verified |
| 4. Admissions and students | Enquiries, applications, students, guardians, documents | Admission conversion is trusted and auditable |
| 5. Faculty and academics | Staff, assignments, curriculum, timetable | Role checks and timetable conflict validation pass |
| 6. Attendance | Sessions, records, corrections, reports | Faculty assignment restrictions pass |
| 7. Examinations | Exams, marks, grading, approval, publication | Calculations and permissions verified |
| 8. Finance | Fee plans, invoices, payments, receipts, dues | Secure/idempotent payment flow tested |
| 9. Library and placements | Catalog, loans, companies, drives, applications | Complete workflows verified |
| 10. Communication and documents | Notices, notifications, tickets, certificates, exports | Audience and file access rules pass |
| 11. Gemini AI | Knowledge assistant, report helper, summaries, drafting | Server-side secrets, privacy, human review and tests pass |
| 12. Analytics and polish | Dashboards, exports, accessibility, responsive refinement | Critical role journeys pass |
| 13. Production readiness | Rules audit, CI, monitoring, backups/export strategy, deployment | Deployment smoke tests and security review pass |

**MVP recommendation:** complete phases 0–8 and a basic notices module before adding every advanced module and Gemini workflows.

### Implementation Status Tracker (Verified Locally)
| Phase | Status | Notes |
|---|---|---|
| 0. Discovery and setup | Implemented and verified | Vite + React `.jsx`/`.js`, Firebase Hosting/Firestore/Storage/Functions/Emulators configured; web-only |
| 1. Design system | Implemented and verified | Tailwind v4 UI primitives, `DataTable`, responsive collapsible shell, loading/empty/error/permission states |
| 2. Identity and security | Implemented and verified | Firebase Auth, centralized RBAC (`src/schemas/roles.js`), Firestore & Storage Rules verified on Emulator |
| 3. College administration | Implemented and verified | Multi-tenant provisioning, activation/suspension, member role assignment via Cloud Functions |
| 4. Admissions and students | Implemented and verified | Application intake, transactional `decideAdmission` conversion, student & guardian directory |
| 5. Faculty and academics | Implemented and verified | Faculty/staff profiles, departments, courses, subjects, classes, deterministic timetable clash checks |
| 6. Attendance | Implemented and verified | Composite session IDs preventing duplicates, shortage thresholds, correction approvals |
| 7. Examinations | Implemented and verified | Exam schedule, draft marks entry, server-side `publishExamResults` grade calculation |
| 8. Finance | Implemented and verified | Integer minor units, invoices, idempotent `recordPayment`, adjustments, receipts; gateway secret unconfigured |
| 9. Library and placements | Implemented and verified | Catalog, transactional issue/return with fines, placement drives & eligibility applications |
| 10. Communication and documents | Implemented and verified | Notices, events, tickets, notifications, Storage uploads (5 MB / type check), certificates |
| 11. Gemini AI | Implemented (externally unconfigured) | Server-side `runCampusAi` with RAG, PII minimization, rate limit, human review; requires `GEMINI_API_KEY` |
| 12. Analytics and polish | Implemented and verified | Real Firestore Recharts dashboards, formula-safe CSV exports, responsive desktop & mobile web views |
| 13. Production readiness | Partially implemented | Local emulator, rules, functions, unit & E2E verification complete; requires production Firebase & secret keys |

---

## 9. Quality gates and testing

- React unit/component tests with Vitest and React Testing Library.
- Firestore Security Rules tests using `@firebase/rules-unit-testing` and Emulator Suite.
- Cloud Functions tests using emulator/test environment.
- Playwright browser E2E for key journeys.
- Test unauthenticated access, wrong role, wrong tenant, wrong student/record, guardian linkage, staff assignment and storage access.
- Test retry/idempotency for payment and other financial workflows.
- Test Firestore transaction/batch limits and query indexes.
- Verify `npm run lint`, `npm run test`, `npm run build`, rules tests and E2E tests.
- Never weaken security rules or remove negative tests to obtain a green build.

---

## 10. Definition of done

A module is complete only when:
- Responsive UI includes loading, empty, error and permission states.
- Data operations use Firestore or trusted Cloud Functions, not fake local success.
- Security Rules and/or function-level authorization enforce tenant and record access.
- Important actions create audit records.
- Business rules and authorization-negative tests pass.
- Query indexes are documented and deployed.
- Documentation describes setup, roles, data model and limitations.

A release is production-ready only after security review, rules tests, monitoring, backup/export strategy, deployment verification and operational documentation.

---

## 11. AI coding-agent rules

- Treat this file as the project source of truth.
- Inspect the repository before editing.
- Implement only the currently approved phase.
- Use `.jsx` for React components and `.js` for ordinary JavaScript files.
- Do not introduce TypeScript or `.tsx` unless explicitly approved.
- Do not create native mobile applications or mobile folders.
- Do not rewrite from scratch or delete working code without approval.
- Do not run destructive Git/database commands.
- Do not commit, push or perform GitHub operations unless explicitly requested.
- Explain dependencies before installing them.
- Do not claim Firebase/Gemini is connected unless a real verification succeeds.
- Never fake a successful write if Firebase is unavailable.
- Never expose Gemini keys or Admin SDK credentials in frontend code.
- Do not claim tests pass unless they were run and observed.
- Report changed files, commands, actual results, blockers and next step after each phase.
