import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { walletRepository } from '../src/db/repositories/wallet.js';
import { WalletService } from '../src/services/wallet.js';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError 
} from '../src/middleware/errorHandler.js';

// Test database client
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/agentlink_test'
});

describe('WalletRepository', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.sessionKey.deleteMany();
    await prisma.agentWallet.deleteMany();
  });

  describe('createWallet', () => {
    it('should create a wallet with valid data', async () => {
      const wallet = await walletRepository.createWallet({
        did: 'did:agentlink:1:0x1234567890123456789012345678901234567890',
        owner: '0x1234567890123456789012345678901234567890',
        mainWallet: '0x1234567890123456789012345678901234567890',
        isPremium: false
      });

      expect(wallet).toBeDefined();
      expect(wallet.did).toBe('did:agentlink:1:0x1234567890123456789012345678901234567890');
      expect(wallet.owner).toBe('0x1234567890123456789012345678901234567890');
      expect(wallet.isPremium).toBe(false);
      expect(wallet.sessionKeys).toEqual([]);
    });

    it('should create a premium wallet with expiration', async () => {
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const wallet = await walletRepository.createWallet({
        did: 'did:agentlink:1:0xabcdef',
        owner: '0xabcdef',
        mainWallet: '0xabcdef',
        isPremium: true,
        expiresAt
      });

      expect(wallet.isPremium).toBe(true);
      expect(wallet.expiresAt).toBe(expiresAt.getTime());
    });
  });

  describe('getWallet', () => {
    it('should return null for non-existent wallet', async () => {
      const wallet = await walletRepository.getWallet('non-existent-id');
      expect(wallet).toBeNull();
    });

    it('should return wallet with session keys', async () => {
      const created = await walletRepository.createWallet({
        did: 'did:agentlink:1:0x123',
        owner: '0x123',
        mainWallet: '0x123',
        isPremium: false
      });

      // Add session key
      await walletRepository.createSessionKey(created.id, {
        address: '0xsession123',
        validUntil: new Date(Date.now() + 3600 * 1000),
        permissions: [{ type: 'contract', target: '0xabc', actions: ['execute'] }],
        spendLimit: 1000000n
      });

      const wallet = await walletRepository.getWallet(created.id);
      expect(wallet).toBeDefined();
      expect(wallet?.sessionKeys).toHaveLength(1);
      expect(wallet?.sessionKeys[0].address).toBe('0xsession123');
    });
  });

  describe('getWalletByDID', () => {
    it('should find wallet by DID', async () => {
      const did = 'did:agentlink:1:0xunique';
      await walletRepository.createWallet({
        did,
        owner: '0xunique',
        mainWallet: '0xunique',
        isPremium: false
      });

      const wallet = await walletRepository.getWalletByDID(did);
      expect(wallet).toBeDefined();
      expect(wallet?.did).toBe(did);
    });
  });

  describe('getWalletsByOwner', () => {
    it('should return all wallets for an owner', async () => {
      const owner = '0xowner123';
      
      await walletRepository.createWallet({
        did: 'did:agentlink:1:0x1',
        owner,
        mainWallet: '0x1',
        isPremium: false
      });
      
      await walletRepository.createWallet({
        did: 'did:agentlink:1:0x2',
        owner,
        mainWallet: '0x2',
        isPremium: true
      });

      const wallets = await walletRepository.getWalletsByOwner(owner);
      expect(wallets).toHaveLength(2);
    });
  });

  describe('SessionKey operations', () => {
    it('should create and retrieve session key', async () => {
      const wallet = await walletRepository.createWallet({
        did: 'did:agentlink:1:0xsk',
        owner: '0xsk',
        mainWallet: '0xsk',
        isPremium: false
      });

      const sessionKey = await walletRepository.createSessionKey(wallet.id, {
        address: '0xsession',
        validUntil: new Date(Date.now() + 3600 * 1000),
        permissions: [
          { type: 'contract', target: '0xcontract', actions: ['execute'] }
        ],
        spendLimit: 5000000n
      });

      expect(sessionKey).toBeDefined();
      expect(sessionKey.address).toBe('0xsession');
      expect(sessionKey.spendLimit).toBe(5000000n);
      expect(sessionKey.spent).toBe(0n);

      const retrieved = await walletRepository.getSessionKey(sessionKey.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.address).toBe('0xsession');
    });

    it('should update session key spent amount', async () => {
      const wallet = await walletRepository.createWallet({
        did: 'did:agentlink:1:0xupdate',
        owner: '0xupdate',
        mainWallet: '0xupdate',
        isPremium: false
      });

      const sessionKey = await walletRepository.createSessionKey(wallet.id, {
        address: '0xsession2',
        validUntil: new Date(Date.now() + 3600 * 1000),
        permissions: [],
        spendLimit: 1000000n
      });

      await walletRepository.updateSessionKeySpent(sessionKey.id, 500000n);

      const updated = await walletRepository.getSessionKey(sessionKey.id);
      expect(updated?.spent).toBe(500000n);
    });
  });

  describe('Statistics', () => {
    it('should count wallets correctly', async () => {
      const initial = await walletRepository.countWallets();
      
      await walletRepository.createWallet({
        did: 'did:agentlink:1:0xcount1',
        owner: '0xcount1',
        mainWallet: '0xcount1',
        isPremium: false
      });

      const after = await walletRepository.countWallets();
      expect(after).toBe(initial + 1);
    });

    it('should count premium wallets', async () => {
      await walletRepository.createWallet({
        did: 'did:agentlink:1:0xpremium',
        owner: '0xpremium',
        mainWallet: '0xpremium',
        isPremium: true
      });

      const premiumCount = await walletRepository.countPremiumWallets();
      expect(premiumCount).toBeGreaterThan(0);
    });
  });
});

describe('WalletService', () => {
  let service: WalletService;

  beforeAll(async () => {
    await prisma.$connect();
    service = new WalletService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.sessionKey.deleteMany();
    await prisma.agentWallet.deleteMany();
  });

  describe('createWallet', () => {
    it('should create wallet with invoice', async () => {
      const result = await service.createWallet(
        '0x1234567890123456789012345678901234567890',
        'Test Wallet',
        false
      );

      expect(result.wallet).toBeDefined();
      expect(result.invoice).toBeDefined();
      expect(result.invoice.amount).toBe(2000000n); // 2 USDC setup fee
      expect(result.wallet.isPremium).toBe(false);
    });

    it('should create premium wallet with higher fee', async () => {
      const result = await service.createWallet(
        '0x1234567890123456789012345678901234567891',
        'Premium Wallet',
        true
      );

      expect(result.invoice.amount).toBe(50000000n); // 50 USDC premium fee
      expect(result.wallet.isPremium).toBe(true);
    });

    it('should throw ValidationError for invalid address', async () => {
      await expect(
        service.createWallet('invalid-address', 'Test', false)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty name', async () => {
      await expect(
        service.createWallet('0x1234567890123456789012345678901234567890', '', false)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createSessionKey', () => {
    it('should create session key for wallet', async () => {
      const { wallet } = await service.createWallet(
        '0x1234567890123456789012345678901234567892',
        'Test',
        false
      );

      const result = await service.createSessionKey(
        wallet.id,
        [{ type: 'contract', target: '0xabc', actions: ['execute'] }],
        1000000n,
        3600
      );

      expect(result.sessionKey).toBeDefined();
      expect(result.invoice.amount).toBe(100000n); // 0.1 USDC
      expect(result.sessionKey.spendLimit).toBe(1000000n);
    });

    it('should enforce free tier limit of 3 session keys', async () => {
      const { wallet } = await service.createWallet(
        '0x1234567890123456789012345678901234567893',
        'Test',
        false
      );

      // Create 3 session keys
      for (let i = 0; i < 3; i++) {
        await service.createSessionKey(
          wallet.id,
          [{ type: 'contract', target: '0xabc', actions: ['execute'] }],
          1000000n,
          3600
        );
      }

      // 4th should fail
      await expect(
        service.createSessionKey(
          wallet.id,
          [{ type: 'contract', target: '0xabc', actions: ['execute'] }],
          1000000n,
          3600
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      await expect(
        service.createSessionKey(
          'non-existent-id',
          [{ type: 'contract', target: '0xabc', actions: ['execute'] }],
          1000000n,
          3600
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('validateSessionKey', () => {
    it('should return valid for valid session key', async () => {
      const { wallet } = await service.createWallet(
        '0x1234567890123456789012345678901234567894',
        'Test',
        false
      );

      const { sessionKey } = await service.createSessionKey(
        wallet.id,
        [{ type: 'contract', target: '0xcontract', actions: ['execute'] }],
        1000000n,
        3600
      );

      const result = await service.validateSessionKey(
        sessionKey.id,
        '0xcontract',
        'execute',
        100000n
      );

      expect(result.valid).toBe(true);
    });

    it('should return error for exceeded spend limit', async () => {
      const { wallet } = await service.createWallet(
        '0x1234567890123456789012345678901234567895',
        'Test',
        false
      );

      const { sessionKey } = await service.createSessionKey(
        wallet.id,
        [{ type: 'contract', target: '0xcontract', actions: ['execute'] }],
        1000000n,
        3600
      );

      await service.recordSpend(sessionKey.id, 900000n);

      const result = await service.validateSessionKey(
        sessionKey.id,
        '0xcontract',
        'execute',
        200000n
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Spend limit exceeded');
    });

    it('should return error for invalid permission', async () => {
      const { wallet } = await service.createWallet(
        '0x1234567890123456789012345678901234567896',
        'Test',
        false
      );

      const { sessionKey } = await service.createSessionKey(
        wallet.id,
        [{ type: 'contract', target: '0xallowed', actions: ['execute'] }],
        1000000n,
        3600
      );

      const result = await service.validateSessionKey(
        sessionKey.id,
        '0xnotallowed',
        'execute',
        100000n
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Create test wallets
      await service.createWallet(
        '0x1234567890123456789012345678901234567897',
        'Test1',
        false
      );
      
      await service.createWallet(
        '0x1234567890123456789012345678901234567898',
        'Test2',
        true
      );

      const stats = await service.getStats();

      expect(stats.totalWallets).toBeGreaterThanOrEqual(2);
      expect(stats.premiumWallets).toBeGreaterThanOrEqual(1);
      expect(stats.estimatedRevenue).toBeGreaterThan(0n);
    });
  });
});
