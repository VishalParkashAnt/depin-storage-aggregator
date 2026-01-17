import { Router, Request, Response, NextFunction } from 'express';
import { providerService } from './provider.service';
import { logger } from '../../common/utils/logger';
import { IApiResponse } from '../../common/interfaces';

// ============================================
// Provider Controller
// ============================================

const router = Router();

/**
 * GET /api/providers
 * Get all active storage providers
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = await providerService.getProviders();
    
    const response: IApiResponse = {
      success: true,
      data: providers.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        website: p.website,
        logoUrl: p.logoUrl,
        network: p.network,
        status: p.status,
        lastSyncedAt: p.lastSyncedAt,
      })),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/providers/:slug
 * Get a specific provider by slug
 */
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const provider = await providerService.getProviderBySlug(slug);
    
    const response: IApiResponse = {
      success: true,
      data: {
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
        description: provider.description,
        website: provider.website,
        logoUrl: provider.logoUrl,
        network: provider.network,
        chainId: provider.chainId,
        explorerUrl: provider.explorerUrl,
        status: provider.status,
        lastSyncedAt: provider.lastSyncedAt,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/providers/stats
 * Get provider statistics
 */
router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await providerService.getProviderStats();
    
    const response: IApiResponse = {
      success: true,
      data: stats,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/providers/sync
 * Trigger sync for all providers
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await providerService.syncAllProviders();
    
    if (result.success) {
      const response: IApiResponse = {
        success: true,
        data: result.data,
      };
      res.json(response);
    } else {
      const response: IApiResponse = {
        success: false,
        error: result.error,
      };
      res.status(500).json(response);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/providers/:slug/sync
 * Trigger sync for a specific provider
 */
router.post('/:slug/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const result = await providerService.syncProvider(slug);
    
    if (result.success) {
      const response: IApiResponse = {
        success: true,
        data: result.data,
      };
      res.json(response);
    } else {
      const response: IApiResponse = {
        success: false,
        error: result.error,
      };
      res.status(500).json(response);
    }
  } catch (error) {
    next(error);
  }
});

export const providerController = router;
export default providerController;