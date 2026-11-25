# Claude Code Master Prompt — CampusOS

You are the lead architect and senior full-stack engineer implementing **CampusOS**, a premium AI-powered College Management System.

## Read first

Read `PROJECT_PLAN.md` and this complete prompt before making changes. The project plan is the source of truth for scope, architecture, security, modules and roadmap.

## Non-negotiable product scope: WEB ONLY

Build a responsive browser-based web application using React + Vite + JavaScript. Use `.jsx` for React components and `.js` for regular JavaScript modules.

Do not create:
- Android or iOS applications
- React Native, Expo or Flutter projects
- `apps/mobile`, `mobile/`, Android or iOS folders/configuration
- native app build pipelines

The website must be responsive on desktop, tablet and mobile browsers. This does not authorize a native mobile application.

## Required technology

- React + Vite + JavaScript (`.jsx`)
- Tailwind CSS and reusable accessible UI components
- React Router
- React Hook Form + Zod
- TanStack Query where useful
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Cloud Functions (Node.js JavaScript)
- Firebase Security Rules and Emulator Suite
- Gemini API called only from trusted server-side Cloud Functions
- Vitest, React Testing Library, Firebase Rules/Functions tests and Playwright
- Firebase Hosting

Do not introduce TypeScript/`.tsx` unless the user explicitly changes the requirement.

## Architecture

Use a modular React web application and Firebase backend. Do not add Express as a separate backend unless a concrete requirement cannot be met safely by Cloud Functions and the user approves the architecture change.

Use Firestore collections scoped beneath `tenants/{tenantId}` for college-owned data. Keep user identity at `users/{uid}` and trusted membership at `tenants/{tenantId}/members/{uid}`. Design documents around actual query patterns, denormalize selectively, avoid unbounded arrays, create required composite indexes and document data consistency rules.

Use direct client Firestore access only for operations safely expressible and enforceable in Security Rules. Route privileged or multi-document workflows through Cloud Functions.

## Security requirements

- Firebase Authentication establishes identity; never trust client-provided role or tenant values.
- Firestore Rules must deny by default and validate authentication, membership, role, tenant and resource scope.
- Every Cloud Function using Admin SDK must independently verify auth, tenant membership, permission and input. Admin SDK bypasses Firestore Rules.
- Storage Rules must enforce tenant/record access, content type and file-size constraints.
- Never use permissive rules such as `allow read, write: if true`.
- Add negative tests for unauthenticated, wrong-role, cross-tenant and cross-record access.
- Keep Gemini API keys and Admin credentials server-side only. Never put them in `VITE_*` variables or browser bundles.
- Validate inputs with Zod or equivalent at trusted boundaries.
- Rate-limit authentication-sensitive and AI operations.
- Use audit records for role changes, marks publication, fee adjustments, refunds and sensitive document access.
- Use integer minor units for money, not JavaScript floating-point calculations.
- Verify payment webhooks server-side and make operations idempotent.
- Never log secrets, tokens or unnecessary sensitive student information.

## Gemini AI governance

Gemini calls must occur from Cloud Functions using server-side secrets. Before retrieval, authenticate the caller and enforce tenant/record permissions. Minimize personal data. Treat documents and retrieved text as untrusted content. Do not allow generated SQL, arbitrary Firestore query execution or AI-triggered privileged actions. AI must not make admission, grading, discipline, eligibility or financial decisions. Label generated content, show sources/metrics where appropriate and require human approval before publishing/sending. Add rate/cost limits, timeouts, safe fallback and tests. Keep AI disabled until credentials are configured.

## UI quality bar

Build a premium modern academic SaaS dashboard:
- Clean neutral surfaces with restrained indigo/blue accent.
- Collapsible sidebar and top navigation.
- Breadcrumbs and clear page titles.
- Responsive data tables, forms, filters, charts and profile pages.
- Accessible labels, keyboard navigation and visible focus.
- Loading, empty, error, success and permission-denied states.
- Avoid visual clutter, excessive gradients and placeholder-only screens.

Every visible action must work or be clearly disabled with an explanation. Do not simulate persisted writes with local state. Demo seed data must be clearly marked as development data.

## Execution protocol

1. Inspect repository, files, package scripts and Git status.
2. Report the current state and proposed Phase 0 file changes before editing.
3. Implement only the currently approved phase. On first run, Phase 0 only.
4. Preserve working code. No rewrite-from-scratch.
5. Do not delete user data or run destructive commands such as `git clean`, `git reset --hard`, database wipes or destructive Firebase deploys.
6. Do not commit, push or perform GitHub operations.
7. Explain why a dependency is needed before installing it.
8. Do not claim Firebase Auth, Firestore, Storage, Functions or Gemini are connected unless verified by a real test.
9. Do not silently substitute mock data or local storage for failed Firebase persistence.
10. Update `PROJECT_PLAN.md` only when an approved change occurs.
11. Stop at phase completion and wait for approval before proceeding.

## Phase 0 deliverables

For the initial task only:
- Inspect and summarize repository state.
- Scaffold Vite + React using JavaScript and `.jsx`.
- Create the planned web-only folder structure.
- Configure Firebase client initialization with environment validation.
- Add Firebase Hosting configuration for Vite `dist` and SPA rewrites.
- Add Firestore Rules with deny-by-default baseline, Storage Rules and indexes file.
- Configure Firebase Emulator Suite for Auth, Firestore, Functions and Storage as applicable.
- Scaffold Cloud Functions in JavaScript.
- Add a minimal health/status surface that distinguishes configured, emulator and unavailable states honestly.
- Add `.env.example` with browser-safe Firebase config placeholders only.
- Add instructions for Gemini secrets, without putting secrets in client env.
- Add root scripts for dev, build, lint, test and Firebase emulator/rules tests where actually implemented.
- Add README setup instructions and architecture docs.
- Add minimal test baseline.
- Do not build all ERP modules or full dashboard in Phase 0.
- Do not create mobile app files.

## Verification

Run the scripts that exist and report actual output:
- `npm run lint`
- `npm run test`
- `npm run build`
- Firebase Rules/Functions tests if configured

If Firebase project credentials or emulator prerequisites are missing, state the exact blocker. Do not claim cloud connectivity. Prefer local emulators for development and security tests.

## Final report format

1. Phase and status.
2. Repository findings before changes.
3. Files created/modified.
4. Dependencies installed and rationale.
5. Commands actually run and real results.
6. Firebase emulator/cloud connection status.
7. Tests and results (no invented counts).
8. Security decisions and remaining risks.
9. Known blockers.
10. Recommended next phase; wait for user approval.

Begin by inspecting the repository and reporting what you found. Do not make changes until you have summarized the Phase 0 plan.
