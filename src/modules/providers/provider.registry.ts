import { IStorageProviderAdapter } from '../../common/interfaces';
import { logger , ProviderError} from '../../common/utils';
import {
  FilecoinAdapter,
  StorjAdapter,
  GreenfieldAdapter,
  AkashAdapter,
} from './adapters';

// ============================================
// Provider Registry
// ============================================

/**
 * Provider Registry - Singleton that manages all storage provider adapters
 * 
 * This implements the adapter pattern, allowing easy addition of new
 * storage providers without changing existing code.
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private adapters: Map<string, IStorageProviderAdapter> = new Map();
  private initialized: boolean = false;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Initialize all registered adapters
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Provider registry already initialized');
      return;
    }

    logger.info('Initializing provider registry...');

    // Register all adapters
    this.registerAdapter(new FilecoinAdapter());
    // this.registerAdapter(new ArweaveAdapter());
    this.registerAdapter(new StorjAdapter());
    this.registerAdapter(new GreenfieldAdapter());
    this.registerAdapter(new AkashAdapter());

    // Initialize all adapters
    const initPromises = Array.from(this.adapters.values()).map(async adapter => {
      try {
        await adapter.initialize();
        logger.info(`✅ Initialized adapter: ${adapter.slug}`);
      } catch (error) {
        logger.error(`❌ Failed to initialize adapter: ${adapter.slug}`, error);
        // Don't throw - allow partial initialization
      }
    });

    await Promise.all(initPromises);

    this.initialized = true;
    logger.info(`Provider registry initialized with ${this.adapters.size} adapters`);
  }

  /**
   * Register a new adapter
   */
  registerAdapter(adapter: IStorageProviderAdapter): void {
    if (this.adapters.has(adapter.slug)) {
      logger.warn(`Adapter ${adapter.slug} already registered, replacing...`);
    }
    this.adapters.set(adapter.slug, adapter);
    logger.debug(`Registered adapter: ${adapter.slug}`);
  }

  /**
   * Unregister an adapter
   */
  unregisterAdapter(slug: string): boolean {
    return this.adapters.delete(slug);
  }

  /**
   * Get an adapter by slug
   */
  getAdapter(slug: string): IStorageProviderAdapter {
    const adapter = this.adapters.get(slug);
    if (!adapter) {
      throw new ProviderError(slug, `Provider adapter '${slug}' not found`);
    }
    return adapter;
  }

  /**
   * Get an adapter by slug, or undefined if not found
   */
  getAdapterOrUndefined(slug: string): IStorageProviderAdapter | undefined {
    return this.adapters.get(slug);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): IStorageProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all available adapters (those that are currently reachable)
   */
  async getAvailableAdapters(): Promise<IStorageProviderAdapter[]> {
    const availabilityChecks = Array.from(this.adapters.values()).map(async adapter => {
      const isAvailable = await adapter.isAvailable();
      return isAvailable ? adapter : null;
    });

    const results = await Promise.all(availabilityChecks);
    return results.filter((adapter): adapter is IStorageProviderAdapter => adapter !== null);
  }

  /**
   * Get adapter slugs
   */
  getAdapterSlugs(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if an adapter exists
   */
  hasAdapter(slug: string): boolean {
    return this.adapters.has(slug);
  }

  /**
   * Sync plans for all providers
   */
  async syncAllProviders(): Promise<Map<string, { success: boolean; error?: string }>> {
    const results = new Map<string, { success: boolean; error?: string }>();

    for (const [slug, adapter] of this.adapters) {
      try {
        logger.info(`Syncing provider: ${slug}`);
        const result = await adapter.syncPlans();
        results.set(slug, { 
          success: result.success,
          error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to sync provider: ${slug}`, error);
        results.set(slug, { success: false, error: errorMsg });
      }
    }

    return results;
  }

  /**
   * Reset the registry (mainly for testing)
   */
  reset(): void {
    this.adapters.clear();
    this.initialized = false;
  }
}

// Export singleton instance getter
export const getProviderRegistry = (): ProviderRegistry => {
  return ProviderRegistry.getInstance();
};

export default ProviderRegistry;