# Gemini AI Governance

## Server-Side Secret Isolation
- Gemini is called exclusively inside Cloud Functions (`functions/src/modules/ai/index.js`) using `@google/genai` and `process.env.GEMINI_API_KEY`.
- Frontend `VITE_*` variables never hold Gemini keys.
- When `GEMINI_API_KEY` is absent, `getAiStatus` reports `configured: false` and `runCampusAi` rejects cleanly with `failed-precondition`.

## Guardrails Implemented
1. **Caller Auth & Tenant Verification**: Every AI request verifies Firebase Auth, active tenant membership, and staff-only restrictions for drafting tasks (`notice_draft`, `timetable_suggestion`, `ticket_categorize`).
2. **Untrusted Context Isolation**: Retrieved handbook/document text is wrapped in `<untrusted_context>` delimiters with explicit instructions ignoring embedded prompt injection.
3. **PII Minimization**: `minimizePii()` strips email addresses and phone numbers before sending text to Gemini.
4. **Allow-Listed Reports**: `report_assistant` outputs strictly validated JSON specifications rather than SQL or raw Firestore queries.
5. **Human-in-the-Loop**: AI never assigns grades, admits/rejects applicants, changes fees, or publishes notices automatically. Staff must review and approve outputs.
6. **Rate Limits & Timeouts**: Sliding-window per-user rate limit (`12 requests / 60s` via `aiRateLimits`), `1500`-char prompt limit, `700`-token output cap, `18s` timeout, and immutable `aiLogs` records without storing raw PII.
