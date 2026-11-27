# FINORA — Production Deployment Guide

## 1. PostgreSQL & Migrations
1. Provision a managed PostgreSQL 15+ database (e.g., Supabase, Neon, RDS, or Railway) with SSL (`sslmode=require`) and automated daily backups + point-in-time recovery.
2. Configure connection pooling (e.g., PgBouncer / Prisma Accelerate or `?connection_limit=20&pool_timeout=15` in `DATABASE_URL`).
3. Apply version-controlled migrations safely (never use `migrate dev` or destructive resets in production):
   ```bash
   cd server
   npx prisma migrate deploy
   ```
4. Seed only the shared default categories (`isDefault: true`) in production; never run the development demo-user seed in `NODE_ENV=production`.

## 2. Backend Deployment (`server/`)
1. Build or deploy using `server/Dockerfile` or a Node.js 22+ host (Render, Railway, Fly.io, Cloud Run).
2. Set all required environment variables from [ENVIRONMENT_VARIABLES.md](file:///d:/finora/ENVIRONMENT_VARIABLES.md).
3. Ensure `NODE_ENV=production` is set so:
   - `app.set('trust proxy', 1)` is active behind your reverse proxy / load balancer.
   - Session cookies are issued with `HttpOnly`, `Secure`, and `SameSite=Lax` (or `SameSite=None; Secure` if frontend and API are on different registrable domains).
4. Configure health checks:
   - Liveness: `GET /api/v1/health`
   - Readiness (DB connectivity): `GET /api/v1/health/ready`
5. Graceful shutdown (`SIGINT`/`SIGTERM`) is built into `server/src/server.ts`.

## 3. Frontend Deployment (`d:\finora`)
1. Set `VITE_API_BASE_URL` to your HTTPS backend origin (e.g., `https://api.finora.yourdomain.com`).
2. Build static assets:
   ```bash
   npm ci
   npm run build
   ```
3. Deploy `dist/` to Vercel, Netlify, Cloudflare Pages, or an S3/CloudFront CDN with SPA fallback (`/* -> /index.html`).
4. Configure edge HTTP security headers:
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`

## 4. Cross-Origin Cookie & CSRF Verification
1. Verify `CORS_ORIGINS` on the backend matches the exact HTTPS frontend origin (no trailing slash, no `*`).
2. Confirm `GET /api/v1/auth/csrf-token` sets `finora_csrf` and `POST /api/v1/auth/login` sets `finora_sid` (`HttpOnly; Secure`).
3. Confirm state-changing requests (`POST`, `PATCH`, `DELETE`) include `X-CSRF-Token` and succeed only from the allowlisted origin.
