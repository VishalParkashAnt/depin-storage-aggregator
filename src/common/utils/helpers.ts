import { v4 as uuidv4 } from 'uuid';

// ============================================
// ID Generation
// ============================================

export function generateId(): string {
  return uuidv4();
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

export function generateIdempotencyKey(): string {
  return `idem_${uuidv4().replace(/-/g, '')}`;
}

// ============================================
// Storage Size Conversions
// ============================================

export function gbToBytes(gb: number): bigint {
  return BigInt(Math.floor(gb * 1024 * 1024 * 1024));
}

export function bytesToGb(bytes: bigint): number {
  return Number(bytes) / (1024 * 1024 * 1024);
}

export function formatStorageSize(bytes: bigint): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = Number(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// ============================================
// Price Formatting
// ============================================

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatPrice(cents: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  return formatter.format(cents / 100);
}

// ============================================
// Date Utilities
// ============================================

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isExpired(date: Date | null): boolean {
  if (!date) return false;
  return new Date() > date;
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

// ============================================
// Async Utilities
// ============================================

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      await sleep(delay * Math.pow(backoff, attempt - 1));
    }
  }

  throw lastError;
}

// ============================================
// Validation Utilities
// ============================================

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ============================================
// Object Utilities
// ============================================

export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce((acc, key) => {
    if (key in obj) {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Pick<T, K>);
}

// ============================================
// Safe JSON Parsing
// ============================================

export function safeJsonParse<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

export function safeJsonStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return '{}';
  }
}