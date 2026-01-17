import { Router, Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service';
import { IApiResponse } from '../../common/interfaces';
import { ValidationError } from '../../common/utils/errors';
import { logger } from '../../common/utils/logger';
import { config } from '../../config';

// ============================================
// Payment Controller
// ============================================

const router = Router();

/**
 * POST /api/payments/checkout
 * Create a Stripe checkout session
 */
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, planId, idempotencyKey } = req.body;

    // Validation
    if (!userId) {
      throw new ValidationError('userId is required');
    }
    if (!planId) {
      throw new ValidationError('planId is required');
    }

    const baseUrl = config.app.frontendUrl;
    const successUrl = `${baseUrl}/orders/success`;
    const cancelUrl = `${baseUrl}/orders/cancel`;

    const result = await paymentService.createCheckoutSession({
      userId,
      planId,
      successUrl,
      cancelUrl,
      idempotencyKey,
    });

    if (result.success) {
      const response: IApiResponse = {
        success: true,
        data: {
          sessionId: result.data.sessionId,
          sessionUrl: result.data.sessionUrl,
          orderId: result.data.orderId,
        },
      };
      res.json(response);
    } else {
      const response: IApiResponse = {
        success: false,
        error: result.error,
      };
      res.status(400).json(response);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events
 * Note: This endpoint needs raw body for signature verification
 */
router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        throw new ValidationError('Missing stripe-signature header');
      }

      // The body should be raw for webhook verification
      const payload = req.body;

      const result = await paymentService.handleWebhook(payload, signature);

      if (result.success) {
        res.json({ received: true, eventType: result.data.eventType });
      } else {
        logger.error('Webhook handling failed', { error: result.error });
        res.status(400).json({ error: result.error?.message });
      }
    } catch (error) {
      logger.error('Webhook error', error);
      // Return 200 to prevent Stripe from retrying
      res.status(200).json({ received: true, error: 'Processing failed' });
    }
  }
);

/**
 * GET /api/payments/:paymentId
 * Get payment details
 */
router.get('/:paymentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const payment = await paymentService.getPaymentById(paymentId);

    if (!payment) {
      const response: IApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Payment not found',
        },
      };
      return res.status(404).json(response);
    }

    const response: IApiResponse = {
      success: true,
      data: {
        id: payment.id,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: payment.status,
        processedAt: payment.processedAt,
        createdAt: payment.createdAt,
        order: {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          provider: payment.order.provider.name,
          plan: payment.order.plan.name,
          status: payment.order.status,
        },
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/user/:userId
 * Get all payments for a user
 */
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const payments = await paymentService.getPaymentsForUser(userId);

    const response: IApiResponse = {
      success: true,
      data: payments.map(payment => ({
        id: payment.id,
        orderId: payment.orderId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: payment.status,
        processedAt: payment.processedAt,
        createdAt: payment.createdAt,
        order: {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          provider: payment.order.provider.name,
          plan: payment.order.plan.name,
        },
      })),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/config
 * Get Stripe publishable key for frontend
 */
router.get('/config/stripe', async (req: Request, res: Response) => {
  const response: IApiResponse = {
    success: true,
    data: {
      publishableKey: config.stripe.publishableKey,
    },
  };
  res.json(response);
});

export const paymentController = router;
export default paymentController;