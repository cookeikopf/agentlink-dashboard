/**
 * Marketplace Repository
 * 
 * Database operations for Listings, Jobs, Matches, Escrow
 * Replaces in-memory Map storage
 */

import { prisma } from '../client.js';
import type { 
  AgentListing, 
  JobRequest, 
  Match, 
  Escrow,
  Skill,
  PortfolioItem 
} from '../../types.js';

export class MarketplaceRepository {
  
  // ========== Listings ==========
  
  async createListing(data: {
    walletId: string;
    name: string;
    description: string;
    category: string;
    minPrice: bigint;
    maxPrice: bigint;
    currency: string;
  }): Promise<AgentListing> {
    const listing = await prisma.agentListing.create({
      data: {
        walletId: data.walletId,
        name: data.name,
        description: data.description,
        category: data.category,
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        currency: data.currency,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });
    
    return this.mapListingToDomain(listing);
  }
  
  async getListing(id: string): Promise<(AgentListing & { skills: Skill[], portfolio: PortfolioItem[] }) | null> {
    const listing = await prisma.agentListing.findUnique({
      where: { id },
      include: { skills: true, portfolio: true }
    });
    
    if (!listing) return null;
    
    return {
      ...this.mapListingToDomain(listing),
      skills: listing.skills.map(s => this.mapSkillToDomain(s)),
      portfolio: listing.portfolio.map(p => this.mapPortfolioToDomain(p))
    };
  }
  
  async searchListings(filters: {
    category?: string;
    minReputation?: number;
    maxPrice?: bigint;
    availableOnly?: boolean;
    verifiedOnly?: boolean;
    skills?: string[];
  }): Promise<AgentListing[]> {
    const where: any = {};
    
    if (filters.category) where.category = filters.category;
    if (filters.minReputation) where.reputationOverall = { gte: filters.minReputation };
    if (filters.maxPrice) where.minPrice = { lte: filters.maxPrice };
    if (filters.availableOnly) where.availability = 'available';
    if (filters.verifiedOnly) where.isVerified = true;
    
    const listings = await prisma.agentListing.findMany({
      where,
      orderBy: { reputationOverall: 'desc' },
      include: { skills: true }
    });
    
    return listings.map(l => ({
      ...this.mapListingToDomain(l),
      skills: l.skills.map(s => this.mapSkillToDomain(s))
    }));
  }
  
  async addSkill(listingId: string, skill: { name: string; level: string; verified?: boolean }): Promise<Skill> {
    const created = await prisma.skill.create({
      data: {
        listingId,
        name: skill.name,
        level: skill.level,
        verified: skill.verified ?? false
      }
    });
    
    return this.mapSkillToDomain(created);
  }
  
  // ========== Jobs ==========
  
  async createJob(data: {
    clientId: string;
    title: string;
    description: string;
    category: string;
    budgetMin: bigint;
    budgetMax: bigint;
    currency: string;
    deadline: Date;
    requiredSkills: string[];
  }): Promise<JobRequest> {
    const job = await prisma.jobRequest.create({
      data: {
        clientId: data.clientId,
        title: data.title,
        description: data.description,
        category: data.category,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        currency: data.currency,
        deadline: data.deadline,
        requiredSkills: {
          create: data.requiredSkills.map(name => ({ name }))
        }
      },
      include: { requiredSkills: true }
    });
    
    return this.mapJobToDomain(job);
  }
  
  async getJob(id: string): Promise<(JobRequest & { requiredSkills: string[] }) | null> {
    const job = await prisma.jobRequest.findUnique({
      where: { id },
      include: { requiredSkills: true }
    });
    
    if (!job) return null;
    
    return {
      ...this.mapJobToDomain(job),
      requiredSkills: job.requiredSkills.map(s => s.name)
    };
  }
  
  async getOpenJobs(): Promise<JobRequest[]> {
    const jobs = await prisma.jobRequest.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' }
    });
    
    return jobs.map(j => this.mapJobToDomain(j));
  }
  
  // ========== Matches ==========
  
  async createMatch(data: {
    jobId: string;
    listingId: string;
    score: number;
    proposedPrice: bigint;
  }): Promise<Match> {
    const match = await prisma.match.create({
      data: {
        jobId: data.jobId,
        listingId: data.listingId,
        score: data.score,
        proposedPrice: data.proposedPrice
      }
    });
    
    return this.mapMatchToDomain(match);
  }
  
  async updateMatchStatus(id: string, status: string): Promise<void> {
    await prisma.match.update({
      where: { id },
      data: { status }
    });
  }
  
  // ========== Escrow ==========
  
  async createEscrow(data: {
    matchId: string;
    amount: bigint;
    token: string;
    milestones: any[];
  }): Promise<Escrow> {
    const escrow = await prisma.escrow.create({
      data: {
        matchId: data.matchId,
        amount: data.amount,
        token: data.token,
        milestones: data.milestones as any
      }
    });
    
    return this.mapEscrowToDomain(escrow);
  }
  
  async releaseEscrow(id: string): Promise<void> {
    await prisma.escrow.update({
      where: { id },
      data: { 
        status: 'completed',
        releasedAt: new Date()
      }
    });
  }
  
  // ========== Statistics ==========
  
  async getStats(): Promise<{
    totalListings: number;
    totalJobs: number;
    completedJobs: number;
    totalEscrow: bigint;
  }> {
    const [totalListings, totalJobs, completedJobs, escrowAgg] = await Promise.all([
      prisma.agentListing.count(),
      prisma.jobRequest.count(),
      prisma.jobRequest.count({ where: { status: 'completed' } }),
      prisma.escrow.aggregate({
        where: { status: 'funded' },
        _sum: { amount: true }
      })
    ]);
    
    return {
      totalListings,
      totalJobs,
      completedJobs,
      totalEscrow: escrowAgg._sum.amount ?? 0n
    };
  }
  
  // ========== Mappers ==========
  
  private mapListingToDomain(l: any): AgentListing {
    return {
      id: l.id,
      address: l.walletId as `0x${string}`,
      name: l.name,
      description: l.description,
      category: l.category as any,
      skills: [],
      portfolio: [],
      pricing: {
        minPrice: BigInt(l.minPrice.toString()),
        maxPrice: BigInt(l.maxPrice.toString()),
        currency: l.currency
      },
      availability: l.availability as any,
      reputation: {
        overall: l.reputationOverall,
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
      isVerified: l.isVerified,
      isPremium: l.isPremium,
      createdAt: l.createdAt.getTime(),
      expiresAt: l.expiresAt?.getTime() ?? 0
    };
  }
  
  private mapSkillToDomain(s: any): Skill {
    return {
      name: s.name,
      level: s.level as any,
      verified: s.verified,
      endorsements: s.endorsements
    };
  }
  
  private mapPortfolioToDomain(p: any): PortfolioItem {
    return {
      title: p.title,
      description: p.description,
      url: p.url ?? undefined,
      completedAt: p.completedAt.getTime(),
      clientRating: p.clientRating ?? undefined
    };
  }
  
  private mapJobToDomain(j: any): JobRequest {
    return {
      id: j.id,
      client: j.clientId as `0x${string}`,
      title: j.title,
      description: j.description,
      category: j.category as any,
      requiredSkills: [],
      budget: {
        min: BigInt(j.budgetMin.toString()),
        max: BigInt(j.budgetMax.toString()),
        currency: j.currency
      },
      deadline: j.deadline.getTime(),
      status: j.status as any,
      createdAt: j.createdAt.getTime()
    };
  }
  
  private mapMatchToDomain(m: any): Match {
    return {
      id: m.id,
      jobId: m.jobId,
      agentAddress: m.listingId as `0x${string}`,
      score: m.score,
      proposedPrice: BigInt(m.proposedPrice.toString()),
      status: m.status as any,
      createdAt: m.createdAt.getTime()
    };
  }
  
  private mapEscrowToDomain(e: any): Escrow {
    return {
      id: e.id,
      jobId: e.matchId,
      matchId: e.matchId,
      amount: BigInt(e.amount.toString()),
      client: '' as `0x${string}`, // Populated from match
      agent: '' as `0x${string}`, // Populated from match
      status: e.status as any,
      milestones: e.milestones as any,
      createdAt: e.createdAt.getTime(),
      releasedAt: e.releasedAt?.getTime()
    };
  }
}

export const marketplaceRepository = new MarketplaceRepository();
