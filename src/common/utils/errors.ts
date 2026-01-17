// ============================================
// Custom Error Classes
// ============================================

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super('NOT_FOUND', message, 404, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409, true);
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PAYMENT_ERROR', message, 402, true, details);
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, details?: unknown) {
    super('BLOCKCHAIN_ERROR', message, 500, true, details);
  }
}

export class ProviderError extends AppError {
  constructor(providerSlug: string, message: string, details?: unknown) {
    super('PROVIDER_ERROR', `[${providerSlug}] ${message}`, 500, true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super('RATE_LIMIT_EXCEEDED', message, 429, true);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super('EXTERNAL_SERVICE_ERROR', `[${service}] ${message}`, 502, true, details);
  }
}

// Error code constants
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PLAN_UNAVAILABLE: 'PLAN_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];