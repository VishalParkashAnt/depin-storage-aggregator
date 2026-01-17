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
import { gbToBytes, retry } from '../../../common/utils/helpers';
import { BlockchainError } from '../../../common/utils/errors';

// ============================================
// Filecoin Calibration Testnet Adapter
// ============================================

/**
 * Filecoin adapter for Calibration testnet
 * 
 * Note: This adapter simulates storage deals on Filecoin's testnet.
 * In production, you would integrate with actual Filecoin storage providers
 * using tools like Lighthouse, Web3.storage, or direct deal-making.
 */
export class FilecoinAdapter extends BaseStorageProviderAdapter {
  public readonly slug = 'filecoin';
  public readonly config: IProviderConfig = {
    name: 'Filecoin',
    slug: 'filecoin',
    description: 'Decentralized storage network with cryptographic proofs',
    website: 'https://filecoin.io',
    logoUrl: '/logos/filecoin.svg',
    network: NetworkType.TESTNET,
    chainId: config.providers.filecoin.chainId,
    rpcUrl: config.providers.filecoin.rpcUrl,
    explorerUrl: config.providers.filecoin.explorerUrl,
    config: {
      minDealDuration: 180, // Minimum 180 days for Filecoin deals
      maxDealDuration: 540, // Maximum ~1.5 years
      replicationFactor: 3, // Number of storage providers
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

      // Test connection
      const network = await this.provider.getNetwork();
      logger.info(`[${this.slug}] Connected to network`, {
        chainId: network.chainId.toString(),
        rpcUrl: this.config.rpcUrl,
      });

      this.initialized = true;
    } catch (error) {
      logger.error(`[${this.slug}] Initialization failed`, error);
      throw new BlockchainError(`Failed to initialize Filecoin adapter: ${error}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.provider) return false;
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber > 0;
    } catch {
      return false;
    }
  }

  async getAvailablePlans(): Promise<IStoragePlan[]> {
    // Filecoin storage plans
    // In production, these would come from actual storage provider marketplaces
    const plans: IStoragePlan[] = [
      {
        externalPlanId: 'fil-starter-1gb',
        name: 'Filecoin Starter',
        description: 'Entry-level decentralized storage with Filecoin',
        storageSizeGb: 1,
        storageSizeBytes: gbToBytes(1),
        durationDays: 180,
        priceUsdCents: 99, // $0.99
        priceNative: '0.01',
        nativeCurrency: 'FIL',
        features: [
          'Cryptographic proof of storage',
          '3x replication',
          'IPFS gateway access',
          'Retrieval guarantees',
        ],
      },
      {
        externalPlanId: 'fil-basic-10gb',
        name: 'Filecoin Basic',
        description: 'Standard storage plan for small projects',
        storageSizeGb: 10,
        storageSizeBytes: gbToBytes(10),
        durationDays: 180,
        priceUsdCents: 799, // $7.99
        priceNative: '0.08',
        nativeCurrency: 'FIL',
        features: [
          'Cryptographic proof of storage',
          '3x replication',
          'IPFS gateway access',
          'Retrieval guarantees',
          'Priority support',
        ],
      },
      {
        externalPlanId: 'fil-pro-100gb',
        name: 'Filecoin Pro',
        description: 'Professional storage for growing applications',
        storageSizeGb: 100,
        storageSizeBytes: gbToBytes(100),
        durationDays: 365,
        priceUsdCents: 4999, // $49.99
        priceNative: '0.5',
        nativeCurrency: 'FIL',
        features: [
          'Cryptographic proof of storage',
          '5x replication',
          'IPFS gateway access',
          'Retrieval guarantees',
          'Priority support',
          'Custom deal parameters',
        ],
      },
      {
        externalPlanId: 'fil-enterprise-1tb',
        name: 'Filecoin Enterprise',
        description: 'Enterprise-grade storage for large-scale applications',
        storageSizeGb: 1024,
        storageSizeBytes: gbToBytes(1024),
        durationDays: 365,
        priceUsdCents: 29999, // $299.99
        priceNative: '3.0',
        nativeCurrency: 'FIL',
        features: [
          'Cryptographic proof of storage',
          '7x replication',
          'Dedicated IPFS gateway',
          'SLA guarantees',
          'Priority support',
          'Custom deal parameters',
          'Dedicated account manager',
        ],
      },
    ];

    return plans;
  }

  async executeStorageTransaction(params: IStorageTransactionParams): Promise<ITransactionResult> {
    this.ensureInitialized();

    if (!this.wallet || !this.provider) {
      return this.createFailedTransaction('Wallet not configured');
    }

    try {
      logger.info(`[${this.slug}] Executing storage transaction`, {
        orderId: params.orderId,
        storageSizeBytes: params.storageSizeBytes.toString(),
      });

      // Simulate storage deal creation on testnet
      // In production, this would:
      // 1. Connect to a Filecoin storage provider marketplace
      // 2. Create a storage deal proposal
      // 3. Submit the deal to the network
      // 4. Wait for deal confirmation

      // For testnet demonstration, we create a simple transaction
      const txData = {
        orderId: params.orderId,
        planId: params.planId,
        storageSizeBytes: params.storageSizeBytes.toString(),
        durationDays: params.durationDays,
        timestamp: Date.now(),
      };

      // Encode data for the transaction
      const dataHex = ethers.hexlify(
        ethers.toUtf8Bytes(JSON.stringify(txData))
      );

      // Estimate gas
      const gasEstimate = await this.provider.estimateGas({
        from: this.wallet.address,
        to: this.wallet.address, // Self-transaction for demo
        value: 0,
        data: dataHex,
      });

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

      // Create and send transaction
      const tx = await this.wallet.sendTransaction({
        to: this.wallet.address, // Self-transaction for demo
        value: 0,
        data: dataHex,
        gasLimit: gasEstimate * BigInt(2), // 2x buffer
        gasPrice,
      });

      logger.info(`[${this.slug}] Transaction submitted`, {
        txHash: tx.hash,
        orderId: params.orderId,
      });

      // Generate mock storage endpoint
      const storageId = `fil_${params.orderId.slice(0, 8)}_${Date.now()}`;
      const storageEndpoint = `https://gateway.lighthouse.storage/ipfs/${storageId}`;

      return this.createPendingTransaction(tx.hash, {
        fromAddress: this.wallet.address,
        toAddress: this.wallet.address,
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        value: '0',
        data: dataHex,
        nonce: tx.nonce,
        storageId,
        storageEndpoint,
        storageMetadata: {
          provider: 'filecoin',
          network: 'calibration',
          dealId: storageId,
          replicationFactor: 3,
        },
      });
    } catch (error) {
      logger.error(`[${this.slug}] Transaction failed`, error);
      return this.createFailedTransaction(
        error instanceof Error ? error.message : 'Transaction failed'
      );
    }
  }

  async checkTransactionStatus(txHash: string): Promise<ITransactionStatusResult> {
    this.ensureInitialized();

    if (!this.provider) {
      return { status: TransactionStatus.FAILED, confirmations: 0, error: 'Provider not available' };
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

      // Consider confirmed after 5 blocks
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
    return `${this.config.explorerUrl}/message/${txHash}`;
  }

  async estimateGas(params: IStorageTransactionParams): Promise<string> {
    this.ensureInitialized();

    if (!this.provider || !this.wallet) {
      throw new BlockchainError('Provider or wallet not available');
    }

    const txData = {
      orderId: params.orderId,
      storageSizeBytes: params.storageSizeBytes.toString(),
    };

    const dataHex = ethers.hexlify(
      ethers.toUtf8Bytes(JSON.stringify(txData))
    );

    const gasEstimate = await this.provider.estimateGas({
      from: this.wallet.address,
      to: this.wallet.address,
      value: 0,
      data: dataHex,
    });

    return gasEstimate.toString();
  }
}