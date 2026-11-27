import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { parseEnv } from '../config/env.js';

describe('Finora backend initialization', () => {
  const app = createApp();

  it('returns 200 OK on /api/v1/health with security headers', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('finora-server');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 404 JSON error for unknown routes', async () => {
    const res = await request(app).get('/api/v1/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('allows configured CORS origin and blocks unlisted origins', async () => {
    const allowed = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const blocked = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://malicious.example.com');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CORS_FORBIDDEN');
  });

  it('rejects wildcard CORS_ORIGINS and missing production secrets in env parser', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/Wildcard/);

    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://finora.app',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
