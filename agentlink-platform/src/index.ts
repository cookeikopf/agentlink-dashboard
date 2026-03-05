/**
 * AgentLink Platform
 * 
 * One-Stop Plattform für KI-Agenten
 * x402-Integration | A2A Messaging | Full Lifecycle
 */

// Core Components
export { WalletManager, SessionKey, AgentWallet, Permission } from './wallet-manager.js';
export { TaskOrchestrator, Workflow, WorkflowStep, SubAgent, AgentType } from './orchestrator.js';
export { APIGateway, APIEndpoint, APIUsage } from './api-gateway.js';
export { Marketplace, AgentListing, JobRequest, Match, Escrow } from './marketplace.js';
export { ReputationSystem, ReputationProfile, TransactionRecord, Review } from './reputation.js';
export { AnalyticsDashboard, PlatformMetrics, PredictiveInsight } from './analytics.js';
export { AgentLinkSDK, SDKConfig, Task, Workflow as SDKWorkflow } from './sdk.js';

// Version
export const VERSION = '0.1.0';
export const PLATFORM_NAME = 'AgentLink Platform';

// Fee Structure
export const FEES = {
  // Wallet & Identity
  SETUP_FEE: 2000000n,           // 2 USDC
  PREMIUM_WALLET: 50000000n,     // 50 USDC/year
  SESSION_KEY: 100000n,          // 0.1 USDC
  
  // Task Orchestration
  WORKFLOW_FEE: 500000n,         // 0.5 USDC per workflow
  ORCHESTRATOR_PERCENT: 10,      // 10% of total
  
  // API Gateway
  PLATFORM_FEE_PERCENT: 5,       // 5% of API revenue
  
  // Marketplace
  LISTING_FEE: 5000000n,         // 5 USDC/month
  PREMIUM_LISTING: 25000000n,    // 25 USDC/month
  MATCH_FEE_PERCENT: 2,          // 2% of job value
  VERIFICATION_FEE: 10000000n,   // 10 USDC one-time
  DISPUTE_FEE_PERCENT: 1,        // 1% dispute fee
  
  // Analytics
  SUBSCRIPTION_BASIC: 0n,        // Free
  SUBSCRIPTION_PRO: 10000000n,   // 10 USDC/month
  SUBSCRIPTION_ENTERPRISE: 50000000n // 50 USDC/month
} as const;

// Networks
export const NETWORKS = {
  BASE_SEPOLIA: {
    id: 84532,
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  },
  BASE_MAINNET: {
    id: 8453,
    name: 'Base Mainnet',
    rpc: 'https://mainnet.base.org',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  }
} as const;

// Export all types
export * from './wallet-manager.js';
export * from './orchestrator.js';
export * from './api-gateway.js';
export * from './marketplace.js';
export * from './reputation.js';
export * from './analytics.js';
export * from './sdk.js';
