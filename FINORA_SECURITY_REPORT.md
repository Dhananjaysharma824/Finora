# FINORA — Security Assessment Report

**SECURITY SCORE: 8.0/10**  
**SECURITY VULNERABILITIES DIAGNOSTIC SCORE: 8.5/10**

## Security Maturity Assessment
Finora has a **well-engineered security baseline** in both its Express backend (`server/`) and hardened React frontend (`src/`), with **0 known dependency vulnerabilities** (`npm audit` on both packages) and **0 `any` / `dangerouslySetInnerHTML` / hardcoded secret findings**. However, it is **not yet production-verified** because live PostgreSQL RLS/migrations, live HTTPS cookie/CSRF behavior, and transactional email delivery are currently **UNVERIFIED**.

---

## Issue Summary

| Severity | Number of Issues |
|---|---:|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 2 |
| Informational | 1 |

---

## Detailed Findings

### SEC-01 — Frontend Store Write Mutations Bypass Backend APIs
- **Severity:** High (Confirmed Gap)
- **Category:** Data Integrity / Backend Synchronization
- **Affected File:** `src/stores/useFinoraStore.ts` (lines 165–500)
- **Explanation:** While `syncFromBackend()` fetches workspace data from `/api/v1/*`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `addAccount`, `addBudget`, `addGoal`, `contributeToGoal`, and `markRecurringPaid` currently only mutate Zustand + `localStorage` without calling backend `POST/PATCH/DELETE` endpoints.
- **Potential Impact:** In backend mode, user mutations would be lost on page reload or remain unsaved on the server.
- **Reproduction:** Configure `VITE_API_BASE_URL`, sign in, add a transaction, and reload the page after `syncFromBackend()` runs.
- **Recommended Remediation:** Wire each mutation action in `useFinoraStore.ts` to call the corresponding `finoraApi` endpoint when `isBackendConfigured()` is true, then refresh/reconcile state from server responses.

### SEC-02 — Live PostgreSQL Ownership & Migration Execution Unverified
- **Severity:** Medium (Unverified)
- **Category:** Database Security
- **Affected File:** `server/prisma/schema.prisma`, `server/prisma/migrations/0001_init/migration.sql`
- **Explanation:** All 21 backend tests pass against in-memory Prisma mocks; no live PostgreSQL instance is configured in this environment.
- **Recommended Remediation:** Provision PostgreSQL, set `DATABASE_URL`, run `npx prisma migrate deploy`, and execute integration tests against the live database.

### SEC-03 — Email Verification & Password Reset Dispatcher Is a Stub
- **Severity:** Medium (Incomplete Infrastructure)
- **Category:** Authentication / Account Recovery
- **Affected File:** `server/src/services/email.service.ts` (lines 8–22)
- **Explanation:** `defaultEmailDispatcher` logs domain metadata instead of delivering real emails.
- **Recommended Remediation:** Integrate an authenticated SMTP/Resend/SES provider before production launch.

### SEC-04 — Local Demo Mode Relies on Unencrypted `localStorage`
- **Severity:** Medium (Architectural Limitation)
- **Category:** Browser Storage Security
- **Affected File:** `src/services/storage.ts`
- **Explanation:** When `VITE_API_BASE_URL` is unset, financial records are stored in `window.localStorage` (`finora_app_state`), which is readable/editable by any user with access to the browser profile or DevTools.
- **Recommended Remediation:** Keep backend mode enabled for production deployments; never treat `localStorage` as tamper-proof storage.

### SEC-05 — Missing `forgot-password` & `verify-email` Frontend Flows
- **Severity:** Low
- **Category:** Authentication UX / Security
- **Affected File:** `src/pages/LoginPage.tsx`
- **Explanation:** Backend routes `/api/v1/auth/forgot-password`, `/reset-password`, and `/verify-email` exist, but `LoginPage.tsx` does not yet expose UI forms for them.
- **Recommended Remediation:** Add `/forgot-password`, `/reset-password`, and `/verify-email` views using Finora's existing card/form components.

### SEC-06 — `index.html` CSP Allows `'unsafe-inline'` for Styles & Hardcodes `localhost:4000`
- **Severity:** Low
- **Category:** Security Headers
- **Affected File:** `index.html` (line 9)
- **Explanation:** `connect-src 'self' http://localhost:4000` is convenient for local dev, but production deployments should set HTTP-level CSP headers for the actual API origin.
- **Recommended Remediation:** Configure strict HTTP `Content-Security-Policy` headers at the CDN/reverse-proxy layer in production.

### SEC-07 — `server/src/modules/transactions/transactions.routes.ts` Import Endpoint Lacks Dedicated Rate Limiter
- **Severity:** Informational
- **Category:** Rate Limiting / DoS
- **Affected File:** `server/src/modules/transactions/transactions.routes.ts`
- **Explanation:** `POST /import` is bounded by `100kb` JSON limit and `max(500)` items, which mitigates large payloads, but adding a per-user rate limiter on bulk import/export endpoints provides defense-in-depth.
