const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'sessiontoken',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'database_url',
  'session_secret',
  'csrf_secret',
]);

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeMeta(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function writeLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: sanitizeMeta(meta) } : {}),
  };
  const serialized = JSON.stringify(entry);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => writeLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog('error', message, meta),
};
