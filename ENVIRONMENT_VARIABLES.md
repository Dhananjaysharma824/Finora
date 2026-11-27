# FINORA — Environment Variables Reference

Never commit `.env` files or real secrets to version control. Use `.env.example` files as templates.

## Frontend (`d:\finora\.env`)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | Optional (required for backend mode) | `https://api.finora.yourdomain.com` | Base URL for backend API requests. Leave unset to run in Local Demo Mode. |

> **Security Rule:** Never place database URLs, session secrets, or private API keys in `VITE_*` variables. Everything prefixed with `VITE_` is embedded in the browser bundle.

---

## Backend (`d:\finora\server\.env`)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Enables strict env checks, `trust proxy`, and `Secure` cookies. |
| `PORT` | Yes | `4000` | HTTP port the Express server listens on. |
| `CORS_ORIGINS` | Yes | `https://app.finora.yourdomain.com` | Comma-separated origin allowlist. Wildcard `*` is rejected. |
| `JSON_BODY_LIMIT` | No (default `100kb`) | `100kb` | Maximum request JSON/form payload size. |
| `DATABASE_URL` | Yes (in prod) | `postgresql://user:pass@host:5432/finora?sslmode=require&connection_limit=20` | PostgreSQL connection string with SSL and pooling parameters. |
| `SESSION_SECRET` | Yes (in prod) | `32+ char random secret` | Secret for session configuration (minimum 16 chars enforced). |
| `CSRF_SECRET` | Yes (in prod) | `32+ char random secret` | Secret for CSRF configuration (minimum 16 chars enforced). |
| `COOKIE_NAME` | No (default `finora_sid`) | `finora_sid` | Name of the `HttpOnly` session cookie. |
