# FINORA — Priority Fix Roadmap

## P0 — Critical (Immediate Before Production Launch)
1. **Wire Backend Write Mutations in `useFinoraStore.ts` + Post-Login Sync**
   - **Impact:** Ensures all transactions, accounts, budgets, goals, and recurring payments persist to PostgreSQL in backend mode.
   - **Difficulty:** Medium | **Effort:** 4–6 hours.
2. **Provision PostgreSQL & Run `npx prisma migrate deploy`**
   - **Impact:** Verifies live DB queries, constraints, and readiness probe (`/api/v1/health/ready`).
   - **Difficulty:** Low | **Effort:** 1 hour.

## P1 — High (Security & Core Flows)
3. **Integrate Production Email Provider in `server/src/services/email.service.ts`**
   - **Impact:** Enables real email verification and password reset delivery.
   - **Difficulty:** Low–Medium | **Effort:** 2 hours.
4. **Add Forgot Password, Reset Password & Email Verification Pages (`src/pages/`)**
   - **Impact:** Completes self-service account recovery in the frontend UI.
   - **Difficulty:** Low | **Effort:** 2–3 hours.

## P2 — Medium (Performance, Accessibility & Code Quality)
5. **Optimize `public/favicon.png` (736 KB) & `public/finora_logo.png` (492 KB)**
   - **Impact:** Eliminates ~1.15 MB of unnecessary image download on initial load.
   - **Difficulty:** Low | **Effort:** 15 minutes.
6. **Configure `manualChunks` in `vite.config.ts`**
   - **Impact:** Splits the 680.7 kB main JS chunk into smaller cacheable vendor chunks.
   - **Difficulty:** Low | **Effort:** 30 minutes.
7. **Add Focus Trapping & Return-Focus to `Modal.tsx` and `Drawer.tsx`**
   - **Impact:** Brings dialogs and drawers to full WCAG 2.1 AA keyboard accessibility.
   - **Difficulty:** Low–Medium | **Effort:** 1–2 hours.
8. **Refactor `DashboardPage.tsx` (678 lines) & `TransactionsPage.tsx` (674 lines) and Adopt `useMoneyFormatter`**
   - **Impact:** Improves maintainability and eliminates duplicated `fmt` helpers.
   - **Difficulty:** Medium | **Effort:** 2–3 hours.

## P3 — Low (SEO & Polish)
9. **Add `robots.txt`, `noindex` meta for private routes, `<meta name="description">`, and per-route `document.title`**
   - **Impact:** Protects private financial routes from indexing and improves browser tab UX.
   - **Difficulty:** Low | **Effort:** 30 minutes.
10. **Run Live Playwright / Lighthouse Suite Across All 8 Viewports**
    - **Impact:** Produces measured LCP/INP/CLS and live multi-viewport visual verification.
    - **Difficulty:** Low | **Effort:** 1–2 hours.
