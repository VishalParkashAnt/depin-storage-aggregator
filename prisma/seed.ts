import { PrismaClient, NetworkType, ProviderStatus, PlanStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create test users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'demo@depin.storage' },
      update: {},
      create: {
        email: 'demo@depin.storage',
        name: 'Demo User',
      },
    }),
    prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create providers
  const providers = [
    {
      name: 'Filecoin',
      slug: 'filecoin',
      description: 'Decentralized storage network with cryptographic proofs',
      website: 'https://filecoin.io',
      logoUrl: '/logos/filecoin.svg',
      network: NetworkType.TESTNET,
      chainId: '314159',
      rpcUrl: 'https://api.calibration.node.glif.io/rpc/v1',
      explorerUrl: 'https://calibration.filfox.info',
      status: ProviderStatus.ACTIVE,
    },
    {
      name: 'Arweave',
      slug: 'arweave',
      description: 'Permanent, decentralized data storage with one-time payment',
      website: 'https://www.arweave.org',
      logoUrl: '/logos/arweave.svg',
      network: NetworkType.TESTNET,
      chainId: 'arweave-testnet',
      rpcUrl: 'https://arweave.net',
      explorerUrl: 'https://viewblock.io/arweave',
      status: ProviderStatus.ACTIVE,
    },
    {
      name: 'Storj',
      slug: 'storj',
      description: 'S3-compatible decentralized cloud storage',
      website: 'https://www.storj.io',
      logoUrl: '/logos/storj.svg',
      network: NetworkType.TESTNET,
      chainId: 'storj-dcs',
      rpcUrl: 'https://us1.storj.io',
      explorerUrl: 'https://www.storj.io',
      status: ProviderStatus.ACTIVE,
    },
    {
      name: 'BNB Greenfield',
      slug: 'greenfield',
      description: 'Decentralized storage infrastructure by BNB Chain',
      website: 'https://greenfield.bnbchain.org',
      logoUrl: '/logos/greenfield.svg',
      network: NetworkType.TESTNET,
      chainId: '5600',
      rpcUrl: 'https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org',
      explorerUrl: 'https://testnet.greenfieldscan.com',
      status: ProviderStatus.ACTIVE,
    },
    {
      name: 'Akash Network',
      slug: 'akash',
      description: 'Decentralized cloud compute and storage marketplace',
      website: 'https://akash.network',
      logoUrl: '/logos/akash.svg',
      network: NetworkType.TESTNET,
      chainId: 'testnet-02',
      rpcUrl: 'https://rpc.testnet-02.aksh.pw',
      explorerUrl: 'https://testnet.mintscan.io/akash-testnet',
      status: ProviderStatus.ACTIVE,
    },
  ];

  const createdProviders: Record<string, { id: string }> = {};

  for (const provider of providers) {
    const created = await prisma.provider.upsert({
      where: { slug: provider.slug },
      update: provider,
      create: provider,
    });
    createdProviders[provider.slug] = created;
  }

  console.log(`✅ Created ${providers.length} providers`);

  // Helper to convert GB to bytes
  const gbToBytes = (gb: number): bigint => BigInt(Math.floor(gb * 1024 * 1024 * 1024));

  // Create storage plans for each provider
  const plans = [
    // Filecoin plans
    {
      providerId: createdProviders['filecoin'].id,
      name: 'Filecoin Starter',
      description: 'Entry-level decentralized storage with Filecoin',
      externalPlanId: 'fil-starter-1gb',
      storageSizeGb: 1,
      storageSizeBytes: gbToBytes(1),
      durationDays: 180,
      priceUsdCents: 99,
      priceNative: '0.01',
      nativeCurrency: 'FIL',
      features: ['Cryptographic proof of storage', '3x replication', 'IPFS gateway access'],
    },
    {
      providerId: createdProviders['filecoin'].id,
      name: 'Filecoin Basic',
      description: 'Standard storage plan for small projects',
      externalPlanId: 'fil-basic-10gb',
      storageSizeGb: 10,
      storageSizeBytes: gbToBytes(10),
      durationDays: 180,
      priceUsdCents: 799,
      priceNative: '0.08',
      nativeCurrency: 'FIL',
      features: ['Cryptographic proof of storage', '3x replication', 'IPFS gateway access', 'Priority support'],
    },
    {
      providerId: createdProviders['filecoin'].id,
      name: 'Filecoin Pro',
      description: 'Professional storage for growing applications',
      externalPlanId: 'fil-pro-100gb',
      storageSizeGb: 100,
      storageSizeBytes: gbToBytes(100),
      durationDays: 365,
      priceUsdCents: 4999,
      priceNative: '0.5',
      nativeCurrency: 'FIL',
      features: ['Cryptographic proof of storage', '5x replication', 'IPFS gateway access', 'Priority support', 'Custom deal parameters'],
    },

    // Arweave plans
    {
      providerId: createdProviders['arweave'].id,
      name: 'Arweave 100MB',
      description: 'Permanent storage for small files',
      externalPlanId: 'ar-permanent-100mb',
      storageSizeGb: 0.1,
      storageSizeBytes: gbToBytes(0.1),
      durationDays: 36500,
      priceUsdCents: 149,
      priceNative: '0.001',
      nativeCurrency: 'AR',
      features: ['Permanent storage', 'One-time payment', 'Immutable data'],
    },
    {
      providerId: createdProviders['arweave'].id,
      name: 'Arweave 1GB',
      description: 'Permanent storage for documents and media',
      externalPlanId: 'ar-permanent-1gb',
      storageSizeGb: 1,
      storageSizeBytes: gbToBytes(1),
      durationDays: 36500,
      priceUsdCents: 999,
      priceNative: '0.01',
      nativeCurrency: 'AR',
      features: ['Permanent storage', 'One-time payment', 'Immutable data', 'ArDrive integration'],
    },

    // Storj plans
    {
      providerId: createdProviders['storj'].id,
      name: 'Storj Free Tier',
      description: 'Free tier with 25GB storage',
      externalPlanId: 'storj-free-25gb',
      storageSizeGb: 25,
      storageSizeBytes: gbToBytes(25),
      durationDays: 30,
      priceUsdCents: 0,
      priceNative: '0',
      nativeCurrency: 'STORJ',
      features: ['S3-compatible API', 'End-to-end encryption', 'Global CDN'],
    },
    {
      providerId: createdProviders['storj'].id,
      name: 'Storj Pro 150GB',
      description: 'Professional tier for growing projects',
      externalPlanId: 'storj-pro-150gb',
      storageSizeGb: 150,
      storageSizeBytes: gbToBytes(150),
      durationDays: 30,
      priceUsdCents: 400,
      priceNative: '10',
      nativeCurrency: 'STORJ',
      features: ['S3-compatible API', 'End-to-end encryption', 'Global CDN', 'Multi-region redundancy'],
    },

    // Greenfield plans
    {
      providerId: createdProviders['greenfield'].id,
      name: 'Greenfield Starter',
      description: 'Entry-level BNB Greenfield storage',
      externalPlanId: 'gnfd-starter-5gb',
      storageSizeGb: 5,
      storageSizeBytes: gbToBytes(5),
      durationDays: 30,
      priceUsdCents: 199,
      priceNative: '0.005',
      nativeCurrency: 'BNB',
      features: ['BNB Chain integration', 'Cross-chain bridge', 'Programmable access control'],
    },
    {
      providerId: createdProviders['greenfield'].id,
      name: 'Greenfield Basic',
      description: 'Standard storage for dApps',
      externalPlanId: 'gnfd-basic-50gb',
      storageSizeGb: 50,
      storageSizeBytes: gbToBytes(50),
      durationDays: 30,
      priceUsdCents: 1499,
      priceNative: '0.04',
      nativeCurrency: 'BNB',
      features: ['BNB Chain integration', 'Cross-chain bridge', 'Programmable access control', 'Data mirroring'],
    },

    // Akash plans
    {
      providerId: createdProviders['akash'].id,
      name: 'Akash Micro',
      description: 'Lightweight storage for small deployments',
      externalPlanId: 'akash-micro-10gb',
      storageSizeGb: 10,
      storageSizeBytes: gbToBytes(10),
      durationDays: 30,
      priceUsdCents: 199,
      priceNative: '5',
      nativeCurrency: 'AKT',
      features: ['Decentralized storage', 'Cosmos ecosystem', 'Provider selection'],
    },
    {
      providerId: createdProviders['akash'].id,
      name: 'Akash Small',
      description: 'Standard storage with compute resources',
      externalPlanId: 'akash-small-50gb',
      storageSizeGb: 50,
      storageSizeBytes: gbToBytes(50),
      durationDays: 30,
      priceUsdCents: 799,
      priceNative: '20',
      nativeCurrency: 'AKT',
      features: ['Decentralized storage', 'Cosmos ecosystem', 'Provider selection', 'Auto-scaling'],
    },
  ];

  for (const plan of plans) {
    await prisma.storagePlan.upsert({
      where: {
        providerId_externalPlanId: {
          providerId: plan.providerId,
          externalPlanId: plan.externalPlanId,
        },
      },
      update: {
        ...plan,
        status: PlanStatus.AVAILABLE,
        isActive: true,
      },
      create: {
        ...plan,
        status: PlanStatus.AVAILABLE,
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${plans.length} storage plans`);

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });