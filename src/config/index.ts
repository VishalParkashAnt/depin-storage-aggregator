import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// ============================================
// Configuration Schema Validation
// ============================================

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  // Platform Wallet
  PLATFORM_WALLET_PRIVATE_KEY: z.string().optional(),
  PLATFORM_WALLET_ADDRESS: z.string().optional(),

  // Filecoin
  FILECOIN_RPC_URL: z.string().url().optional(),
  FILECOIN_CHAIN_ID: z.string().optional(),
  FILECOIN_EXPLORER_URL: z.string().url().optional(),

  // Arweave
  ARWEAVE_GATEWAY_URL: z.string().url().optional(),
  ARWEAVE_TESTNET_URL: z.string().url().optional(),

  // Storj
  STORJ_API_KEY: z.string().optional(),
  STORJ_SATELLITE_URL: z.string().url().optional(),
  STORJ_ACCESS_GRANT: z.string().optional(),

  // BNB Greenfield
  GREENFIELD_RPC_URL: z.string().url().optional(),
  GREENFIELD_CHAIN_ID: z.string().optional(),
  GREENFIELD_EXPLORER_URL: z.string().url().optional(),

  // Akash
  AKASH_RPC_URL: z.string().url().optional(),
  AKASH_CHAIN_ID: z.string().optional(),
  AKASH_EXPLORER_URL: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Cron
  ENABLE_CRON_JOBS: z.string().transform(v => v === 'true').default('true'),
  PROVIDER_SYNC_CRON: z.string().default('0 */6 * * *'),
  TX_CONFIRMATION_CRON: z.string().default('*/2 * * * *'),

  // Security
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(32),
});

// Parse and validate environment
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      console.error('❌ Environment validation failed:');
      missing.forEach(m => console.error(`   - ${m}`));
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

// ============================================
// Configuration Export
// ============================================

export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    baseUrl: env.API_BASE_URL,
    frontendUrl: env.FRONTEND_URL,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
  },

  database: {
    url: env.DATABASE_URL,
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  wallet: {
    privateKey: env.PLATFORM_WALLET_PRIVATE_KEY,
    address: env.PLATFORM_WALLET_ADDRESS,
  },

  providers: {
    filecoin: {
      rpcUrl: env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1',
      chainId: env.FILECOIN_CHAIN_ID || '314159',
      explorerUrl: env.FILECOIN_EXPLORER_URL || 'https://calibration.filfox.info',
    },
    arweave: {
      gatewayUrl: env.ARWEAVE_GATEWAY_URL || 'https://arweave.net',
      testnetUrl: env.ARWEAVE_TESTNET_URL || 'http://localhost:1984',
    },
    storj: {
      apiKey: env.STORJ_API_KEY,
      satelliteUrl: env.STORJ_SATELLITE_URL || 'https://us1.storj.io',
      accessGrant: env.STORJ_ACCESS_GRANT,
    },
    greenfield: {
      rpcUrl: env.GREENFIELD_RPC_URL || 'https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org',
      chainId: env.GREENFIELD_CHAIN_ID || '5600',
      explorerUrl: env.GREENFIELD_EXPLORER_URL || 'https://testnet.greenfieldscan.com',
    },
    akash: {
      rpcUrl: env.AKASH_RPC_URL || 'https://rpc.testnet-02.aksh.pw',
      chainId: env.AKASH_CHAIN_ID || 'testnet-02',
      explorerUrl: env.AKASH_EXPLORER_URL || 'https://testnet.mintscan.io/akash-testnet',
    },
  },

  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  cron: {
    enabled: env.ENABLE_CRON_JOBS,
    providerSync: env.PROVIDER_SYNC_CRON,
    txConfirmation: env.TX_CONFIRMATION_CRON,
  },

  security: {
    corsOrigins: env.CORS_ORIGINS.split(',').map(s => s.trim()),
    sessionSecret: env.SESSION_SECRET,
  },
} as const;

export type Config = typeof config;
export default config;