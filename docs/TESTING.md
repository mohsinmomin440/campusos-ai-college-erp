# Testing Guide

## Test Suites
- **Frontend Unit & Component Tests (`npm run test`)**: Vitest + React Testing Library covering money integer arithmetic, CSV formula neutralization, timetable clash detection, centralized RBAC, Firebase config mode validation, and UI components.
- **Cloud Functions Business Logic Tests (`npm --prefix functions test` / `npm run test:functions`)**: Node test runner verifying invoice balance transitions, over-payment rejection, deterministic exam grade calculation, role escalation blocking, and Gemini PII redaction.
- **Firebase Security Rules Tests (`npm run test:rules`)**: `@firebase/rules-unit-testing` executed inside `firebase emulators:exec` verifying unauthenticated denials, cross-tenant isolation, student/parent ownership, unpublished exam isolation, immutable payments/audit logs, and Storage file/type/size enforcement.
- **End-to-End Browser Tests (`npm run test:e2e`)**: Playwright tests across desktop Chrome and mobile viewport (`Pixel 7`).
