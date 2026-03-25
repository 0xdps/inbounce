import config from './core/config.js';
import logger from './core/logger.js';
import { initializeSchema } from './core/db.js';
import server from './http/server.js';

async function main() {
  try {
    await initializeSchema();
    logger.info('✓ Database schema initialized');

    await server.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, '✓ Server listening');

    const shutdown = async () => {
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
