import { Router, Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { IApiResponse } from '../../common/interfaces';
import { ValidationError } from '../../common/utils/errors';

// ============================================
// User Controller
// ============================================

const router = Router();

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, walletAddress } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const user = await userService.createUser({ email, name, walletAddress });

    const response: IApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users
 * Get all users
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', pageSize = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);

    const { users, total } = await userService.getAllUsers({
      page: pageNum,
      pageSize: pageSizeNum,
    });

    const response: IApiResponse = {
      success: true,
      data: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
      })),
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
 * GET /api/users/:userId
 * Get user by ID
 */
router.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);

    const response: IApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/:userId
 * Update user
 */
router.put('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { name, walletAddress } = req.body;

    const user = await userService.updateUser(userId, { name, walletAddress });

    const response: IApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        updatedAt: user.updatedAt,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:userId/orders
 * Get user with their orders
 */
router.get('/:userId/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUserWithOrders(userId);

    const response: IApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        orders: user.orders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          provider: order.provider.name,
          plan: order.plan.name,
          storageSizeGb: order.storageSizeGb,
          priceUsdCents: order.priceUsdCents,
          status: order.status,
          createdAt: order.createdAt,
        })),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users/login
 * Simple login - get or create user by email
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const user = await userService.getOrCreateUser({ email, name });

    const response: IApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export const userController = router;
export default userController;