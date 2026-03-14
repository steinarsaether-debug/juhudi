import './loadEnv'; // must be first — loads .env with override so shell vars don't block
import app from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

// Ensure upload directory exists
const uploadDir = path.resolve(config.UPLOAD_PATH);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function start(): Promise<void> {
  await connectDatabase();

  // Load all tunable business constants from system_configs into memory cache
  const { configService } = await import('./services/configService');
  await configService.initialize();

  const server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info(`Juhudi Kilimo API running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { err });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });
}

start();
