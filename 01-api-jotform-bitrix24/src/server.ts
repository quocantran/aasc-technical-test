import app from './app';
import { config, validateConfig } from './configs/env';
import { logger } from './utils/logger';

// Validate environment configuration before starting HTTP listener
try {
  validateConfig();
} catch (error: any) {
  logger.error(`Configuration Error: ${error.message}`);
  process.exit(1);
}

// Start HTTP server
const server = app.listen(config.port, () => {
  logger.info(`===================================================`);
  logger.info(`Server running on http://localhost:${config.port}`);
  logger.info(`Webhook Endpoint: http://localhost:${config.port}/webhook/jotform`);
  logger.info(`Health Check:     http://localhost:${config.port}/health`);
  logger.info(`===================================================`);
});

// Graceful shutdown handler
function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
