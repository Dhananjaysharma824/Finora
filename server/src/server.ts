import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info('finora_server_started', {
    port: env.port,
    environment: env.nodeEnv,
  });
});

let isShuttingDown = false;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('finora_server_shutting_down', { signal });

  server.close((err) => {
    if (err) {
      logger.error('finora_server_shutdown_error', { message: err.message });
      process.exit(1);
    }
    logger.info('finora_server_stopped');
    process.exit(0);
  });

  // Force exit if connections hang beyond 10s
  setTimeout(() => {
    logger.warn('finora_server_forced_exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', {
    name: err.name,
    message: err.message,
  });
  shutdown('uncaughtException');
});
