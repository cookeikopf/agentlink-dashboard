/**
 * AgentLink Reputation System
 * 
 * On-Chain Reputation mit Erfolgsrate und Tx-History
 * Monetarisierung: Dispute Fees
 */

import EventEmitter from 'events';

// On-Chain Reputation Score
export interface ReputationProfile {
  address: `0x${string}`;
  overall: number;              // 0-100
  trustworthiness: number;      // 0-100
  expertise: number;            // 0-100
  punctuality: number;          // 0-100
  communication: number;        // 0-100
  
  // Detailed Stats
  stats: {
    totalTransactions: number;
    successfulTransactions: number;
    disputedTransactions: number;
    totalVolume: bigint;
    totalEarned: bigint;
    totalSpent: bigint;
    averageJobValue: bigint;
    responseTime: number;       // Average in minutes
    onTimeDelivery: number;     // Percentage
  };
  
  // Historical Data
  history: TransactionRecord[];
  reviews: Review[];
  
  // Staking
  staked: {
    amount: bigint;
    since: number;
    unlockAt: number;
  };
  
  // Verifications
  verifications: Verification[];
  
  // Last Updated
  updatedAt: number;
}

export interface TransactionRecord {
  id: string;
  type: 'payment_sent' | 'payment_received' | 'service_provided' | 'service_consumed';
  counterparty: `0x${string}`;
  amount: bigint;
  token: string;
  status: 'success' | 'disputed' | 'refunded';
  timestamp: number;
  rating?: number;              // 1-5 stars
  review?: string;
}

export interface Review {
  id: string;
  reviewer: `0x${string}`;
  rating: number;               // 1-5
  categories: {
    quality: number;
    communication: number;
    punctuality: number;
    value: number;
  };
  comment: string;
  timestamp: number;
  verified: boolean;            // Verified transaction
}

export interface Verification {
  type: 'kyc' | 'skill_test' | 'identity' | 'business';
  provider: string;
  verifiedAt: number;
  expiresAt?: number;
  metadata?: any;
}

// Reputation Calculation Weights
const REPUTATION_WEIGHTS = {
  transactionSuccess: 0.25,
  volume: 0.20,
  reviews: 0.20,
  staking: 0.15,
  verification: 0.10,
  longevity: 0.10
};

export class ReputationSystem extends EventEmitter {
  private profiles: Map<`0x${string}`, ReputationProfile> = new Map();
  
  // Staking Configuration
  private readonly MIN_STAKE = 100000000n; // 100 USDC
  private readonly STAKE_LOCK_PERIOD = 30 * 24 * 60 * 60; // 30 days
  
  constructor() {
    super();
  }
  
  /**
   * Erstellt oder holt Reputation Profile
   */
  getProfile(address: `0x${string}`): ReputationProfile {
    let profile = this.profiles.get(address);
    
    if (!profile) {
      profile = this.createDefaultProfile(address);
      this.profiles.set(address, profile);
    }
    
    return profile;
  }
  
  /**
   * Erstellt Default Profile
   */
  private createDefaultProfile(address: `0x${string}`): ReputationProfile {
    return {
      address,
      overall: 50, // Start neutral
      trustworthiness: 50,
      expertise: 50,
      punctuality: 50,
      communication: 50,
      stats: {
        totalTransactions: 0,
        successfulTransactions: 0,
        disputedTransactions: 0,
        totalVolume: 0n,
        totalEarned: 0n,
        totalSpent: 0n,
        averageJobValue: 0n,
        responseTime: 0,
        onTimeDelivery: 0
      },
      history: [],
      reviews: [],
      staked: {
        amount: 0n,
        since: 0,
        unlockAt: 0
      },
      verifications: [],
      updatedAt: Date.now()
    };
  }
  
  /**
   * Zeichnet Transaction auf
   */
  recordTransaction(record: Omit<TransactionRecord, 'id'>): TransactionRecord {
    const address = record.type.includes('sent') || record.type === 'service_consumed'
      ? record.counterparty  // For sent/consumed, we track the sender
      : record.counterparty; // This would be different in real implementation
    
    const profile = this.getProfile(address);
    
    const tx: TransactionRecord = {
      ...record,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };
    
    profile.history.push(tx);
    
    // Update stats
    profile.stats.totalTransactions++;
    profile.stats.totalVolume += record.amount;
    
    if (record.status === 'success') {
      profile.stats.successfulTransactions++;
    } else if (record.status === 'disputed') {
      profile.stats.disputedTransactions++;
    }
    
    if (record.type === 'payment_received' || record.type === 'service_provided') {
      profile.stats.totalEarned += record.amount;
    } else {
      profile.stats.totalSpent += record.amount;
    }
    
    // Recalculate reputation
    this.recalculateReputation(profile);
    
    this.emit('transactionRecorded', address, tx);
    
    return tx;
  }
  
  /**
   * Fügt Review hinzu
   */
  addReview(
    agentAddress: `0x${string}`,
    reviewerAddress: `0x${string}`,
    reviewData: Omit<Review, 'id' | 'reviewer' | 'timestamp' | 'verified'>
  ): Review {
    const profile = this.getProfile(agentAddress);
    
    // Verify reviewer had transaction with agent
    const hadTransaction = profile.history.some(tx => 
      tx.counterparty === reviewerAddress && tx.status === 'success'
    );
    
    const review: Review = {
      ...reviewData,
      id: `review-${Date.now()}`,
      reviewer: reviewerAddress,
      timestamp: Date.now(),
      verified: hadTransaction
    };
    
    profile.reviews.push(review);
    
    // Recalculate reputation
    this.recalculateReputation(profile);
    
    this.emit('reviewAdded', agentAddress, review);
    
    return review;
  }
  
  /**
   * Staked Tokens für Reputation Boost
   */
  async stake(
    address: `0x${string}`,
    amount: bigint
  ): Promise<{ success: boolean; unlockAt: number }> {
    if (amount < this.MIN_STAKE) {
      throw new Error(`Minimum stake is ${formatUSDC(this.MIN_STAKE)}`);
    }
    
    const profile = this.getProfile(address);
    
    profile.staked = {
      amount: profile.staked.amount + amount,
      since: Date.now(),
      unlockAt: Date.now() + this.STAKE_LOCK_PERIOD * 1000
    };
    
    // Recalculate reputation
    this.recalculateReputation(profile);
    
    this.emit('staked', address, amount);
    
    return { 
      success: true, 
      unlockAt: profile.staked.unlockAt 
    };
  }
  
  /**
   * Unstaked Tokens
   */
  async unstake(address: `0x${string}`): Promise<{ amount: bigint }> {
    const profile = this.getProfile(address);
    
    if (profile.staked.amount === 0n) {
      throw new Error('No stake found');
    }
    
    if (Date.now() < profile.staked.unlockAt) {
      throw new Error('Stake still locked');
    }
    
    const amount = profile.staked.amount;
    
    profile.staked = {
      amount: 0n,
      since: 0,
      unlockAt: 0
    };
    
    // Recalculate reputation (will decrease)
    this.recalculateReputation(profile);
    
    this.emit('unstaked', address, amount);
    
    return { amount };
  }
  
  /**
   * Fügt Verifikation hinzu
   */
  addVerification(
    address: `0x${string}`,
    verification: Omit<Verification, 'verifiedAt'>
  ): void {
    const profile = this.getProfile(address);
    
    profile.verifications.push({
      ...verification,
      verifiedAt: Date.now()
    });
    
    // Recalculate reputation
    this.recalculateReputation(profile);
    
    this.emit('verified', address, verification);
  }
  
  /**
   * Berechnet Reputation neu
   */
  private recalculateReputation(profile: ReputationProfile): void {
    const { stats, reviews, staked, verifications, updatedAt } = profile;
    
    // 1. Transaction Success Score (0-100)
    const successRate = stats.totalTransactions > 0 
      ? (stats.successfulTransactions / stats.totalTransactions) * 100 
      : 50;
    
    // 2. Volume Score (logarithmic scale, max at 100k USDC)
    const volumeUSDC = Number(stats.totalVolume) / 1_000_000;
    const volumeScore = Math.min(Math.log10(volumeUSDC + 1) * 20, 100);
    
    // 3. Reviews Score (weighted average)
    let reviewScore = 50;
    if (reviews.length > 0) {
      const weightedSum = reviews.reduce((sum, r) => {
        const weight = r.verified ? 2 : 1;
        return sum + (r.rating * 20 * weight); // 5 stars = 100
      }, 0);
      const totalWeight = reviews.reduce((sum, r) => sum + (r.verified ? 2 : 1), 0);
      reviewScore = weightedSum / totalWeight;
    }
    
    // 4. Staking Score
    const stakedUSDC = Number(staked.amount) / 1_000_000;
    const stakingScore = Math.min((stakedUSDC / 100) * 100, 100); // Max at 100 USDC
    
    // 5. Verification Score
    const verificationScore = Math.min(verifications.length * 20, 100);
    
    // 6. Longevity Score (1% per month, max 100%)
    const monthsActive = (Date.now() - updatedAt) / (30 * 24 * 60 * 60 * 1000);
    const longevityScore = Math.min(monthsActive, 100);
    
    // Calculate overall with weights
    profile.overall = Math.round(
      successRate * REPUTATION_WEIGHTS.transactionSuccess +
      volumeScore * REPUTATION_WEIGHTS.volume +
      reviewScore * REPUTATION_WEIGHTS.reviews +
      stakingScore * REPUTATION_WEIGHTS.staking +
      verificationScore * REPUTATION_WEIGHTS.verification +
      longevityScore * REPUTATION_WEIGHTS.longevity
    );
    
    // Update component scores
    profile.trustworthiness = Math.round(
      successRate * 0.4 + stakingScore * 0.3 + verificationScore * 0.3
    );
    
    profile.expertise = Math.round(
      volumeScore * 0.3 + reviewScore * 0.4 + verificationScore * 0.3
    );
    
    profile.punctuality = Math.round(
      stats.onTimeDelivery * 0.7 + successRate * 0.3
    );
    
    profile.communication = Math.round(reviewScore);
    
    profile.updatedAt = Date.now();
  }
  
  /**
   * Holt Leaderboard
   */
  getLeaderboard(
    category: 'overall' | 'trustworthiness' | 'expertise' | 'volume' = 'overall',
    limit: number = 10
  ): ReputationProfile[] {
    const profiles = Array.from(this.profiles.values());
    
    profiles.sort((a, b) => {
      switch (category) {
        case 'trustworthiness':
          return b.trustworthiness - a.trustworthiness;
        case 'expertise':
          return b.expertise - a.expertise;
        case 'volume':
          return Number(b.stats.totalVolume - a.stats.totalVolume);
        default:
          return b.overall - a.overall;
      }
    });
    
    return profiles.slice(0, limit);
  }
  
  /**
   * Berechnet Trust Score für Transaction
   */
  calculateTrustScore(
    agentA: `0x${string}`,
    agentB: `0x${string}`,
    amount: bigint
  ): { safe: boolean; score: number; risk: 'low' | 'medium' | 'high' }> {
    const profileA = this.getProfile(agentA);
    const profileB = this.getProfile(agentB);
    
    // Calculate combined trust
    const avgReputation = (profileA.overall + profileB.overall) / 2;
    const minStake = Math.min(
      Number(profileA.staked.amount),
      Number(profileB.staked.amount)
    ) / 1_000_000;
    
    const amountUSDC = Number(amount) / 1_000_000;
    
    // Risk assessment
    let risk: 'low' | 'medium' | 'high';
    let safe: boolean;
    
    if (avgReputation >= 80 && minStake >= amountUSDC * 2) {
      risk = 'low';
      safe = true;
    } else if (avgReputation >= 60 && minStake >= amountUSDC) {
      risk = 'medium';
      safe = true;
    } else {
      risk = 'high';
      safe = false;
    }
    
    return { safe, score: avgReputation, risk };
  }
  
  /**
   * Statistiken
   */
  getStats(): {
    totalProfiles: number;
    averageReputation: number;
    totalVolume: bigint;
    totalStaked: bigint;
    verifiedProfiles: number;
  } {
    const profiles = Array.from(this.profiles.values());
    
    const avgReputation = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.overall, 0) / profiles.length
      : 0;
    
    const totalVolume = profiles.reduce((sum, p) => sum + p.stats.totalVolume, 0n);
    const totalStaked = profiles.reduce((sum, p) => sum + p.staked.amount, 0n);
    
    return {
      totalProfiles: profiles.length,
      averageReputation: Math.round(avgReputation),
      totalVolume,
      totalStaked,
      verifiedProfiles: profiles.filter(p => p.verifications.length > 0).length
    };
  }
}

// Helper
function formatUSDC(amount: bigint): string {
  return `${(Number(amount) / 1_000_000).toFixed(2)} USDC`;
}

export default ReputationSystem;
