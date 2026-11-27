import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JSON_BODY_LIMIT: z.string().default('100kb'),
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  CSRF_SECRET: z.string().min(16).optional(),
  COOKIE_NAME: z.string().min(1).default('finora_sid'),
});

export interface EnvConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  jsonBodyLimit: string;
  databaseUrl?: string;
  cookieName: string;
}

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }

  const data = parsed.data;
  if (data.NODE_ENV === 'production') {
    if (!data.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!data.SESSION_SECRET || !data.CSRF_SECRET) {
      throw new Error('SESSION_SECRET and CSRF_SECRET are required in production');
    }
  }

  const corsOrigins = data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.includes('*')) {
    throw new Error('Wildcard "*" is not permitted in CORS_ORIGINS');
  }

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    corsOrigins,
    jsonBodyLimit: data.JSON_BODY_LIMIT,
    databaseUrl: data.DATABASE_URL,
    cookieName: data.COOKIE_NAME,
  };
}

export const env = parseEnv();
