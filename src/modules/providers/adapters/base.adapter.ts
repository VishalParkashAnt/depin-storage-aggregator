import { NetworkType, TransactionStatus } from '@prisma/client';
import {
  IStorageProviderAdapter,
  IProviderConfig,
  IStoragePlan,
  ISyncResult,
  IStorageTransactionParams,
  ITransactionResult,
  ITransactionStatusResult,
} from '../../../common/interfaces';
import { prisma } from '../../../common/database';
import { logger,ProviderError } from '../../../common/utils';

// ============================================
// Base Storage Provider Adapter
// ============================================

export abstract class BaseStorageProviderAdapter implements IStorageProviderAdapter {
  public abstract readonly slug: string;
  public abstract readonly config: IProviderConfig;

  protected initialized: boolean = false;

  /**
   * Initialize the adapter - to be implemented by subclasses
   */
  abstract initialize(): Promise<void>;

  /**
   * Check if the provider is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get available storage plans from the provider
   */
  abstract getAvailablePlans(): Promise<IStoragePlan[]>;

  /**
   * Execute a storage purchase transaction
   */
  abstract executeStorageTransaction(params: IStorageTransactionParams): Promise<ITransactionResult>;

  /**
   * Check the status of a transaction
   */
  abstract checkTransactionStatus(txHash: string): Promise<ITransactionStatusResult>;

  /**
   * Get the explorer URL for a transaction
   */
  abstract getTransactionExplorerUrl(txHash: string): string;

  /**
   * Sync plans from the provider to the database
   */
  async syncPlans(): Promise<ISyncResult> {
    const startTime = Date.now();
    const result: ISyncResult = {
      success: false,
      plansAdded: 0,
      plansUpdated: 0,
      plansRemoved: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      logger.info(`[${this.slug}] Starting plan sync`);

      // Ensure provider exists in database
      const provider = await this.ensureProviderExists();

      // Get plans from provider
      const remotePlans = await this.getAvailablePlans();
      logger.info(`[${this.slug}] Fetched ${remotePlans.length} plans from provider`);

      // Get existing plans from database
      const existingPlans = await prisma.storagePlan.findMany({
        where: { providerId: provider.id },
      });

      const existingPlanMap = new Map(
        existingPlans.map(p => [p.externalPlanId, p])
      );

      // Process remote plans
      for (const remotePlan of remotePlans) {
        try {
          const existingPlan = existingPlanMap.get(remotePlan.externalPlanId);

          if (existingPlan) {
            // Update existing plan
            await prisma.storagePlan.update({
              where: { id: existingPlan.id },
              data: {
                name: remotePlan.name,
                description: remotePlan.description,
                storageSizeGb: remotePlan.storageSizeGb,
                storageSizeBytes: remotePlan.storageSizeBytes,
                durationDays: remotePlan.durationDays,
                priceUsdCents: remotePlan.priceUsdCents,
                priceNative: remotePlan.priceNative,
                nativeCurrency: remotePlan.nativeCurrency,
                features: remotePlan.features,
                status: 'AVAILABLE',
                isActive: true,
                version: { increment: 1 },
              },
            });
            result.plansUpdated++;
            existingPlanMap.delete(remotePlan.externalPlanId);
          } else {
            // Create new plan
            await prisma.storagePlan.create({
              data: {
                providerId: provider.id,
                externalPlanId: remotePlan.externalPlanId,
                name: remotePlan.name,
                description: remotePlan.description,
                storageSizeGb: remotePlan.storageSizeGb,
                storageSizeBytes: remotePlan.storageSizeBytes,
                durationDays: remotePlan.durationDays,
                priceUsdCents: remotePlan.priceUsdCents,
                priceNative: remotePlan.priceNative,
                nativeCurrency: remotePlan.nativeCurrency,
                features: remotePlan.features,
              },
            });
            result.plansAdded++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to sync plan ${remotePlan.externalPlanId}: ${errorMsg}`);
          logger.error(`[${this.slug}] Failed to sync plan`, error, {
            planId: remotePlan.externalPlanId,
          });
        }
      }

      // Mark removed plans as unavailable
      for (const [planId, plan] of existingPlanMap) {
        try {
          await prisma.storagePlan.update({
            where: { id: plan.id },
            data: {
              status: 'UNAVAILABLE',
              isActive: false,
            },
          });
          result.plansRemoved++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to mark plan ${planId} as unavailable: ${errorMsg}`);
        }
      }

      // Update provider last synced timestamp
      await prisma.provider.update({
        where: { id: provider.id },
        data: { lastSyncedAt: new Date() },
      });

      // Log sync result
      await this.logSyncResult(provider.id, result);

      result.success = true;
      const duration = Date.now() - startTime;
      logger.info(`[${this.slug}] Plan sync completed`, {
        added: result.plansAdded,
        updated: result.plansUpdated,
        removed: result.plansRemoved,
        errors: result.errors.length,
        durationMs: duration,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sync failed: ${errorMsg}`);
      logger.error(`[${this.slug}] Plan sync failed`, error);
    }

    return result;
  }

  /**
   * Ensure the provider exists in the database
   */
  protected async ensureProviderExists() {
    let provider = await prisma.provider.findUnique({
      where: { slug: this.slug },
    });

    if (!provider) {
      provider = await prisma.provider.create({
        data: {
          name: this.config.name,
          slug: this.config.slug,
          description: this.config.description,
          website: this.config.website,
          logoUrl: this.config.logoUrl,
          network: this.config.network,
          chainId: this.config.chainId,
          rpcUrl: this.config.rpcUrl,
          explorerUrl: this.config.explorerUrl,
          config: this.config.config,
        },
      });
      logger.info(`[${this.slug}] Created provider in database`, { providerId: provider.id });
    }

    return provider;
  }

  /**
   * Log sync result to database
   */
  protected async logSyncResult(providerId: string, result: ISyncResult): Promise<void> {
    await prisma.providerSyncLog.create({
      data: {
        providerId,
        syncType: 'PLANS',
        status: result.success ? 'SUCCESS' : 'FAILED',
        message: result.errors.length > 0 ? result.errors.join('; ') : null,
        metadata: {
          plansAdded: result.plansAdded,
          plansUpdated: result.plansUpdated,
          plansRemoved: result.plansRemoved,
        },
        startedAt: result.timestamp,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Create a failed transaction result
   */
  protected createFailedTransaction(error: string): ITransactionResult {
    return {
      success: false,
      status: TransactionStatus.FAILED,
      network: this.config.network,
      chainId: this.config.chainId,
      confirmations: 0,
      error,
    };
  }

  /**
   * Create a pending transaction result
   */
  protected createPendingTransaction(txHash: string, additionalData?: Partial<ITransactionResult>): ITransactionResult {
    return {
      success: true,
      txHash,
      status: TransactionStatus.SUBMITTED,
      network: this.config.network,
      chainId: this.config.chainId,
      confirmations: 0,
      ...additionalData,
    };
  }

  /**
   * Validate that the adapter is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new ProviderError(this.slug, 'Provider adapter not initialized');
    }
  }
}