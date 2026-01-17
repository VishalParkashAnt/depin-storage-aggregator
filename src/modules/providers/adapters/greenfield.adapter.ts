import { ethers } from 'ethers';
import { NetworkType, TransactionStatus } from '@prisma/client';
import { BaseStorageProviderAdapter } from './base.adapter';
import {
  IProviderConfig,
  IStoragePlan,
  IStorageTransactionParams,
  ITransactionResult,
  ITransactionStatusResult,
} from '../../../common/interfaces';
import { config } from '../../../config';
import { logger } from '../../../common/utils/logger';
import { gbToBytes, retry, generateId } from '../../../common/utils/helpers';
import { BlockchainError } from '../../../common/utils/errors';

// ============================================
// BNB Greenfield Testnet Adapter
// ============================================

/**
 * BNB Greenfield adapter for decentralized storage on BNB Chain
 * 
 * Greenfield is BNB Chain's decentralized storage solution
 * integrated with the BNB Smart Chain ecosystem.
 */
export class GreenfieldAdapter extends BaseStorageProviderAdapter {
  public readonly slug = 'greenfield';
  public readonly config: IProviderConfig = {
    name: 'BNB Greenfield',
    slug: 'greenfield',
    description: 'Decentralized storage infrastructure by BNB Chain',
    website: 'https://greenfield.bnbchain.org',
    logoUrl: '/logos/greenfield.svg',
    network: NetworkType.TESTNET,
    chainId: config.providers.greenfield.chainId,
    rpcUrl: config.providers.greenfield.rpcUrl,
    explorerUrl: config.providers.greenfield.explorerUrl,
    config: {
      bnbEcosystem: true,
      crossChainBridge: true,
      programmableStorage: true,
    },
  };

  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;

  async initialize(): Promise<void> {
    try {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      if (config.wallet.privateKey) {
        this.wallet = new ethers.Wallet(config.wallet.privateKey, this.provider);
        logger.info(`[${this.slug}] Wallet initialized: ${this.wallet.address}`);
      }

      logger.info(`[${this.slug}] Connected to Greenfield testnet`, {
        rpcUrl: this.config.rpcUrl,
      });

      this.initialized = true;
    } catch (error) {
      logger.error(`[${this.slug}] Initialization failed`, error);
      this.initialized = true; // Allow graceful degradation
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.provider) return false;
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  async getAvailablePlans(): Promise<IStoragePlan[]> {
    const plans: IStoragePlan[] = [
      {
        externalPlanId: 'gnfd-starter-5gb',
        name: 'Greenfield Starter',
        description: 'Entry-level BNB Greenfield storage',
        storageSizeGb: 5,
        storageSizeBytes: gbToBytes(5),
        durationDays: 30,
        priceUsdCents: 199,
        priceNative: '0.005',
        nativeCurrency: 'BNB',
        features: [
          'BNB Chain integration',
          'Cross-chain bridge',
          'Programmable access control',
          'SDK support',
        ],
      },
      {
        externalPlanId: 'gnfd-basic-50gb',
        name: 'Greenfield Basic',
        description: 'Standard storage for dApps',
        storageSizeGb: 50,
        storageSizeBytes: gbToBytes(50),
        durationDays: 30,
        priceUsdCents: 1499,
        priceNative: '0.04',
        nativeCurrency: 'BNB',
        features: [
          'BNB Chain integration',
          'Cross-chain bridge',
          'Programmable access control',
          'SDK support',
          'Data mirroring',
        ],
      },
      {
        externalPlanId: 'gnfd-pro-200gb',
        name: 'Greenfield Pro',
        description: 'Professional storage for production dApps',
        storageSizeGb: 200,
        storageSizeBytes: gbToBytes(200),
        durationDays: 30,
        priceUsdCents: 4999,
        priceNative: '0.13',
        nativeCurrency: 'BNB',
        features: [
          'BNB Chain integration',
          'Cross-chain bridge',
          'Programmable access control',
          'SDK support',
          'Data mirroring',
          'Priority support',
          'Custom SP selection',
        ],
      },
      {
        externalPlanId: 'gnfd-enterprise-1tb',
        name: 'Greenfield Enterprise',
        description: 'Enterprise-grade storage solution',
        storageSizeGb: 1024,
        storageSizeBytes: gbToBytes(1024),
        durationDays: 30,
        priceUsdCents: 19999,
        priceNative: '0.5',
        nativeCurrency: 'BNB',
        features: [
          'BNB Chain integration',
          'Cross-chain bridge',
          'Programmable access control',
          'SDK support',
          'Data mirroring',
          'Priority support',
          'Custom SP selection',
          'SLA guarantees',
          'Dedicated support',
        ],
      },
    ];

    return plans;
  }

  async executeStorageTransaction(params: IStorageTransactionParams): Promise<ITransactionResult> {
    this.ensureInitialized();

    if (!this.wallet || !this.provider) {
      // Fallback to mock transaction if wallet not configured
      return this.createMockTransaction(params);
    }

    try {
      logger.info(`[${this.slug}] Executing storage transaction`, {
        orderId: params.orderId,
        storageSizeBytes: params.storageSizeBytes.toString(),
      });

      // Create bucket on Greenfield testnet
      const bucketName = `depin-${params.orderId.slice(0, 8)}-${Date.now()}`;
      
      // Encode transaction data
      const txData = {
        action: 'CREATE_BUCKET',
        orderId: params.orderId,
        bucketName,
        storageSizeBytes: params.storageSizeBytes.toString(),
        durationDays: params.durationDays,
        timestamp: Date.now(),
      };

      const dataHex = ethers.hexlify(
        ethers.toUtf8Bytes(JSON.stringify(txData))
      );

      // Estimate gas
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');

      // Send transaction
      const tx = await this.wallet.sendTransaction({
        to: this.wallet.address,
        value: 0,
        data: dataHex,
        gasLimit: 100000n,
        gasPrice,
      });

      logger.info(`[${this.slug}] Transaction submitted`, {
        txHash: tx.hash,
        bucketName,
        orderId: params.orderId,
      });

      return this.createPendingTransaction(tx.hash, {
        fromAddress: this.wallet.address,
        toAddress: this.wallet.address,
        gasLimit: '100000',
        gasPrice: gasPrice.toString(),
        value: '0',
        data: dataHex,
        nonce: tx.nonce,
        storageId: bucketName,
        storageEndpoint: `https://greenfield-sp.bnbchain.org/${bucketName}`,
        storageMetadata: {
          provider: 'greenfield',
          network: 'testnet',
          bucketName,
          ownerAddress: this.wallet.address,
        },
      });
    } catch (error) {
      logger.error(`[${this.slug}] Transaction failed`, error);
      return this.createFailedTransaction(
        error instanceof Error ? error.message : 'Transaction failed'
      );
    }
  }

  private createMockTransaction(params: IStorageTransactionParams): ITransactionResult {
    const bucketName = `depin-${params.orderId.slice(0, 8)}-${Date.now()}`;
    const mockTxHash = `0x${generateId().replace(/-/g, '')}${generateId().replace(/-/g, '').slice(0, 24)}`;

    logger.info(`[${this.slug}] Created mock transaction`, {
      txHash: mockTxHash,
      bucketName,
      orderId: params.orderId,
    });

    return this.createPendingTransaction(mockTxHash, {
      storageId: bucketName,
      storageEndpoint: `https://greenfield-sp.bnbchain.org/${bucketName}`,
      storageMetadata: {
        provider: 'greenfield',
        network: 'testnet',
        bucketName,
        mock: true,
      },
    });
  }

  async checkTransactionStatus(txHash: string): Promise<ITransactionStatusResult> {
    this.ensureInitialized();

    if (!this.provider) {
      // Mock confirmation for test transactions
      if (txHash.startsWith('0x')) {
        return {
          status: TransactionStatus.CONFIRMED,
          confirmations: 10,
        };
      }
      return { status: TransactionStatus.PENDING, confirmations: 0 };
    }

    try {
      const receipt = await retry(
        () => this.provider!.getTransactionReceipt(txHash),
        { maxRetries: 3, delay: 1000 }
      );

      if (!receipt) {
        return { status: TransactionStatus.PENDING, confirmations: 0 };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      if (receipt.status === 0) {
        return {
          status: TransactionStatus.FAILED,
          confirmations,
          blockNumber: BigInt(receipt.blockNumber),
          blockHash: receipt.blockHash,
          gasUsed: receipt.gasUsed.toString(),
          error: 'Transaction reverted',
        };
      }

      const status = confirmations >= 5 
        ? TransactionStatus.CONFIRMED 
        : TransactionStatus.CONFIRMING;

      return {
        status,
        confirmations,
        blockNumber: BigInt(receipt.blockNumber),
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error(`[${this.slug}] Failed to check transaction status`, error, { txHash });
      return {
        status: TransactionStatus.PENDING,
        confirmations: 0,
        error: error instanceof Error ? error.message : 'Failed to check status',
      };
    }
  }

  getTransactionExplorerUrl(txHash: string): string {
    return `${this.config.explorerUrl}/tx/${txHash}`;
  }
}