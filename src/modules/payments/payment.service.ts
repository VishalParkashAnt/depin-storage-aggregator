import Stripe from 'stripe';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { prisma, withTransaction } from '../../common/database';
import { config } from '../../config';
import { logger,PaymentError,
  ValidationError,
  NotFoundError,
  ConflictError,  generateOrderNumber,
  generateIdempotencyKey,
  addDays,
  centsToDollars, } from '../../common/utils';
import {
  ICreateCheckoutParams,
  ICheckoutResult,
  ServiceResult,
  successResult,
  errorResult,
} from '../../common/interfaces';


// ============================================
// Payment Service
// ============================================

export class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2024-11-20.acacia',
    });
  }

  /**
   * Create a Stripe checkout session for purchasing storage
   */
  async createCheckoutSession(params: ICreateCheckoutParams): Promise<ServiceResult<ICheckoutResult>> {
    const { userId, planId, successUrl, cancelUrl, idempotencyKey } = params;

    try {
      // Check idempotency
      if (idempotencyKey) {
        const existingOrder = await prisma.order.findUnique({
          where: { idempotencyKey },
          include: { payments: true },
        });

        if (existingOrder) {
          const payment = existingOrder.payments[0];
          if (payment?.stripeSessionId) {
            // Return existing session
            const session = await this.stripe.checkout.sessions.retrieve(payment.stripeSessionId);
            return successResult({
              sessionId: session.id,
              sessionUrl: session.url || '',
              orderId: existingOrder.id,
              paymentId: payment.id,
            });
          }
        }
      }

      // Get the storage plan
      const plan = await prisma.storagePlan.findUnique({
        where: { id: planId },
        include: { provider: true },
      });

      if (!plan) {
        return errorResult('PLAN_NOT_FOUND', 'Storage plan not found');
      }

      if (plan.status !== 'AVAILABLE' || !plan.isActive) {
        return errorResult('PLAN_UNAVAILABLE', 'This storage plan is no longer available');
      }

      // Get or create user
      let user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return errorResult('USER_NOT_FOUND', 'User not found');
      }

      // Create or get Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: {
            userId: user.id,
          },
        });
        stripeCustomerId = customer.id;

        // Update user with Stripe customer ID
        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId },
        });
      }

      // Create order and payment in a transaction
      const result = await withTransaction(async (tx) => {
        // Create order
        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: user!.id,
            providerId: plan.provider.id,
            planId: plan.id,
            storageSizeGb: plan.storageSizeGb,
            durationDays: plan.durationDays,
            priceUsdCents: plan.priceUsdCents,
            status: OrderStatus.PENDING_PAYMENT,
            idempotencyKey: idempotencyKey || generateIdempotencyKey(),
          },
        });

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            userId: user!.id,
            amountCents: plan.priceUsdCents,
            currency: 'usd',
            status: PaymentStatus.PENDING,
            idempotencyKey: generateIdempotencyKey(),
          },
        });

        return { order, payment };
      });

      // Create Stripe checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${plan.provider.name} - ${plan.name}`,
                description: `${plan.storageSizeGb}GB storage for ${plan.durationDays} days`,
                metadata: {
                  planId: plan.id,
                  providerId: plan.provider.id,
                  providerSlug: plan.provider.slug,
                },
              },
              unit_amount: plan.priceUsdCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${successUrl}?order_id=${result.order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cancelUrl}?order_id=${result.order.id}`,
        metadata: {
          orderId: result.order.id,
          paymentId: result.payment.id,
          userId: user.id,
          planId: plan.id,
          providerId: plan.provider.id,
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      });

      // Update payment with session ID
      await prisma.payment.update({
        where: { id: result.payment.id },
        data: { stripeSessionId: session.id },
      });

      logger.info('Checkout session created', {
        sessionId: session.id,
        orderId: result.order.id,
        userId: user.id,
        planId: plan.id,
      });

      return successResult({
        sessionId: session.id,
        sessionUrl: session.url || '',
        orderId: result.order.id,
        paymentId: result.payment.id,
      });
    } catch (error) {
      logger.error('Failed to create checkout session', error);
      
      if (error instanceof Stripe.errors.StripeError) {
        return errorResult('STRIPE_ERROR', error.message);
      }
      
      return errorResult(
        'CHECKOUT_FAILED',
        error instanceof Error ? error.message : 'Failed to create checkout session'
      );
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: string | Buffer, signature: string): Promise<ServiceResult<{ handled: boolean; eventType: string }>> {
    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      logger.info('Received Stripe webhook', { type: event.type, id: event.id });

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.expired':
          await this.handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          logger.debug('Unhandled webhook event', { type: event.type });
      }

      return successResult({ handled: true, eventType: event.type });
    } catch (error) {
      logger.error('Webhook handling failed', error);
      
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        return errorResult('INVALID_SIGNATURE', 'Invalid webhook signature');
      }
      
      return errorResult(
        'WEBHOOK_FAILED',
        error instanceof Error ? error.message : 'Webhook handling failed'
      );
    }
  }

  /**
   * Handle checkout.session.completed event
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    const paymentId = session.metadata?.paymentId;

    if (!orderId || !paymentId) {
      logger.error('Missing metadata in checkout session', { sessionId: session.id });
      return;
    }

    // Check if already processed (idempotency)
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (existingPayment?.status === PaymentStatus.SUCCEEDED) {
      logger.info('Payment already processed', { paymentId, orderId });
      return;
    }

    await withTransaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCEEDED,
          stripePaymentIntentId: session.payment_intent as string,
          processedAt: new Date(),
          metadata: {
            sessionId: session.id,
            customerId: session.customer,
            amountTotal: session.amount_total,
          },
        },
      });

      // Update order
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAYMENT_COMPLETED,
          paidAt: new Date(),
        },
      });
    });

    logger.info('Payment completed', { orderId, paymentId, sessionId: session.id });

    // Trigger blockchain transaction (async)
    // This will be handled by the blockchain service
    this.triggerBlockchainTransaction(orderId).catch(error => {
      logger.error('Failed to trigger blockchain transaction', error, { orderId });
    });
  }

  /**
   * Handle checkout.session.expired event
   */
  private async handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    const paymentId = session.metadata?.paymentId;

    if (!orderId || !paymentId) {
      return;
    }

    await withTransaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.CANCELLED,
          statusMessage: 'Checkout session expired',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          statusMessage: 'Payment session expired',
        },
      });
    });

    logger.info('Checkout session expired', { orderId, paymentId });
  }

  /**
   * Handle payment_intent.succeeded event
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment && payment.status !== PaymentStatus.SUCCEEDED) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          processedAt: new Date(),
        },
      });
    }
  }

  /**
   * Handle payment_intent.payment_failed event
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      include: { order: true },
    });

    if (payment) {
      await withTransaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            statusMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
          },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: OrderStatus.PAYMENT_FAILED,
            statusMessage: 'Payment failed',
          },
        });
      });

      logger.info('Payment failed', {
        paymentId: payment.id,
        orderId: payment.orderId,
        error: paymentIntent.last_payment_error?.message,
      });
    }
  }

  /**
   * Trigger blockchain transaction for an order
   * This is a placeholder - actual implementation in blockchain service
   */
  private async triggerBlockchainTransaction(orderId: string): Promise<void> {
    // Import dynamically to avoid circular dependencies
    const { blockchainService } = await import('../blockchain/blockchain.service');
    await blockchainService.processOrder(orderId);
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            provider: true,
            plan: true,
          },
        },
      },
    });
  }

  /**
   * Get payments for a user
   */
  async getPaymentsForUser(userId: string) {
    return prisma.payment.findMany({
      where: { userId },
      include: {
        order: {
          include: {
            provider: true,
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const paymentService = new PaymentService();
export default paymentService;