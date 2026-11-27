# FINORA — Bugs & Functionality Audit Report

**FUNCTIONALITY SCORE: 7.5/10**  
**BUGS & STABILITY SCORE: 7.5/10**

---

## Confirmed Issues & Gaps

### BUG-01 — Backend Write Sync Not Wired in `useFinoraStore`
- **Severity:** High
- **Affected File:** `src/stores/useFinoraStore.ts`
- **Explanation:** `syncFromBackend()` exists for initial hydration, but `addTransaction`, `updateTransaction`, `deleteTransaction`, `addAccount`, `addBudget`, `addGoal`, `contributeToGoal`, and `markRecurringPaid` only update local state and `localStorage`.
- **Reproduction:** Sign in with `VITE_API_BASE_URL` enabled, create a transaction, and refresh; the backend database does not have the new record.
- **Recommended Fix:** Add `finoraApi` write methods for all modules and invoke them from `useFinoraStore` when `authMode === 'backend'`.

### BUG-02 — `LoginPage` Does Not Trigger `syncFromBackend()` After Login
- **Severity:** Medium
- **Affected File:** `src/pages/LoginPage.tsx` (lines 38–47)
- **Explanation:** After `await login(values.email, values.password)` succeeds, `LoginPage` navigates to `/dashboard` without calling `useFinoraStore.getState().syncFromBackend()`.
- **Recommended Fix:** Call `await useFinoraStore.getState().syncFromBackend()` right after login and when `checkSession()` succeeds in `App.tsx`.

### BUG-03 — No UI for Forgot Password / Reset Password / Email Verification
- **Severity:** Medium
- **Affected File:** `src/pages/LoginPage.tsx`, `src/App.tsx`
- **Explanation:** Backend endpoints exist (`/forgot-password`, `/reset-password`, `/verify-email`), but users have no frontend pages/links to trigger them.

### BUG-04 — CSV Import Does Not Handle Multi-Line Quoted Notes
- **Severity:** Low
- **Affected File:** `src/pages/TransactionsPage.tsx` (line 283)
- **Explanation:** `text.split(/\r?\n/)` splits on newlines before `parseCsvLine()`, so a CSV cell containing an embedded newline inside quotes would split across two rows.
- **Recommended Fix:** Use a state-machine CSV parser that respects newlines inside quoted fields.

### BUG-05 — Unverified Live Browser & Live PostgreSQL Execution
- **Severity:** Informational (Unverified)
- **Explanation:** Automated Chrome DevTools / Playwright visual checks and live PostgreSQL queries could not run in this host environment. All 22 frontend tests and 21 backend tests passed in Vitest/Supertest/jsdom.
