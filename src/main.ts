import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './common/database';
import { logger } from './common/utils';
import { getProviderRegistry } from './modules/providers';
import cron from 'node-cron';
import { blockchainService } from './modules/blockchain';

// ============================================
// Application Entry Point
// ============================================

async function bootstrap(): Promise<void> {
  logger.info('🚀 Starting DePIN Storage Aggregator...');

  try {
    // Connect to database
    await connectDatabase();

    // Initialize provider registry
    const registry = getProviderRegistry();
    await registry.initialize();

    // Initial provider sync
    logger.info('📦 Syncing storage providers...');
    await registry.syncAllProviders();

    // Create Express app
    const app = createApp();

    // Setup cron jobs
    if (config.cron.enabled) {
      setupCronJobs();
    }

    // Start server
    const server = app.listen(config.app.port, () => {
      logger.info(`✅ Server running on port ${config.app.port}`);
      logger.info(`📍 API: ${config.app.baseUrl}/api`);
      logger.info(`🌐 UI: ${config.app.baseUrl}`);
      logger.info(`🔧 Environment: ${config.app.env}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

function setupCronJobs(): void {
  // Provider sync job
  cron.schedule(config.cron.providerSync, async () => {
    logger.info('⏰ Running scheduled provider sync...');
    try {
      const registry = getProviderRegistry();
      await registry.syncAllProviders();
    } catch (error) {
      logger.error('Provider sync cron failed', error);
    }
  });

  // Transaction confirmation job
  cron.schedule(config.cron.txConfirmation, async () => {
    logger.debug('⏰ Checking pending transactions...');
    try {
      await blockchainService.processPendingConfirmations();
    } catch (error) {
      logger.error('Transaction confirmation cron failed', error);
    }
  });

  logger.info('⏰ Cron jobs configured', {
    providerSync: config.cron.providerSync,
    txConfirmation: config.cron.txConfirmation,
  });
}

// Start the application
bootstrap();