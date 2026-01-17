import winston from 'winston';
import { config } from '../../config';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.logging.format === 'json' 
      ? json() 
      : combine(colorize(), devFormat)
  ),
  defaultMeta: { service: 'depin-storage-aggregator' },
  transports: [
    new winston.transports.Console(),
  ],
});

// Add file transports in production
if (config.app.isProduction) {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    maxsize: 5242880,
    maxFiles: 5,
  }));
}

// Helper functions for structured logging
export const logInfo = (message: string, meta?: Record<string, unknown>) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => {
  const errorMeta = error instanceof Error 
    ? { error: error.message, stack: error.stack }
    : { error };
  logger.error(message, { ...errorMeta, ...meta });
};

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
  logger.debug(message, meta);
};

export default logger;