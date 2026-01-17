import { NetworkType, TransactionStatus } from '@prisma/client';

// ============================================
// Provider Adapter Interfaces
// ============================================

/**
 * Configuration for a storage provider
 */
export interface IProviderConfig {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  network: NetworkType;
  chainId?: string;
  rpcUrl?: string;
  explorerUrl?: string;
  config: Record<string, unknown>;
}

/**
 * Storage plan from a provider
 */
export interface IStoragePlan {
  externalPlanId: string;
  name: string;
  description?: string;
  storageSizeGb: number;
  storageSizeBytes: bigint;
  durationDays: number;
  priceUsdCents: number;
  priceNative?: string;
  nativeCurrency?: string;
  features: string[];
}

/**
 * Result of syncing plans from a provider
 */
export interface ISyncResult {
  success: boolean;
  plansAdded: number;
  plansUpdated: number;
  plansRemoved: number;
  errors: string[];
  timestamp: Date;
}

/**
 * Parameters for executing a storage transaction
 */
export interface IStorageTransactionParams {
  orderId: string;
  planId: string;
  storageSizeBytes: bigint;
  durationDays: number;
  userWalletAddress?: string;
}

/**
 * Result of a blockchain transaction
 */
export interface ITransactionResult {
  success: boolean;
  txHash?: string;
  status: TransactionStatus;
  network: NetworkType;
  chainId?: string;
  fromAddress?: string;
  toAddress?: string;
  gasLimit?: string;
  gasPrice?: string;
  gasUsed?: string;
  value?: string;
  data?: string;
  nonce?: number;
  blockNumber?: bigint;
  blockHash?: string;
  confirmations: number;
  storageId?: string;
  storageEndpoint?: string;
  storageMetadata?: Record<string, unknown>;
  error?: string;
  rawResponse?: Record<string, unknown>;
}

/**
 * Result of checking transaction status
 */
export interface ITransactionStatusResult {
  status: TransactionStatus;
  confirmations: number;
  blockNumber?: bigint;
  blockHash?: string;
  gasUsed?: string;
  error?: string;
}

/**
 * Abstract interface for storage provider adapters
 */
export interface IStorageProviderAdapter {
  /** Provider slug identifier */
  readonly slug: string;
  
  /** Provider configuration */
  readonly config: IProviderConfig;

  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>;

  /**
   * Check if the provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get available storage plans from the provider
   */
  getAvailablePlans(): Promise<IStoragePlan[]>;

  /**
   * Sync plans from the provider (update database)
   */
  syncPlans(): Promise<ISyncResult>;

  /**
   * Execute a storage purchase transaction
   */
  executeStorageTransaction(params: IStorageTransactionParams): Promise<ITransactionResult>;

  /**
   * Check the status of a transaction
   */
  checkTransactionStatus(txHash: string): Promise<ITransactionStatusResult>;

  /**
   * Get the explorer URL for a transaction
   */
  getTransactionExplorerUrl(txHash: string): string;

  /**
   * Estimate gas for a transaction (if applicable)
   */
  estimateGas?(params: IStorageTransactionParams): Promise<string>;
}

// ============================================
// API Response Interfaces
// ============================================

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface IPaginationParams {
  page: number;
  pageSize: number;
}

export interface IStoragePlanResponse {
  id: string;
  providerId: string;
  providerName: string;
  providerSlug: string;
  name: string;
  description: string | null;
  storageSizeGb: number;
  storageSizeBytes: string;
  durationDays: number;
  priceUsdCents: number;
  priceUsd: string;
  priceNative: string | null;
  nativeCurrency: string | null;
  network: NetworkType;
  features: string[];
  isAvailable: boolean;
}

export interface IOrderResponse {
  id: string;
  orderNumber: string;
  userId: string;
  provider: {
    id: string;
    name: string;
    slug: string;
  };
  plan: {
    id: string;
    name: string;
    storageSizeGb: number;
    durationDays: number;
  };
  storageSizeGb: number;
  durationDays: number;
  priceUsdCents: number;
  priceUsd: string;
  status: string;
  statusMessage: string | null;
  storage: {
    id: string | null;
    endpoint: string | null;
    metadata: Record<string, unknown> | null;
  };
  payment: {
    status: string;
    processedAt: Date | null;
  } | null;
  blockchain: {
    txHash: string | null;
    status: string;
    network: NetworkType;
    confirmations: number;
    explorerUrl: string | null;
  } | null;
  paidAt: Date | null;
  allocatedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Stripe Interfaces
// ============================================

export interface ICreateCheckoutParams {
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
}

export interface ICheckoutResult {
  sessionId: string;
  sessionUrl: string;
  orderId: string;
  paymentId: string;
}

export interface IWebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ============================================
// Service Result Types
// ============================================

export type ServiceResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function successResult<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function errorResult<T>(code: string, message: string, details?: unknown): ServiceResult<T> {
  return { success: false, error: { code, message, details } };
}