/**
 * Secure Wallet Service
 * 
 * Business logic for wallet operations with proper error handling
 */

import { walletRepository } from '../db/repositories/wallet.js';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  withRetry 
} from '../middleware/errorHandler.js';
import type { AgentWallet, SessionKey, Permission } from '../types.js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export class WalletService {
  private readonly SETUP_FEE = 2000000n; // 2 USDC
  private readonly PREMIUM_FEE = 50000000n; // 50 USDC
  private readonly SESSION_KEY_FEE = 100000n; // 0.1 USDC

  async createWallet(
    ownerAddress: string,
    name: string,
    isPremium: boolean = false
  ): Promise<{ wallet: AgentWallet; invoice: { id: string; amount: bigint } }> {
    // Validation
    if (!this.isValidAddress(ownerAddress)) {
      throw new ValidationError('Invalid owner address');
    }
    if (!name || name.length < 1 || name.length > 100) {
      throw new ValidationError('Name must be between 1 and 100 characters');
    }

    // Generate wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const did = `did:agentlink:${baseSepolia.id}:${account.address}`;

    // Check for existing DID
    const existing = await walletRepository.getWalletByDID(did);
    if (existing) {
      throw new ConflictError('Wallet with this DID already exists');
    }

    // Create wallet with retry
    const wallet = await withRetry(() =>
      walletRepository.createWallet({
        did,
        owner: ownerAddress.toLowerCase(),
        mainWallet: account.address,
        isPremium,
        expiresAt: isPremium ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : undefined
      })
    );

    const fee = isPremium ? this.PREMIUM_FEE : this.SETUP_FEE;

    return {
      wallet,
      invoice: {
        id: `inv-${Date.now()}`,
        amount: fee
      }
    };
  }

  async createSessionKey(
    walletId: string,
    permissions: Permission[],
    spendLimit: bigint,
    duration: number = 3600
  ): Promise<{ sessionKey: SessionKey; invoice: { id: string; amount: bigint } }> {
    // Validation
    if (!walletId) {
      throw new ValidationError('Wallet ID is required');
    }
    if (!permissions || permissions.length === 0) {
      throw new ValidationError('At least one permission is required');
    }
    if (spendLimit <= 0n) {
      throw new ValidationError('Spend limit must be greater than 0');
    }
    if (duration < 60 || duration > 86400) {
      throw new ValidationError('Duration must be between 60 seconds and 24 hours');
    }

    // Get wallet
    const wallet = await walletRepository.getWallet(walletId);
    if (!wallet) {
      throw new NotFoundError('Wallet');
    }

    // Check limits
    if (!wallet.isPremium && wallet.sessionKeys.length >= 3) {
      throw new ValidationError('Free tier: max 3 session keys. Upgrade to premium.');
    }

    // Generate session key
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const sessionKey = await withRetry(() =>
      walletRepository.createSessionKey(walletId, {
        address: account.address,
        validUntil: new Date(Date.now() + duration * 1000),
        permissions,
        spendLimit
      })
    );

    return {
      sessionKey,
      invoice: {
        id: `inv-sk-${Date.now()}`,
        amount: this.SESSION_KEY_FEE
      }
    };
  }

  async validateSessionKey(
    sessionKeyId: string,
    contract: string,
    functionName: string,
    value: bigint
  ): Promise<{ valid: boolean; error?: string }> {
    const sessionKey = await walletRepository.getSessionKey(sessionKeyId);
    
    if (!sessionKey) {
      return { valid: false, error: 'Session key not found' };
    }

    // Check expiration
    if (Date.now() / 1000 > sessionKey.validUntil) {
      return { valid: false, error: 'Session key expired' };
    }

    // Check spend limit
    if (sessionKey.spent + value > sessionKey.spendLimit) {
      return { valid: false, error: 'Spend limit exceeded' };
    }

    // Check permissions
    const hasPermission = sessionKey.permissions.some(p =>
      (p.type === 'contract' && p.target.toLowerCase() === contract.toLowerCase()) ||
      (p.type === 'function' && p.actions.includes(functionName))
    );

    if (!hasPermission) {
      return { valid: false, error: 'Permission denied' };
    }

    return { valid: true };
  }

  async recordSpend(sessionKeyId: string, amount: bigint): Promise<void> {
    const sessionKey = await walletRepository.getSessionKey(sessionKeyId);
    if (!sessionKey) {
      throw new NotFoundError('Session key');
    }

    const newSpent = sessionKey.spent + amount;
    if (newSpent > sessionKey.spendLimit) {
      throw new ValidationError('Spend limit exceeded');
    }

    await walletRepository.updateSessionKeySpent(sessionKeyId, newSpent);
  }

  async getWallet(walletId: string): Promise<AgentWallet> {
    const wallet = await walletRepository.getWallet(walletId);
    if (!wallet) {
      throw new NotFoundError('Wallet');
    }
    return wallet;
  }

  async getWalletsByOwner(owner: string): Promise<AgentWallet[]> {
    if (!this.isValidAddress(owner)) {
      throw new ValidationError('Invalid owner address');
    }
    return walletRepository.getWalletsByOwner(owner.toLowerCase());
  }

  async getStats(): Promise<{
    totalWallets: number;
    premiumWallets: number;
    totalSessionKeys: number;
    estimatedRevenue: bigint;
  }> {
    const [totalWallets, premiumWallets, totalSessionKeys] = await Promise.all([
      walletRepository.countWallets(),
      walletRepository.countPremiumWallets(),
      walletRepository.countSessionKeys()
    ]);

    const revenue = BigInt(totalWallets - premiumWallets) * this.SETUP_FEE +
      BigInt(premiumWallets) * this.PREMIUM_FEE +
      BigInt(totalSessionKeys) * this.SESSION_KEY_FEE;

    return {
      totalWallets,
      premiumWallets,
      totalSessionKeys,
      estimatedRevenue: revenue
    };
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

export const walletService = new WalletService();
