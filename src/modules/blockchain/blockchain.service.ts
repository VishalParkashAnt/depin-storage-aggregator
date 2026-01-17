import { OrderStatus, TransactionStatus } from '@prisma/client';
import { prisma, withTransaction } from '../../common/database';
import { logger } from '../../common/utils/logger';
import { getProviderRegistry } from '../providers/provider.registry';
import { IStorageTransactionParams, ServiceResult, successResult, errorResult } from '../../common/interfaces';
import { addDays } from '../../common/utils/helpers';

// ============================================
// Blockchain Service
// ============================================

export class BlockchainService {
  /**
   * Process an order by executing the blockchain transaction
   */
  async processOrder(orderId: string): Promise<ServiceResult<{ txId: string }>> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          provider: true,
          plan: true,
          user: true,
          transactions: true,
        },
      });

      if (!order) {
        return errorResult('ORDER_NOT_FOUND', 'Order not found');
      }

      if (order.status !== OrderStatus.PAYMENT_COMPLETED) {
        return errorResult('INVALID_ORDER_STATUS', `Order status is ${order.status}, expected PAYMENT_COMPLETED`);
      }

      const existingTx = order.transactions.find(tx => tx.status !== TransactionStatus.FAILED);
      if (existingTx) {
        logger.info('Transaction already exists for order', { orderId, txId: existingTx.id });
        return successResult({ txId: existingTx.id });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.BLOCKCHAIN_PENDING },
      });

      const registry = getProviderRegistry();
      const adapter = registry.getAdapter(order.provider.slug);

      const txParams: IStorageTransactionParams = {
        orderId: order.id,
        planId: order.plan.id,
        storageSizeBytes: order.plan.storageSizeBytes,
        durationDays: order.durationDays,
        userWalletAddress: order.user.walletAddress || undefined,
      };

      logger.info('Executing blockchain transaction', {
        orderId,
        provider: order.provider.slug,
      });

      const txRecord = await prisma.blockchainTransaction.create({
        data: {
          orderId: order.id,
          providerId: order.providerId,
          network: order.provider.network,
          chainId: order.provider.chainId,
          status: TransactionStatus.PENDING,
        },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.BLOCKCHAIN_PROCESSING },
      });

      const result = await adapter.executeStorageTransaction(txParams);

      if (result.success && result.txHash) {
        await prisma.blockchainTransaction.update({
          where: { id: txRecord.id },
          data: {
            txHash: result.txHash,
            status: result.status,
            fromAddress: result.fromAddress,
            toAddress: result.toAddress,
            gasLimit: result.gasLimit,
            gasPrice: result.gasPrice,
            value: result.value,
            data: result.data,
            nonce: result.nonce,
            submittedAt: new Date(),
            rawResponse: result.rawResponse as object,
          },
        });

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.BLOCKCHAIN_PROCESSING,
            storageId: result.storageId,
            storageEndpoint: result.storageEndpoint,
            storageMetadata: result.storageMetadata as object,
          },
        });

        logger.info('Blockchain transaction submitted', {
          orderId,
          txId: txRecord.id,
          txHash: result.txHash,
        });

        this.pollTransactionConfirmation(txRecord.id, adapter.slug).catch(error => {
          logger.error('Transaction confirmation polling failed', error, { txId: txRecord.id });
        });

        return successResult({ txId: txRecord.id });
      } else {
        await withTransaction(async (tx) => {
          await tx.blockchainTransaction.update({
            where: { id: txRecord.id },
            data: {
              status: TransactionStatus.FAILED,
              statusMessage: result.error || 'Transaction failed',
            },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: OrderStatus.BLOCKCHAIN_FAILED,
              statusMessage: result.error || 'Blockchain transaction failed',
            },
          });
        });

        return errorResult('TRANSACTION_FAILED', result.error || 'Transaction failed');
      }
    } catch (error) {
      logger.error('Failed to process order', error, { orderId });
      
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.BLOCKCHAIN_FAILED,
          statusMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return errorResult(
        'PROCESSING_FAILED',
        error instanceof Error ? error.message : 'Failed to process order'
      );
    }
  }

  private async pollTransactionConfirmation(txId: string, providerSlug: string): Promise<void> {
    const maxAttempts = 30;
    const pollInterval = 10000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const tx = await prisma.blockchainTransaction.findUnique({
          where: { id: txId },
          include: { order: true },
        });

        if (!tx || !tx.txHash) return;

        if (tx.status === TransactionStatus.CONFIRMED || tx.status === TransactionStatus.FAILED) {
          return;
        }

        const registry = getProviderRegistry();
        const adapter = registry.getAdapter(providerSlug);
        const status = await adapter.checkTransactionStatus(tx.txHash);

        await prisma.blockchainTransaction.update({
          where: { id: txId },
          data: {
            status: status.status,
            confirmations: status.confirmations,
            blockNumber: status.blockNumber,
            blockHash: status.blockHash,
            gasUsed: status.gasUsed,
            confirmedAt: status.status === TransactionStatus.CONFIRMED ? new Date() : undefined,
            statusMessage: status.error,
          },
        });

        if (status.status === TransactionStatus.CONFIRMED) {
          const expiresAt = addDays(new Date(), tx.order.durationDays);
          
          await prisma.order.update({
            where: { id: tx.orderId },
            data: {
              status: OrderStatus.COMPLETED,
              allocatedAt: new Date(),
              expiresAt,
            },
          });

          logger.info('Transaction confirmed', { txId, orderId: tx.orderId });
          return;
        }

        if (status.status === TransactionStatus.FAILED) {
          await prisma.order.update({
            where: { id: tx.orderId },
            data: {
              status: OrderStatus.BLOCKCHAIN_FAILED,
              statusMessage: status.error || 'Transaction failed',
            },
          });
          return;
        }
      } catch (error) {
        logger.error('Error checking transaction status', error, { txId });
      }
    }

    logger.warn('Max polling attempts reached', { txId });
  }

  async retryTransaction(txId: string): Promise<ServiceResult<{ newTxId: string }>> {
    const tx = await prisma.blockchainTransaction.findUnique({
      where: { id: txId },
      include: { order: true },
    });

    if (!tx) return errorResult('TX_NOT_FOUND', 'Transaction not found');
    if (tx.status !== TransactionStatus.FAILED) return errorResult('INVALID_STATUS', 'Can only retry failed transactions');
    if (tx.retryCount >= tx.maxRetries) return errorResult('MAX_RETRIES', 'Maximum retry attempts reached');

    await prisma.blockchainTransaction.update({
      where: { id: txId },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        status: TransactionStatus.RETRYING,
      },
    });

    return this.processOrder(tx.orderId);
  }

  async getTransaction(txId: string) {
    return prisma.blockchainTransaction.findUnique({
      where: { id: txId },
      include: {
        order: { include: { provider: true, plan: true } },
        provider: true,
      },
    });
  }

  async getTransactionsForOrder(orderId: string) {
    return prisma.blockchainTransaction.findMany({
      where: { orderId },
      include: { provider: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingTransactions() {
    return prisma.blockchainTransaction.findMany({
      where: {
        status: { in: [TransactionStatus.SUBMITTED, TransactionStatus.CONFIRMING] },
      },
      include: { order: true, provider: true },
    });
  }

  async processPendingConfirmations(): Promise<void> {
    const pendingTxs = await this.getPendingTransactions();
    logger.info(`Processing ${pendingTxs.length} pending transactions`);

    for (const tx of pendingTxs) {
      if (!tx.txHash) continue;

      try {
        const registry = getProviderRegistry();
        const adapter = registry.getAdapter(tx.provider.slug);
        const status = await adapter.checkTransactionStatus(tx.txHash);

        await prisma.blockchainTransaction.update({
          where: { id: tx.id },
          data: {
            status: status.status,
            confirmations: status.confirmations,
            blockNumber: status.blockNumber,
            blockHash: status.blockHash,
            gasUsed: status.gasUsed,
            confirmedAt: status.status === TransactionStatus.CONFIRMED ? new Date() : undefined,
          },
        });

        if (status.status === TransactionStatus.CONFIRMED) {
          await prisma.order.update({
            where: { id: tx.orderId },
            data: {
              status: OrderStatus.COMPLETED,
              allocatedAt: new Date(),
              expiresAt: addDays(new Date(), tx.order.durationDays),
            },
          });
        } else if (status.status === TransactionStatus.FAILED) {
          await prisma.order.update({
            where: { id: tx.orderId },
            data: { status: OrderStatus.BLOCKCHAIN_FAILED, statusMessage: status.error },
          });
        }
      } catch (error) {
        logger.error('Error processing pending transaction', error, { txId: tx.id });
      }
    }
  }
}

export const blockchainService = new BlockchainService();
export default blockchainService;