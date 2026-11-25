# CampusOS — AI-Powered College Management System

> **Tagline:** One Campus. One Platform. Intelligent Management.  
> **Platform:** Responsive Web Application Only (Desktop, Tablet, Mobile Browsers)  
> **Frontend:** React + Vite + JavaScript (`.jsx`/`.js`) + Tailwind CSS + React Router + TanStack Query + React Hook Form + Zod + Recharts  
> **Backend & Security:** Firebase Authentication, Cloud Firestore, Firebase Storage, Cloud Functions (Node.js JS), Firebase Hosting  
> **AI:** Google Gemini via trusted server-side Cloud Functions

---

## Core Modules Implemented

1. **Platform Administration**: Multi-college tenant provisioning, activation/suspension, subscription plans (`starter`, `growth`, `enterprise`).
2. **Authentication & RBAC**: Firebase Auth (Sign-in, Register, Password Reset, Email Verification), centralized role & permission mapping (`platform_super_admin`, `college_admin`, `principal`, `hod`, `faculty`, `admission_officer`, `accountant`, `librarian`, `placement_officer`, `student`, `parent`, `auditor`).
3. **Admissions & Enquiries**: Application intake, pipeline stage tabs, human-reviewed admission approval/rejection, atomic student conversion via `decideAdmission` Cloud Function.
4. **Student Information**: Directory, enrollment numbers, department/course/semester assignments, guardian metadata, lifecycle status.
5. **Faculty & Staff**: Teaching faculty and administrative staff directories, department assignments, weekly workload tracking.
6. **Academics & Timetable**: Departments, courses, subjects, classes/divisions, and clash-checked timetable scheduling (`detectTimetableClash`).
7. **Attendance Management**: Daily subject/session roll call with deterministic composite IDs preventing duplicate marks, shortage threshold alerts, and correction request/approval workflow.
8. **Examinations & Results**: Exam schedules, faculty draft marks entry, and server-side grade calculation & publication via `publishExamResults` Cloud Function.
9. **Fees & Finance**: Integer minor-unit (`INR` paise / currency minor units) fee structures, student invoices, idempotent manual payments (`recordPayment`), scholarship concessions/refunds (`issueFeeAdjustment`), printable receipts, and HMAC webhook boundary (`paymentWebhook`).
10. **Library Management**: Catalog titles, copy inventory, transactional book issue/return, deterministic overdue fine calculation.
11. **Placements & Internships**: Companies, drives with minimum percentage eligibility rules, student applications, review stages.
12. **Communication & Helpdesk**: Campus notices, calendar events, support tickets with status workflow, and user notifications.
13. **Documents & Certificates**: Tenant-scoped Firebase Storage uploads (PDF/JPG/PNG/WEBP, 5 MB max), verification workflow, printable certificates.
14. **Reports & Analytics**: Real Firestore-backed analytics charts and formula-injection-safe CSV exports.
15. **Gemini AI Assistant**: Governed server-side RAG Knowledge Assistant, Report Assistant, Attendance Insights, Academic Summaries, Notice Drafting (human approval required), Timetable Suggestions, Ticket Categorization, and Document Summarization.
16. **Audit & Security Logs**: Immutable server-written audit records and AI execution logs.

---

## Quick Start (Local Development with Firebase Emulators)

### Prerequisites
- Node.js 20+ (tested on Node v24.22.0)
- npm 10+
- Java JDK 21 (required by Firebase Emulator Suite)
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

```powershell
npm install
npm --prefix functions install
Copy-Item .env.example .env
```

### Start Firebase Emulators & Seed Demo Data

```powershell
# Terminal 1: Start Auth, Firestore, Functions, Storage, and Hosting emulators
npm run emulators

# Terminal 2: Seed synthetic development accounts & sample college data (Emulator only)
npm run seed:emulator

# Terminal 3: Start Vite dev server
npm run dev
```

Demo emulator credentials (all synthetic development accounts use password `Password@123`):
- Super Admin: `superadmin@campusos.test`
- College Admin: `admin@stxavier.test`
- Faculty: `faculty@stxavier.test`
- Accountant: `accounts@stxavier.test`
- Student: `student@stxavier.test`
- Parent: `parent@stxavier.test`

---

## Gemini AI Secret Configuration (Server-Side Only)

**Never** place Gemini API keys in `.env` or any `VITE_*` variable.

- **Local Functions Emulator**: create `functions/.secret.local`:
  ```dotenv
  GEMINI_API_KEY=your_server_side_gemini_key
  ```
- **Production Firebase**:
  ```powershell
  firebase functions:secrets:set GEMINI_API_KEY
  ```

Until `GEMINI_API_KEY` is configured on Cloud Functions, AI endpoints honestly report `configured: false` and remain safely disabled in the UI.

---

## Scripts

- `npm run dev` — Start Vite React development server
- `npm run build` — Build production bundle to `dist/`
- `npm run lint` — Run ESLint across frontend, tests, scripts, and functions
- `npm run test` — Run frontend unit & component tests (Vitest + RTL)
- `npm run test:functions` — Run Cloud Functions business logic & security helper tests
- `npm run test:rules` — Run Firestore & Storage Security Rules tests against Emulators
- `npm run test:e2e` — Run Playwright browser E2E tests
- `npm run seed:emulator` — Seed synthetic development data into local Emulators only

---

## Documentation Index

- [Architecture](docs/ARCHITECTURE.md)
- [Firestore Data Model](docs/FIRESTORE_DATA_MODEL.md)
- [Security Rules](docs/SECURITY_RULES.md)
- [AI Governance](docs/AI_GOVERNANCE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Testing Guide](docs/TESTING.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
