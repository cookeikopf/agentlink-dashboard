/**
 * AgentLink Marketplace
 * 
 * Discovery Marketplace mit Agenten-Registry, Ratings und Skills
 * Monetarisierung: Listing Fees, Match Fees
 */

import EventEmitter from 'events';

// Agent Listing im Marketplace
export interface AgentListing {
  id: string;
  address: `0x${string}`;
  name: string;
  description: string;
  avatar?: string;
  category: AgentCategory;
  skills: Skill[];
  portfolio: PortfolioItem[];
  pricing: {
    minPrice: bigint;      // Minimum price per task
    maxPrice: bigint;      // Maximum price per task
    currency: string;      // USDC, ETH, etc.
  };
  availability: Availability;
  reputation: ReputationSummary;
  stats: AgentStats;
  isVerified: boolean;
  isPremium: boolean;
  createdAt: number;
  expiresAt: number;
}

export type AgentCategory = 
  | 'defi'
  | 'security'
  | 'coding'
  | 'design'
  | 'data'
  | 'marketing'
  | 'legal'
  | 'other';

export interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'expert';
  verified: boolean;
  endorsements: number;
}

export interface PortfolioItem {
  title: string;
  description: string;
  url?: string;
  completedAt: number;
  clientRating?: number;
}

export type Availability = 'available' | 'busy' | 'offline' | 'on_vacation';

export interface ReputationSummary {
  overall: number;         // 0-100
  reliability: number;     // 0-100
  quality: number;         // 0-100
  communication: number;   // 0-100
  onTimeDelivery: number;  // 0-100
}

export interface AgentStats {
  totalJobs: number;
  completedJobs: number;
  totalEarnings: bigint;
  responseTime: number;    // Average in minutes
  onTimeRate: number;      // Percentage
}

// Job Request
export interface JobRequest {
  id: string;
  client: `0x${string}`;
  title: string;
  description: string;
  category: AgentCategory;
  requiredSkills: string[];
  budget: {
    min: bigint;
    max: bigint;
    currency: string;
  };
  deadline: number;        // Unix timestamp
  status: JobStatus;
  createdAt: number;
}

export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

// Match zwischen Job und Agent
export interface Match {
  id: string;
  jobId: string;
  agentAddress: `0x${string}`;
  score: number;           // 0-100 matching score
  proposedPrice: bigint;
  status: MatchStatus;
  createdAt: number;
}

export type MatchStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

// Escrow für Jobs
export interface Escrow {
  id: string;
  jobId: string;
  matchId: string;
  amount: bigint;
  client: `0x${string}`;
  agent: `0x${string}`;
  status: EscrowStatus;
  milestones: Milestone[];
  createdAt: number;
  releasedAt?: number;
}

export type EscrowStatus = 'funded' | 'in_progress' | 'completed' | 'disputed' | 'refunded';

export interface Milestone {
  id: string;
  description: string;
  amount: bigint;
  status: 'pending' | 'completed' | 'paid';
  completedAt?: number;
}

export class Marketplace extends EventEmitter {
  private listings: Map<string, AgentListing> = new Map();
  private jobRequests: Map<string, JobRequest> = new Map();
  private matches: Map<string, Match> = new Map();
  private escrows: Map<string, Escrow> = new Map();
  
  // Fee Configuration
  private readonly LISTING_FEE = 5000000n;          // 5 USDC/month
  private readonly PREMIUM_LISTING_FEE = 25000000n; // 25 USDC/month
  private readonly MATCH_FEE_PERCENT = 2;           // 2% of job value
  private readonly VERIFICATION_FEE = 10000000n;    // 10 USDC one-time
  
  constructor() {
    super();
  }
  
  /**
   * Listet Agenten im Marketplace
   * Monetarisierung: Listing Fee
   */
  async createListing(
    address: `0x${string}`,
    listingData: Omit<AgentListing, 'id' | 'createdAt' | 'expiresAt' | 'reputation' | 'stats'>,
    isPremium: boolean = false
  ): Promise<{ listing: AgentListing; invoice: ListingInvoice }> {
    const listing: AgentListing = {
      ...listingData,
      id: `listing-${Date.now()}`,
      address,
      reputation: {
        overall: 50, // Start neutral
        reliability: 50,
        quality: 50,
        communication: 50,
        onTimeDelivery: 50
      },
      stats: {
        totalJobs: 0,
        completedJobs: 0,
        totalEarnings: 0n,
        responseTime: 0,
        onTimeRate: 0
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    };
    
    this.listings.set(listing.id, listing);
    
    const fee = isPremium ? this.PREMIUM_LISTING_FEE : this.LISTING_FEE;
    const invoice: ListingInvoice = {
      id: `inv-${Date.now()}`,
      listingId: listing.id,
      amount: fee,
      period: isPremium ? 'year' : 'month',
      status: 'pending'
    };
    
    this.emit('listingCreated', listing, invoice);
    
    return { listing, invoice };
  }
  
  /**
   * Verifiziert Agenten
   * Monetarisierung: Verification Fee
   */
  async verifyAgent(listingId: string): Promise<{ success: boolean; invoice: ListingInvoice }> {
    const listing = this.listings.get(listingId);
    if (!listing) throw new Error('Listing not found');
    if (listing.isVerified) throw new Error('Already verified');
    
    const invoice: ListingInvoice = {
      id: `inv-verify-${Date.now()}`,
      listingId,
      amount: this.VERIFICATION_FEE,
      description: 'Agent Verification',
      status: 'pending'
    };
    
    // In production: verification process
    listing.isVerified = true;
    
    this.emit('agentVerified', listing);
    
    return { success: true, invoice };
  }
  
  /**
   * Postet Job Request
   */
  async postJob(
    client: `0x${string}`,
    jobData: Omit<JobRequest, 'id' | 'client' | 'status' | 'createdAt'>
  ): Promise<JobRequest> {
    const job: JobRequest = {
      ...jobData,
      id: `job-${Date.now()}`,
      client,
      status: 'open',
      createdAt: Date.now()
    };
    
    this.jobRequests.set(job.id, job);
    
    // Auto-match mit geeigneten Agenten
    const matches = await this.findMatches(job);
    
    this.emit('jobPosted', job, matches);
    
    return job;
  }
  
  /**
   * Findet beste Matches für einen Job
   * Nutzt AI für Skill-Matching
   */
  async findMatches(job: JobRequest, limit: number = 5): Promise<Match[]> {
    const allListings = Array.from(this.listings.values())
      .filter(l => l.availability === 'available');
    
    // Calculate match score for each agent
    const scored = allListings.map(listing => {
      let score = 0;
      
      // Category match (30 points)
      if (listing.category === job.category) score += 30;
      
      // Skill match (40 points)
      const requiredSkills = job.requiredSkills;
      const agentSkills = listing.skills.map(s => s.name.toLowerCase());
      const matchedSkills = requiredSkills.filter(s => 
        agentSkills.includes(s.toLowerCase())
      );
      score += (matchedSkills.length / requiredSkills.length) * 40;
      
      // Reputation (20 points)
      score += (listing.reputation.overall / 100) * 20;
      
      // Availability (10 points)
      if (listing.availability === 'available') score += 10;
      
      // Premium bonus
      if (listing.isPremium) score += 5;
      
      // Verified bonus
      if (listing.isVerified) score += 5;
      
      return { listing, score: Math.min(score, 100) };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Create matches for top agents
    const matches: Match[] = scored.slice(0, limit).map(({ listing, score }) => ({
      id: `match-${Date.now()}-${listing.address.slice(-4)}`,
      jobId: job.id,
      agentAddress: listing.address,
      score,
      proposedPrice: job.budget.max,
      status: 'pending',
      createdAt: Date.now()
    }));
    
    matches.forEach(m => this.matches.set(m.id, m));
    
    return matches;
  }
  
  /**
   * Akzeptiert Match und erstellt Escrow
   * Monetarisierung: Match Fee
   */
  async acceptMatch(
    matchId: string,
    client: `0x${string}`
  ): Promise<{ escrow: Escrow; invoice: MatchInvoice }> {
    const match = this.matches.get(matchId);
    if (!match) throw new Error('Match not found');
    
    const job = this.jobRequests.get(match.jobId);
    if (!job) throw new Error('Job not found');
    
    if (job.client !== client) {
      throw new Error('Not authorized');
    }
    
    match.status = 'accepted';
    job.status = 'in_progress';
    
    // Create escrow
    const escrow: Escrow = {
      id: `escrow-${Date.now()}`,
      jobId: job.id,
      matchId: match.id,
      amount: match.proposedPrice,
      client,
      agent: match.agentAddress,
      status: 'funded',
      milestones: [{
        id: 'milestone-1',
        description: 'Complete job',
        amount: match.proposedPrice,
        status: 'pending'
      }],
      createdAt: Date.now()
    };
    
    this.escrows.set(escrow.id, escrow);
    
    // Calculate match fee
    const matchFee = (match.proposedPrice * BigInt(this.MATCH_FEE_PERCENT)) / 100n;
    
    const invoice: MatchInvoice = {
      id: `inv-match-${Date.now()}`,
      matchId,
      escrowId: escrow.id,
      amount: matchFee,
      percent: this.MATCH_FEE_PERCENT,
      status: 'pending'
    };
    
    this.emit('matchAccepted', match, escrow, invoice);
    
    return { escrow, invoice };
  }
  
  /**
   * Vervollständigt Job und released Payment
   */
  async completeJob(escrowId: string): Promise<void> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    
    escrow.status = 'completed';
    escrow.releasedAt = Date.now();
    escrow.milestones[0].status = 'paid';
    escrow.milestones[0].completedAt = Date.now();
    
    // Update agent stats
    const listing = Array.from(this.listings.values())
      .find(l => l.address === escrow.agent);
    
    if (listing) {
      listing.stats.completedJobs++;
      listing.stats.totalEarnings += escrow.amount;
    }
    
    this.emit('jobCompleted', escrow);
  }
  
  /**
   * Öffnet Dispute
   */
  async openDispute(escrowId: string, reason: string): Promise<void> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    
    escrow.status = 'disputed';
    
    this.emit('disputeOpened', escrow, reason);
  }
  
  /**
   * Löst Dispute auf
   * Monetarisierung: Dispute Fee
   */
  async resolveDispute(
    escrowId: string,
    resolution: 'client_wins' | 'agent_wins' | 'split'
  ): Promise<{ fee: bigint }> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    
    const disputeFee = escrow.amount / 100n; // 1% dispute fee
    
    switch (resolution) {
      case 'client_wins':
        escrow.status = 'refunded';
        break;
      case 'agent_wins':
        escrow.status = 'completed';
        break;
      case 'split':
        // Split amount
        break;
    }
    
    this.emit('disputeResolved', escrow, resolution);
    
    return { fee: disputeFee };
  }
  
  /**
   * Sucht Agenten
   */
  searchAgents(
    filters: {
      category?: AgentCategory;
      skills?: string[];
      minRating?: number;
      maxPrice?: bigint;
      availableOnly?: boolean;
      verifiedOnly?: boolean;
    }
  ): AgentListing[] {
    let results = Array.from(this.listings.values());
    
    if (filters.category) {
      results = results.filter(l => l.category === filters.category);
    }
    
    if (filters.skills?.length) {
      results = results.filter(l => 
        filters.skills!.some(skill => 
          l.skills.some(s => 
            s.name.toLowerCase().includes(skill.toLowerCase())
          )
        )
      );
    }
    
    if (filters.minRating) {
      results = results.filter(l => l.reputation.overall >= filters.minRating!);
    }
    
    if (filters.maxPrice) {
      results = results.filter(l => l.pricing.maxPrice <= filters.maxPrice!);
    }
    
    if (filters.availableOnly) {
      results = results.filter(l => l.availability === 'available');
    }
    
    if (filters.verifiedOnly) {
      results = results.filter(l => l.isVerified);
    }
    
    // Sort by reputation
    results.sort((a, b) => b.reputation.overall - a.reputation.overall);
    
    return results;
  }
  
  /**
   * Holt Listing Details
   */
  getListing(id: string): AgentListing | undefined {
    return this.listings.get(id);
  }
  
  /**
   * Holt Job Details
   */
  getJob(id: string): JobRequest | undefined {
    return this.jobRequests.get(id);
  }
  
  /**
   * Statistiken
   */
  getStats(): {
    totalListings: number;
    verifiedListings: number;
    premiumListings: number;
    totalJobs: number;
    completedJobs: number;
    totalVolume: bigint;
    platformRevenue: bigint;
  } {
    const listings = Array.from(this.listings.values());
    const jobs = Array.from(this.jobRequests.values());
    const escrows = Array.from(this.escrows.values());
    
    const totalVolume = escrows
      .filter(e => e.status === 'completed')
      .reduce((sum, e) => sum + e.amount, 0n);
    
    // Calculate revenue
    const listingRevenue = listings.filter(l => l.isPremium).length * Number(this.PREMIUM_LISTING_FEE)
      + (listings.length - listings.filter(l => l.isPremium).length) * Number(this.LISTING_FEE);
    
    const matchRevenue = escrows
      .filter(e => e.status === 'completed')
      .reduce((sum, e) => sum + (e.amount * BigInt(this.MATCH_FEE_PERCENT)) / 100n, 0n);
    
    return {
      totalListings: listings.length,
      verifiedListings: listings.filter(l => l.isVerified).length,
      premiumListings: listings.filter(l => l.isPremium).length,
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      totalVolume,
      platformRevenue: BigInt(listingRevenue) + matchRevenue
    };
  }
}

export interface ListingInvoice {
  id: string;
  listingId: string;
  amount: bigint;
  period?: string;
  description?: string;
  status: 'pending' | 'paid' | 'expired';
}

export interface MatchInvoice {
  id: string;
  matchId: string;
  escrowId: string;
  amount: bigint;
  percent: number;
  status: 'pending' | 'paid';
}

export default Marketplace;
