/**
 * AgentLink Wallet Manager
 * 
 * x402-Wallet Integration mit Session Keys für Gasless Transactions
 * Monetarisierung: Setup-Fees, Premium Keys
 */

import { createWalletClient, http, publicActions, parseEther, formatEther } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Session Key für Gasless Transactions
export interface SessionKey {
  id: string;
  address: `0x${string}`;
  validUntil: number; // Unix timestamp
  permissions: Permission[];
  spendLimit: bigint;
  spent: bigint;
  createdAt: number;
}

export interface Permission {
  type: 'contract' | 'function' | 'token' | 'api';
  target: string;
  actions: string[];
}

// Agent Identity mit DID
export interface AgentWallet {
  id: string;
  did: string;
  owner: `0x${string}`;
  mainWallet: `0x${string}`;
  sessionKeys: SessionKey[];
  isPremium: boolean;
  createdAt: number;
  expiresAt?: number;
}

export class WalletManager {
  private wallets: Map<string, AgentWallet> = new Map();
  private sessionKeys: Map<string, SessionKey> = new Map();
  private client: any;
  
  // Fee Configuration
  private readonly SETUP_FEE = 2000000n; // 2 USDC
  private readonly PREMIUM_FEE = 50000000n; // 50 USDC/year
  private readonly SESSION_KEY_FEE = 100000n; // 0.1 USDC per key
  
  constructor(private rpcUrl: string = 'https://sepolia.base.org') {
    this.client = createWalletClient({
      chain: baseSepolia,
      transport: http(rpcUrl)
    }).extend(publicActions);
  }
  
  /**
   * Erstellt neue Agent Wallet
   * Monetarisierung: Setup-Fee
   */
  async createWallet(
    ownerAddress: `0x${string}`,
    name: string,
    isPremium: boolean = false
  ): Promise<{ wallet: AgentWallet; invoice: PaymentInvoice }> {
    // Generate new wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    // Create DID
    const did = `did:agentlink:${baseSepolia.id}:${account.address}`;
    
    const wallet: AgentWallet = {
      id: `wallet-${Date.now()}`,
      did,
      owner: ownerAddress,
      mainWallet: account.address,
      sessionKeys: [],
      isPremium,
      createdAt: Date.now(),
      expiresAt: isPremium ? Date.now() + 365 * 24 * 60 * 60 * 1000 : undefined
    };
    
    // Calculate fees
    const fees = isPremium ? this.PREMIUM_FEE : this.SETUP_FEE;
    
    const invoice: PaymentInvoice = {
      id: `invoice-${Date.now()}`,
      walletId: wallet.id,
      amount: fees,
      token: 'USDC',
      description: isPremium ? 'Premium Wallet (1 year)' : 'Standard Wallet Setup',
      status: 'pending'
    };
    
    this.wallets.set(wallet.id, wallet);
    
    return { wallet, invoice };
  }
  
  /**
   * Erstellt Session Key für Gasless Tx
   * Monetarisierung: Per-Key Fee
   */
  async createSessionKey(
    walletId: string,
    permissions: Permission[],
    spendLimit: bigint,
    duration: number = 3600 // 1 hour default
  ): Promise<{ sessionKey: SessionKey; invoice: PaymentInvoice }> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    
    // Check if premium or within limits
    if (!wallet.isPremium && wallet.sessionKeys.length >= 3) {
      throw new Error('Free tier: max 3 session keys. Upgrade to premium.');
    }
    
    // Generate session key
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    const sessionKey: SessionKey = {
      id: `sk-${Date.now()}`,
      address: account.address,
      validUntil: Math.floor(Date.now() / 1000) + duration,
      permissions,
      spendLimit,
      spent: 0n,
      createdAt: Date.now()
    };
    
    wallet.sessionKeys.push(sessionKey);
    this.sessionKeys.set(sessionKey.id, sessionKey);
    
    const invoice: PaymentInvoice = {
      id: `invoice-${Date.now()}`,
      walletId,
      sessionKeyId: sessionKey.id,
      amount: this.SESSION_KEY_FEE,
      token: 'USDC',
      description: 'Session Key Creation',
      status: 'pending'
    };
    
    return { sessionKey, invoice };
  }
  
  /**
   * Validiert Session Key für Transaction
   */
  validateSessionKey(
    sessionKeyId: string,
    contract: string,
    functionName: string,
    value: bigint
  ): { valid: boolean; error?: string } {
    const sessionKey = this.sessionKeys.get(sessionKeyId);
    if (!sessionKey) return { valid: false, error: 'Session key not found' };
    
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
  
  /**
   * Führt Gasless Transaction aus
   */
  async executeGasless(
    sessionKeyId: string,
    transaction: { to: `0x${string}`; data: `0x${string}`; value: bigint }
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    const sessionKey = this.sessionKeys.get(sessionKeyId);
    if (!sessionKey) return { success: false, error: 'Session key not found' };
    
    // Validate
    const validation = this.validateSessionKey(
      sessionKeyId,
      transaction.to,
      'execute',
      transaction.value
    );
    
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    try {
      // Execute via relayer (simplified)
      // In production: use proper meta-transaction relay
      const account = privateKeyToAccount(generatePrivateKey()); // Mock
      
      const hash = await this.client.sendTransaction({
        account,
        to: transaction.to,
        data: transaction.data,
        value: transaction.value
      });
      
      // Update spent amount
      sessionKey.spent += transaction.value;
      
      return { success: true, hash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Holt Wallet Details
   */
  getWallet(walletId: string): AgentWallet | undefined {
    return this.wallets.get(walletId);
  }
  
  /**
   * Holt alle Wallets eines Owners
   */
  getWalletsByOwner(owner: `0x${string}`): AgentWallet[] {
    return Array.from(this.wallets.values())
      .filter(w => w.owner.toLowerCase() === owner.toLowerCase());
  }
  
  /**
   * Berechnet Fees für Premium Upgrade
   */
  calculateUpgradeFee(walletId: string): bigint {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.isPremium) return 0n;
    
    return this.PREMIUM_FEE - this.SETUP_FEE; // Pay difference
  }
  
  /**
   * Statistiken
   */
  getStats(): {
    totalWallets: number;
    premiumWallets: number;
    totalSessionKeys: number;
    estimatedRevenue: bigint;
  } {
    const wallets = Array.from(this.wallets.values());
    const sessionKeys = Array.from(this.sessionKeys.values());
    
    let revenue = 0n;
    wallets.forEach(w => {
      revenue += w.isPremium ? this.PREMIUM_FEE : this.SETUP_FEE;
    });
    revenue += BigInt(sessionKeys.length) * this.SESSION_KEY_FEE;
    
    return {
      totalWallets: wallets.length,
      premiumWallets: wallets.filter(w => w.isPremium).length,
      totalSessionKeys: sessionKeys.length,
      estimatedRevenue: revenue
    };
  }
}

export interface PaymentInvoice {
  id: string;
  walletId: string;
  sessionKeyId?: string;
  amount: bigint;
  token: string;
  description: string;
  status: 'pending' | 'paid' | 'expired';
  createdAt?: number;
}

export default WalletManager;
