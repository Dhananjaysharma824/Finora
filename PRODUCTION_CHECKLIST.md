# FINORA — Production Readiness Checklist

## Security & Authentication
- [x] Argon2id password hashing (`server/src/utils/crypto.ts`)
- [x] `HttpOnly` opaque session cookies with SHA-256 DB storage & rotation on login
- [x] Atomic single-use email verification and password reset tokens (`updateMany` with `usedAt: null`)
- [x] Double-submit CSRF protection + `Origin` validation (`server/src/middleware/auth.ts`)
- [x] Explicit `CORS_ORIGINS` allowlist (no wildcard `*`)
- [x] `helmet` security headers & request size limits (`100kb`)
- [x] Rate limiting on authentication routes (`express-rate-limit`)
- [x] `npm audit` = 0 vulnerabilities on both frontend and backend
- [ ] Configure transactional email provider (SMTP/Resend/SES) in `server/src/services/email.service.ts`

## Database & Financial Integrity
- [x] PostgreSQL + Prisma schema with UUIDs, `Decimal(18, 2)`, indexes, and unique constraints
- [x] Initial migration generated (`server/prisma/migrations/0001_init/migration.sql`)
- [x] Ownership enforcement (`assertOwnedAccount`, `assertAccessibleCategory`) on all queries/mutations
- [x] Atomic Prisma `$transaction` + `Idempotency-Key` support on financial mutations
- [ ] Run `npx prisma migrate deploy` against production PostgreSQL
- [ ] Enable automated daily database backups & point-in-time recovery

## Operations & Verification
- [x] Liveness (`GET /api/v1/health`) and readiness (`GET /api/v1/health/ready`) endpoints
- [x] Graceful `SIGINT`/`SIGTERM` shutdown (`server/src/server.ts`)
- [x] Structured JSON logging with secret redaction (`server/src/utils/logger.ts`)
- [x] CI workflow configured (`.github/workflows/ci.yml`)
- [x] Multi-stage non-root `server/Dockerfile`
- [ ] Verify HTTPS, custom domain, and cross-origin cookies in staging/production
