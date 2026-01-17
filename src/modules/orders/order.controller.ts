import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from './order.service';
import { IApiResponse, IPaginationParams } from '../../common/interfaces';
import { ValidationError } from '../../common/utils/errors';
import { OrderStatus } from '@prisma/client';

// ============================================
// Order Controller
// ============================================

const router = Router();

/**
 * GET /api/orders
 * Get all orders (with optional filters)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      userId,
      status,
      providerId,
      startDate,
      endDate,
      page = '1',
      pageSize = '20',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new ValidationError('Invalid page number');
    }
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      throw new ValidationError('Invalid page size');
    }

    const pagination: IPaginationParams = { page: pageNum, pageSize: pageSizeNum };

    let result;

    if (userId) {
      // Get orders for specific user
      result = await orderService.getOrdersForUser(
        userId as string,
        status ? { status: status as OrderStatus } : undefined,
        pagination
      );
    } else {
      // Get all orders (admin view)
      result = await orderService.getAllOrders(
        {
          status: status as OrderStatus | undefined,
          providerId: providerId as string | undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
        },
        pagination
      );
    }

    const response: IApiResponse = {
      success: true,
      data: result.orders,
      meta: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSizeNum),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/stats
 * Get order statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await orderService.getOrderStats();

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
 * GET /api/orders/:orderId
 * Get order by ID
 */
router.get('/:orderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderById(orderId);

    const response: IApiResponse = {
      success: true,
      data: order,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/number/:orderNumber
 * Get order by order number
 */
router.get('/number/:orderNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;
    const order = await orderService.getOrderByNumber(orderNumber);

    const response: IApiResponse = {
      success: true,
      data: order,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders/:orderId/cancel
 * Cancel an order
 */
router.post('/:orderId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const order = await orderService.cancelOrder(orderId);

    const response: IApiResponse = {
      success: true,
      data: order,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export const orderController = router;
export default orderController;