import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/utils/errors';
import { logger } from '../common/utils/logger';
import { IApiResponse } from '../common/interfaces';
import { config } from '../config';

// ============================================
// Error Handling Middleware
// ============================================

/**
 * Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const response: IApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  };
  res.status(404).json(response);
}

/**
 * Global Error Handler
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Log the error
  logger.error('Request error', err, {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
  });

  // Handle known errors
  if (err instanceof AppError) {
    const response: IApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: config.app.isDevelopment ? err.details : undefined,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as { code: string; meta?: { target?: string[] } };
    
    if (prismaError.code === 'P2002') {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with this value already exists',
          details: config.app.isDevelopment ? prismaError.meta : undefined,
        },
      };
      res.status(409).json(response);
      return;
    }

    if (prismaError.code === 'P2025') {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Record not found',
        },
      };
      res.status(404).json(response);
      return;
    }
  }

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError') {
    const response: IApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle unknown errors
  const response: IApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.app.isProduction 
        ? 'An unexpected error occurred' 
        : err.message,
      details: config.app.isDevelopment ? err.stack : undefined,
    },
  };
  res.status(500).json(response);
}

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}