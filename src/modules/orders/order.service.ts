import { OrderStatus } from '@prisma/client';
import { prisma } from '../../common/database';
import { IOrderResponse, IPaginationParams } from '../../common/interfaces';
import { centsToDollars,NotFoundError } from '../../common/utils';
import { getProviderRegistry } from '../providers/provider.registry';

// ============================================
// Order Service
// ============================================

export class OrderService {
  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<IOrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        provider: true,
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    return this.formatOrderResponse(order);
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string): Promise<IOrderResponse> {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        user: true,
        provider: true,
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order', orderNumber);
    }

    return this.formatOrderResponse(order);
  }

  /**
   * Get orders for a user
   */
  async getOrdersForUser(
    userId: string,
    filters?: { status?: OrderStatus },
    pagination?: IPaginationParams
  ): Promise<{ orders: IOrderResponse[]; total: number }> {
    const where: Record<string, unknown> = { userId };

    if (filters?.status) {
      where.status = filters.status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: true,
          provider: true,
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination ? (pagination.page - 1) * pagination.pageSize : undefined,
        take: pagination?.pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(order => this.formatOrderResponse(order)),
      total,
    };
  }

  /**
   * Get all orders (admin)
   */
  async getAllOrders(
    filters?: {
      status?: OrderStatus;
      providerId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: IPaginationParams
  ): Promise<{ orders: IOrderResponse[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.providerId) {
      where.providerId = filters.providerId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: true,
          provider: true,
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination ? (pagination.page - 1) * pagination.pageSize : undefined,
        take: pagination?.pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(order => this.formatOrderResponse(order)),
      total,
    };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<IOrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    // Can only cancel pending orders
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        statusMessage: 'Cancelled by user',
      },
      include: {
        user: true,
        provider: true,
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return this.formatOrderResponse(updatedOrder);
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    failedOrders: number;
    totalRevenueCents: number;
  }> {
    const [totalOrders, completedOrders, pendingOrders, failedOrders, revenueResult] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      prisma.order.count({
        where: {
          status: {
            in: [
              OrderStatus.PENDING_PAYMENT,
              OrderStatus.PAYMENT_PROCESSING,
              OrderStatus.BLOCKCHAIN_PENDING,
              OrderStatus.BLOCKCHAIN_PROCESSING,
            ],
          },
        },
      }),
      prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.PAYMENT_FAILED, OrderStatus.BLOCKCHAIN_FAILED],
          },
        },
      }),
      prisma.order.aggregate({
        where: { status: OrderStatus.COMPLETED },
        _sum: { priceUsdCents: true },
      }),
    ]);

    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      failedOrders,
      totalRevenueCents: revenueResult._sum.priceUsdCents || 0,
    };
  }

  /**
   * Format order for API response
   */
  private formatOrderResponse(order: {
    id: string;
    orderNumber: string;
    userId: string;
    provider: { id: string; name: string; slug: string };
    plan: { id: string; name: string; storageSizeGb: number; durationDays: number };
    storageSizeGb: number;
    durationDays: number;
    priceUsdCents: number;
    status: OrderStatus;
    statusMessage: string | null;
    storageId: string | null;
    storageEndpoint: string | null;
    storageMetadata: unknown;
    paidAt: Date | null;
    allocatedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    payments: { status: string; processedAt: Date | null }[];
    transactions: {
      txHash: string | null;
      status: string;
      network: string;
      confirmations: number;
    }[];
  }): IOrderResponse {
    const payment = order.payments[0] || null;
    const transaction = order.transactions[0] || null;

    // Get explorer URL if transaction exists
    let explorerUrl: string | null = null;
    if (transaction?.txHash) {
      try {
        const registry = getProviderRegistry();
        const adapter = registry.getAdapterOrUndefined(order.provider.slug);
        if (adapter) {
          explorerUrl = adapter.getTransactionExplorerUrl(transaction.txHash);
        }
      } catch {
        // Ignore errors getting explorer URL
      }
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      provider: {
        id: order.provider.id,
        name: order.provider.name,
        slug: order.provider.slug,
      },
      plan: {
        id: order.plan.id,
        name: order.plan.name,
        storageSizeGb: order.plan.storageSizeGb,
        durationDays: order.plan.durationDays,
      },
      storageSizeGb: order.storageSizeGb,
      durationDays: order.durationDays,
      priceUsdCents: order.priceUsdCents,
      priceUsd: centsToDollars(order.priceUsdCents),
      status: order.status,
      statusMessage: order.statusMessage,
      storage: {
        id: order.storageId,
        endpoint: order.storageEndpoint,
        metadata: order.storageMetadata as Record<string, unknown> | null,
      },
      payment: payment
        ? {
            status: payment.status,
            processedAt: payment.processedAt,
          }
        : null,
      blockchain: transaction
        ? {
            txHash: transaction.txHash,
            status: transaction.status,
            network: transaction.network as 'TESTNET' | 'MAINNET',
            confirmations: transaction.confirmations,
            explorerUrl,
          }
        : null,
      paidAt: order.paidAt,
      allocatedAt: order.allocatedAt,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export const orderService = new OrderService();
export default orderService;