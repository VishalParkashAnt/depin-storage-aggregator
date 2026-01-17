import { Provider, StoragePlan, PlanStatus, ProviderStatus } from '@prisma/client';
import { prisma } from '../../common/database';
import { NotFoundError, centsToDollars } from '../../common/utils';
import { 
  IStoragePlanResponse, 
  ServiceResult, 
  successResult, 
  errorResult,
  IPaginationParams,
} from '../../common/interfaces';
import { getProviderRegistry } from './provider.registry';

// ============================================
// Provider Service
// ============================================

export class ProviderService {
  /**
   * Get all active providers
   */
  async getProviders(): Promise<Provider[]> {
    return prisma.provider.findMany({
      where: {
        status: ProviderStatus.ACTIVE,
        isEnabled: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get provider by slug
   */
  async getProviderBySlug(slug: string): Promise<Provider> {
    const provider = await prisma.provider.findUnique({
      where: { slug },
    });

    if (!provider) {
      throw new NotFoundError('Provider', slug);
    }

    return provider;
  }

  /**
   * Get all available storage plans
   */
  async getStoragePlans(
    filters?: {
      providerId?: string;
      providerSlug?: string;
      minStorageGb?: number;
      maxStorageGb?: number;
      minPriceCents?: number;
      maxPriceCents?: number;
    },
    pagination?: IPaginationParams
  ): Promise<{ plans: IStoragePlanResponse[]; total: number }> {
    const where: Record<string, unknown> = {
      status: PlanStatus.AVAILABLE,
      isActive: true,
      provider: {
        status: ProviderStatus.ACTIVE,
        isEnabled: true,
      },
    };

    if (filters?.providerId) {
      where.providerId = filters.providerId;
    }

    if (filters?.providerSlug) {
      where.provider = {
        ...where.provider as object,
        slug: filters.providerSlug,
      };
    }

    if (filters?.minStorageGb !== undefined || filters?.maxStorageGb !== undefined) {
      where.storageSizeGb = {};
      if (filters.minStorageGb !== undefined) {
        (where.storageSizeGb as Record<string, number>).gte = filters.minStorageGb;
      }
      if (filters.maxStorageGb !== undefined) {
        (where.storageSizeGb as Record<string, number>).lte = filters.maxStorageGb;
      }
    }

    if (filters?.minPriceCents !== undefined || filters?.maxPriceCents !== undefined) {
      where.priceUsdCents = {};
      if (filters.minPriceCents !== undefined) {
        (where.priceUsdCents as Record<string, number>).gte = filters.minPriceCents;
      }
      if (filters.maxPriceCents !== undefined) {
        (where.priceUsdCents as Record<string, number>).lte = filters.maxPriceCents;
      }
    }

    const [plans, total] = await Promise.all([
      prisma.storagePlan.findMany({
        where,
        include: { provider: true },
        orderBy: [
          { priceUsdCents: 'asc' },
          { storageSizeGb: 'asc' },
        ],
        skip: pagination ? (pagination.page - 1) * pagination.pageSize : undefined,
        take: pagination?.pageSize,
      }),
      prisma.storagePlan.count({ where }),
    ]);

    const formattedPlans: IStoragePlanResponse[] = plans.map(plan => ({
      id: plan.id,
      providerId: plan.providerId,
      providerName: plan.provider.name,
      providerSlug: plan.provider.slug,
      name: plan.name,
      description: plan.description,
      storageSizeGb: plan.storageSizeGb,
      storageSizeBytes: plan.storageSizeBytes.toString(),
      durationDays: plan.durationDays,
      priceUsdCents: plan.priceUsdCents,
      priceUsd: centsToDollars(plan.priceUsdCents),
      priceNative: plan.priceNative,
      nativeCurrency: plan.nativeCurrency,
      network: plan.provider.network,
      features: plan.features as string[],
      isAvailable: plan.status === PlanStatus.AVAILABLE && plan.isActive,
    }));

    return { plans: formattedPlans, total };
  }

  /**
   * Get a specific storage plan by ID
   */
  async getStoragePlanById(planId: string): Promise<IStoragePlanResponse> {
    const plan = await prisma.storagePlan.findUnique({
      where: { id: planId },
      include: { provider: true },
    });

    if (!plan) {
      throw new NotFoundError('Storage Plan', planId);
    }

    return {
      id: plan.id,
      providerId: plan.providerId,
      providerName: plan.provider.name,
      providerSlug: plan.provider.slug,
      name: plan.name,
      description: plan.description,
      storageSizeGb: plan.storageSizeGb,
      storageSizeBytes: plan.storageSizeBytes.toString(),
      durationDays: plan.durationDays,
      priceUsdCents: plan.priceUsdCents,
      priceUsd: centsToDollars(plan.priceUsdCents),
      priceNative: plan.priceNative,
      nativeCurrency: plan.nativeCurrency,
      network: plan.provider.network,
      features: plan.features as string[],
      isAvailable: plan.status === PlanStatus.AVAILABLE && plan.isActive,
    };
  }

  /**
   * Sync plans from all providers
   */
  async syncAllProviders(): Promise<ServiceResult<{ results: Record<string, { success: boolean; error?: string }> }>> {
    try {
      logger.info('Starting provider sync...');
      const registry = getProviderRegistry();
      const results = await registry.syncAllProviders();

      const resultsObj: Record<string, { success: boolean; error?: string }> = {};
      results.forEach((value, key) => {
        resultsObj[key] = value;
      });

      const successCount = Array.from(results.values()).filter(r => r.success).length;
      logger.info(`Provider sync completed: ${successCount}/${results.size} successful`);

      return successResult({ results: resultsObj });
    } catch (error) {
      logger.error('Provider sync failed', error);
      return errorResult(
        'SYNC_FAILED',
        error instanceof Error ? error.message : 'Provider sync failed'
      );
    }
  }

  /**
   * Sync plans from a specific provider
   */
  async syncProvider(slug: string): Promise<ServiceResult<{ success: boolean; error?: string }>> {
    try {
      const registry = getProviderRegistry();
      const adapter = registry.getAdapter(slug);
      
      const result = await adapter.syncPlans();
      
      if (result.success) {
        return successResult({ success: true });
      } else {
        return successResult({ success: false, error: result.errors.join('; ') });
      }
    } catch (error) {
      logger.error(`Failed to sync provider: ${slug}`, error);
      return errorResult(
        'SYNC_FAILED',
        error instanceof Error ? error.message : 'Provider sync failed'
      );
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(): Promise<{
    totalProviders: number;
    activeProviders: number;
    totalPlans: number;
    availablePlans: number;
  }> {
    const [totalProviders, activeProviders, totalPlans, availablePlans] = await Promise.all([
      prisma.provider.count(),
      prisma.provider.count({
        where: { status: ProviderStatus.ACTIVE, isEnabled: true },
      }),
      prisma.storagePlan.count(),
      prisma.storagePlan.count({
        where: { status: PlanStatus.AVAILABLE, isActive: true },
      }),
    ]);

    return {
      totalProviders,
      activeProviders,
      totalPlans,
      availablePlans,
    };
  }
}

export const providerService = new ProviderService();
export default providerService;