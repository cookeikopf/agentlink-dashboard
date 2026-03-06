/**
 * Wallet Repository
 * 
 * Database operations for AgentWallet and SessionKey
 * Replaces in-memory Map storage
 */

import { prisma } from '../client.js';
import type { AgentWallet, SessionKey, Permission } from '../../types.js';

export class WalletRepository {
  
  async createWallet(data: {
    did: string;
    owner: string;
    mainWallet: string;
    isPremium: boolean;
    expiresAt?: Date;
  }): Promise<AgentWallet> {
    const wallet = await prisma.agentWallet.create({
      data: {
        did: data.did,
        owner: data.owner,
        mainWallet: data.mainWallet,
        isPremium: data.isPremium,
        expiresAt: data.expiresAt
      }
    });
    
    return this.mapToDomain(wallet);
  }
  
  async getWallet(id: string): Promise<AgentWallet | null> {
    const wallet = await prisma.agentWallet.findUnique({
      where: { id },
      include: { sessionKeys: true }
    });
    
    return wallet ? this.mapToDomainWithSessionKeys(wallet) : null;
  }
  
  async getWalletByDID(did: string): Promise<AgentWallet | null> {
    const wallet = await prisma.agentWallet.findUnique({
      where: { did },
      include: { sessionKeys: true }
    });
    
    return wallet ? this.mapToDomainWithSessionKeys(wallet) : null;
  }
  
  async getWalletsByOwner(owner: string): Promise<AgentWallet[]> {
    const wallets = await prisma.agentWallet.findMany({
      where: { owner: owner.toLowerCase() },
      include: { sessionKeys: true }
    });
    
    return wallets.map(w => this.mapToDomainWithSessionKeys(w));
  }
  
  async createSessionKey(walletId: string, data: {
    address: string;
    validUntil: Date;
    permissions: Permission[];
    spendLimit: bigint;
  }): Promise<SessionKey> {
    const sessionKey = await prisma.sessionKey.create({
      data: {
        walletId,
        address: data.address,
        validUntil: data.validUntil,
        permissions: data.permissions as any,
        spendLimit: data.spendLimit
      }
    });
    
    return this.mapSessionKeyToDomain(sessionKey);
  }
  
  async getSessionKey(id: string): Promise<(SessionKey & { walletId: string }) | null> {
    const sessionKey = await prisma.sessionKey.findUnique({
      where: { id }
    });
    
    if (!sessionKey) return null;
    
    return {
      ...this.mapSessionKeyToDomain(sessionKey),
      walletId: sessionKey.walletId
    };
  }
  
  async updateSessionKeySpent(id: string, spent: bigint): Promise<void> {
    await prisma.sessionKey.update({
      where: { id },
      data: { spent }
    });
  }
  
  async getSessionKeysByWallet(walletId: string): Promise<SessionKey[]> {
    const keys = await prisma.sessionKey.findMany({
      where: { walletId }
    });
    
    return keys.map(k => this.mapSessionKeyToDomain(k));
  }
  
  async countWallets(): Promise<number> {
    return await prisma.agentWallet.count();
  }
  
  async countPremiumWallets(): Promise<number> {
    return await prisma.agentWallet.count({
      where: { isPremium: true }
    });
  }
  
  async countSessionKeys(): Promise<number> {
    return await prisma.sessionKey.count();
  }
  
  // Mappers
  private mapToDomain(wallet: any): AgentWallet {
    return {
      id: wallet.id,
      did: wallet.did,
      owner: wallet.owner as `0x${string}`,
      mainWallet: wallet.mainWallet as `0x${string}`,
      sessionKeys: [],
      isPremium: wallet.isPremium,
      createdAt: wallet.createdAt.getTime(),
      expiresAt: wallet.expiresAt?.getTime()
    };
  }
  
  private mapToDomainWithSessionKeys(wallet: any): AgentWallet {
    return {
      ...this.mapToDomain(wallet),
      sessionKeys: wallet.sessionKeys.map((k: any) => this.mapSessionKeyToDomain(k))
    };
  }
  
  private mapSessionKeyToDomain(key: any): SessionKey {
    return {
      id: key.id,
      address: key.address as `0x${string}`,
      validUntil: Math.floor(key.validUntil.getTime() / 1000),
      permissions: key.permissions as Permission[],
      spendLimit: BigInt(key.spendLimit.toString()),
      spent: BigInt(key.spent.toString()),
      createdAt: key.createdAt.getTime()
    };
  }
}

export const walletRepository = new WalletRepository();
