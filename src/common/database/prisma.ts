import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../utils/logger';

// ============================================
// Prisma Client Singleton
// ============================================

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: config.app.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  });

  // Log queries in development
  if (config.app.isDevelopment) {
    client.$on('query' as never, (e: { query: string; duration: number }) => {
      logger.debug('Prisma Query', { 
        query: e.query, 
        duration: `${e.duration}ms` 
      });
    });
  }

  return client;
};

// Singleton pattern for Prisma Client
export const prisma = global.__prisma ?? createPrismaClient();

if (config.app.isDevelopment) {
  global.__prisma = prisma;
}

// Connection management
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

// Transaction helper
export async function withTransaction<T>(
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn);
}

export default prisma;