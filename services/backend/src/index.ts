import config from './core/config.js';
import logger from './core/logger.js';
import { initializeSchema } from './core/db.js';
import createServer from './http/server.js';

async function main(): Promise<void> {
  try {
    await initializeSchema();
    logger.info('✓ Database schema initialized');

    const server = await createServer();

    await server.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, '✓ Server listening');

    const shutdown = async (): Promise<void> => {
      logger.info('Shutting down gracefully...');
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.fatal(error, 'Fatal error during startup');
    process.exit(1);
  }
}

main();
