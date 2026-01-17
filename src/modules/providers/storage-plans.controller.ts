import { Router, Request, Response, NextFunction } from 'express';
import { providerService } from './provider.service';
import { IApiResponse, IPaginationParams } from '../../common/interfaces';
import { ValidationError } from '../../common/utils/errors';

// ============================================
// Storage Plans Controller
// ============================================

const router = Router();

/**
 * GET /api/storage/plans
 * Get all available storage plans with filtering and pagination
 */
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse query parameters
    const {
      provider,
      providerId,
      minStorage,
      maxStorage,
      minPrice,
      maxPrice,
      page = '1',
      pageSize = '20',
    } = req.query;

    // Validate pagination
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new ValidationError('Invalid page number');
    }
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      throw new ValidationError('Invalid page size (must be between 1 and 100)');
    }

    const pagination: IPaginationParams = {
      page: pageNum,
      pageSize: pageSizeNum,
    };

    // Build filters
    const filters: {
      providerId?: string;
      providerSlug?: string;
      minStorageGb?: number;
      maxStorageGb?: number;
      minPriceCents?: number;
      maxPriceCents?: number;
    } = {};

    if (provider) {
      filters.providerSlug = provider as string;
    }
    if (providerId) {
      filters.providerId = providerId as string;
    }
    if (minStorage) {
      const min = parseFloat(minStorage as string);
      if (!isNaN(min)) filters.minStorageGb = min;
    }
    if (maxStorage) {
      const max = parseFloat(maxStorage as string);
      if (!isNaN(max)) filters.maxStorageGb = max;
    }
    if (minPrice) {
      const min = parseInt(minPrice as string, 10);
      if (!isNaN(min)) filters.minPriceCents = min;
    }
    if (maxPrice) {
      const max = parseInt(maxPrice as string, 10);
      if (!isNaN(max)) filters.maxPriceCents = max;
    }

    const { plans, total } = await providerService.getStoragePlans(filters, pagination);

    const response: IApiResponse = {
      success: true,
      data: plans,
      meta: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/storage/plans/:planId
 * Get a specific storage plan by ID
 */
router.get('/plans/:planId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.params;
    const plan = await providerService.getStoragePlanById(planId);

    const response: IApiResponse = {
      success: true,
      data: plan,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export const storagePlansController = router;
export default storagePlansController;