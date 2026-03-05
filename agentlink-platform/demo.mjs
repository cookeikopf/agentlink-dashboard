#!/usr/bin/env node
/**
 * AgentLink Platform Demo
 * 
 * Zeigt alle Features der One-Stop Platform
 */

import { 
  WalletManager, 
  TaskOrchestrator, 
  APIGateway, 
  Marketplace, 
  ReputationSystem, 
  AnalyticsDashboard,
  AgentLinkSDK,
  FEES
} from './src/index.js';

console.clear();
console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           🚀 AGENTLINK PLATFORM DEMO                              ║
╠══════════════════════════════════════════════════════════════════╣
║  One-Stop Plattform für KI-Agenten mit x402-Integration         ║
╚══════════════════════════════════════════════════════════════════╝
`);

async function runDemo() {
  const results = [];
  
  // ═══════════════════════════════════════════════════════════
  // 1. WALLET & IDENTITY MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  console.log('\n💼 1. WALLET & IDENTITY MANAGEMENT');
  console.log('─'.repeat(60));
  
  const walletManager = new WalletManager();
  
  // Create wallet for Agent A
  const { wallet: walletA, invoice: invoiceA } = await walletManager.createWallet(
    '0xAgentA000000000000000000000000000000000001',
    'Data Analyzer Pro',
    false // Standard tier
  );
  
  console.log('✅ Agent A Wallet created:');
  console.log('   Address:', walletA.mainWallet.slice(0, 20) + '...');
  console.log('   DID:', walletA.did.slice(0, 40) + '...');
  console.log('   Setup Fee:', Number(FEES.SETUP_FEE) / 1_000_000, 'USDC');
  
  // Create premium wallet for Agent B
  const { wallet: walletB, invoice: invoiceB } = await walletManager.createWallet(
    '0xAgentB000000000000000000000000000000000002',
    'Security Guardian',
    true // Premium tier
  );
  
  console.log('\n✅ Agent B Premium Wallet created:');
  console.log('   Address:', walletB.mainWallet.slice(0, 20) + '...');
  console.log('   Premium Fee:', Number(FEES.PREMIUM_WALLET) / 1_000_000, 'USDC/year');
  
  // Create session key
  const { sessionKey, invoice: keyInvoice } = await walletManager.createSessionKey(
    walletA.id,
    [
      { type: 'contract', target: '0xPaymentContract', actions: ['execute'] },
      { type: 'token', target: 'USDC', actions: ['transfer'] }
    ],
    5000000n, // 5 USDC limit
    3600 // 1 hour
  );
  
  console.log('\n✅ Session Key created:');
  console.log('   Address:', sessionKey.address.slice(0, 20) + '...');
  console.log('   Spend Limit:', Number(sessionKey.spendLimit) / 1_000_000, 'USDC');
  console.log('   Valid Until:', new Date(sessionKey.validUntil * 1000).toLocaleString());
  console.log('   Fee:', Number(FEES.SESSION_KEY) / 1_000_000, 'USDC');
  
  const walletStats = walletManager.getStats();
  console.log('\n📊 Wallet Stats:');
  console.log('   Total Wallets:', walletStats.totalWallets);
  console.log('   Premium Wallets:', walletStats.premiumWallets);
  console.log('   Revenue:', Number(walletStats.estimatedRevenue) / 1_000_000, 'USDC');
  
  results.push({ module: 'Wallet', revenue: walletStats.estimatedRevenue });
  
  // ═══════════════════════════════════════════════════════════
  // 2. TASK ORCHESTRATOR
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n🎭 2. TASK ORCHESTRATOR');
  console.log('─'.repeat(60));
  
  const orchestrator = new TaskOrchestrator();
  
  // Event listeners
  orchestrator.on('workflowCreated', (wf, inv) => {
    console.log('   → Workflow created:', wf.name);
  });
  orchestrator.on('stepCompleted', (wf, step, agent) => {
    console.log('   → Step completed:', step.type, 'by', agent.name);
  });
  orchestrator.on('workflowCompleted', (wf) => {
    console.log('   → Workflow completed!');
  });
  
  // Create development workflow
  const { workflow, invoice: wfInvoice } = await orchestrator.createWorkflow(
    '0xClient000000000000000000000000000000000001',
    'Smart Contract Development',
    'Develop and deploy a DeFi contract',
    [
      { type: 'debugger', input: { code: 'contract.sol' } },
      { type: 'auditor', input: { code: 'contract.sol' } },
      { type: 'tester', input: { code: 'contract.sol' } },
      { type: 'deployer', input: { code: 'contract.sol' } }
    ],
    10000000n // 10 USDC budget
  );
  
  console.log('✅ Development Workflow created:');
  console.log('   ID:', workflow.id);
  console.log('   Steps:', workflow.steps.length);
  console.log('   Budget:', Number(workflow.totalBudget) / 1_000_000, 'USDC');
  console.log('   Total Cost:', Number(wfInvoice.amount) / 1_000_000, 'USDC');
  
  // Start workflow
  await orchestrator.startWorkflow(workflow.id);
  await new Promise(r => setTimeout(r, 5000)); // Wait for execution
  
  const orchStats = orchestrator.getStats();
  console.log('\n📊 Orchestrator Stats:');
  console.log('   Total Workflows:', orchStats.totalWorkflows);
  console.log('   Completed:', orchStats.completedWorkflows);
  console.log('   Revenue:', Number(orchStats.totalRevenue) / 1_000_000, 'USDC');
  
  results.push({ module: 'Orchestrator', revenue: orchStats.totalRevenue });
  
  // ═══════════════════════════════════════════════════════════
  // 3. API GATEWAY
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n🌐 3. API GATEWAY');
  console.log('─'.repeat(60));
  
  const apiGateway = new APIGateway();
  
  console.log('✅ API Gateway initialized');
  console.log('   Endpoints:', 7);
  
  // Show available endpoints
  const endpoints = [
    { id: 'aave-rates', price: '0.01 USDC', path: '/api/aave/rates' },
    { id: 'weather-current', price: '0.005 USDC', path: '/api/weather/current' },
    { id: 'ai-completion', price: '0.05 USDC', path: '/api/ai/completion' },
    { id: 'crypto-price', price: '0.005 USDC', path: '/api/crypto/price' }
  ];
  
  console.log('\n   Available Endpoints:');
  endpoints.forEach(ep => {
    console.log(`   • ${ep.path} → ${ep.price}`);
  });
  
  const apiStats = apiGateway.getUsageStats();
  console.log('\n📊 API Stats:');
  console.log('   Total Calls:', apiStats.totalCalls);
  console.log('   Revenue:', Number(apiStats.totalRevenue) / 1_000_000, 'USDC');
  
  results.push({ module: 'API Gateway', revenue: apiStats.totalRevenue });
  
  // ═══════════════════════════════════════════════════════════
  // 4. DISCOVERY MARKETPLACE
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n🏪 4. DISCOVERY MARKETPLACE');
  console.log('─'.repeat(60));
  
  const marketplace = new Marketplace();
  
  // Create agent listing
  const { listing: listingA, invoice: listingInvoiceA } = await marketplace.createListing(
    '0xAgentA000000000000000000000000000000000001',
    {
      address: '0xAgentA000000000000000000000000000000000001',
      name: 'Data Analyzer Pro',
      description: 'Advanced data analysis and visualization',
      category: 'data',
      skills: [
        { name: 'Python', level: 'expert', verified: true, endorsements: 15 },
        { name: 'Machine Learning', level: 'expert', verified: true, endorsements: 10 }
      ],
      portfolio: [],
      pricing: { minPrice: 1000000n, maxPrice: 10000000n, currency: 'USDC' },
      availability: 'available',
      isVerified: false,
      isPremium: false
    }
  );
  
  console.log('✅ Agent A listed on Marketplace:');
  console.log('   Listing Fee:', Number(FEES.LISTING_FEE) / 1_000_000, 'USDC/month');
  
  // Post job
  const job = await marketplace.postJob(
    '0xClient000000000000000000000000000000000001',
    {
      title: 'Analyze DeFi Data',
      description: 'Need analysis of Aave lending data',
      category: 'data',
      requiredSkills: ['Python', 'DeFi'],
      budget: { min: 2000000n, max: 5000000n, currency: 'USDC' },
      deadline: Date.now() + 7 * 24 * 60 * 60 * 1000
    }
  );
  
  console.log('\n✅ Job posted:');
  console.log('   Title:', job.title);
  console.log('   Budget:', Number(job.budget.max) / 1_000_000, 'USDC');
  
  // Find matches
  const matches = await marketplace.findMatches(job);
  console.log('\n✅ Matches found:', matches.length);
  matches.forEach(m => {
    console.log(`   • Score: ${m.score}%`);
  });
  
  // Accept match
  const { escrow, invoice: matchInvoice } = await marketplace.acceptMatch(
    matches[0].id,
    job.client
  );
  
  console.log('\n✅ Match accepted:');
  console.log('   Escrow Amount:', Number(escrow.amount) / 1_000_000, 'USDC');
  console.log('   Match Fee (2%):', Number(matchInvoice.amount) / 1_000_000, 'USDC');
  
  // Complete job
  await marketplace.completeJob(escrow.id);
  
  const marketStats = marketplace.getStats();
  console.log('\n📊 Marketplace Stats:');
  console.log('   Total Listings:', marketStats.totalListings);
  console.log('   Total Jobs:', marketStats.totalJobs);
  console.log('   Total Volume:', Number(marketStats.totalVolume) / 1_000_000, 'USDC');
  console.log('   Platform Revenue:', Number(marketStats.platformRevenue) / 1_000_000, 'USDC');
  
  results.push({ module: 'Marketplace', revenue: marketStats.platformRevenue });
  
  // ═══════════════════════════════════════════════════════════
  // 5. REPUTATION SYSTEM
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n⭐ 5. REPUTATION SYSTEM');
  console.log('─'.repeat(60));
  
  const reputation = new ReputationSystem();
  
  // Record transactions
  reputation.recordTransaction({
    type: 'payment_received',
    counterparty: '0xClient000000000000000000000000000000000001',
    amount: 5000000n,
    token: 'USDC',
    status: 'success',
    timestamp: Date.now()
  });
  
  // Add review
  reputation.addReview(
    '0xAgentA000000000000000000000000000000000001',
    '0xClient000000000000000000000000000000000001',
    {
      rating: 5,
      categories: { quality: 5, communication: 5, punctuality: 5, value: 4 },
      comment: 'Excellent work! Delivered on time.',
      verified: true
    }
  );
  
  // Stake tokens
  await reputation.stake('0xAgentA000000000000000000000000000000000001', 100000000n);
  
  const profile = reputation.getProfile('0xAgentA000000000000000000000000000000000001');
  
  console.log('✅ Reputation Profile:');
  console.log('   Overall:', profile.overall, '/ 100');
  console.log('   Trustworthiness:', profile.trustworthiness);
  console.log('   Expertise:', profile.expertise);
  console.log('   Staked:', Number(profile.staked.amount) / 1_000_000, 'USDC');
  
  const repStats = reputation.getStats();
  console.log('\n📊 Reputation Stats:');
  console.log('   Total Profiles:', repStats.totalProfiles);
  console.log('   Average Reputation:', repStats.averageReputation);
  console.log('   Total Staked:', Number(repStats.totalStaked) / 1_000_000, 'USDC');
  
  results.push({ module: 'Reputation', revenue: 0n });
  
  // ═══════════════════════════════════════════════════════════
  // 6. ANALYTICS DASHBOARD
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n📊 6. ANALYTICS DASHBOARD');
  console.log('─'.repeat(60));
  
  const analytics = new AnalyticsDashboard();
  
  // Track transactions
  analytics.trackTransaction(10000000n, true, 'transactions');
  analytics.trackTransaction(5000000n, true, 'match_fees');
  analytics.trackTransaction(2000000n, true, 'listing_fees');
  
  // Generate insights
  const insights = analytics.generateInsights();
  
  console.log('✅ Analytics initialized');
  console.log('   Transactions tracked:', 3);
  console.log('   Insights generated:', insights.length);
  
  insights.forEach(insight => {
    console.log(`\n   ${insight.type.toUpperCase()}: ${insight.title}`);
    console.log(`   Confidence: ${insight.confidence}% | Impact: ${insight.impact}`);
  });
  
  // Subscribe to Pro tier
  const { invoice: subInvoice } = analytics.subscribe(
    '0xClient000000000000000000000000000000000001',
    'pro'
  );
  
  console.log('\n✅ Pro Subscription:');
  console.log('   Price:', Number(subInvoice.amount) / 1_000_000, 'USDC/month');
  
  const analyticsStats = analytics.getStats();
  console.log('\n📊 Analytics Stats:');
  console.log('   Subscribers:', analyticsStats.totalSubscribers);
  console.log('   Revenue:', Number(analyticsStats.revenueFromSubscriptions) / 1_000_000, 'USDC');
  
  results.push({ module: 'Analytics', revenue: analyticsStats.revenueFromSubscriptions });
  
  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('📈 PLATFORM REVENUE SUMMARY');
  console.log('═'.repeat(60));
  
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0n);
  
  results.forEach(r => {
    console.log(`   ${r.module.padEnd(15)} ${(Number(r.revenue) / 1_000_000).toFixed(2).padStart(10)} USDC`);
  });
  
  console.log('   ' + '─'.repeat(40));
  console.log(`   ${'TOTAL'.padEnd(15)} ${(Number(totalRevenue) / 1_000_000).toFixed(2).padStart(10)} USDC`);
  
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           ✅ DEMO COMPLETED SUCCESSFULLY!                         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  🎯 ALL MODULES FUNCTIONAL:                                      ║
║                                                                  ║
║  ✓ Wallet & Identity    - Setup fees, Session keys               ║
║  ✓ Task Orchestrator    - Workflow automation                    ║
║  ✓ API Gateway          - x402 micropayments                     ║
║  ✓ Discovery Marketplace - Listing & match fees                  ║
║  ✓ Reputation System    - On-chain scoring, Staking              ║
║  ✓ Analytics Dashboard  - Real-time metrics, Subscriptions       ║
║                                                                  ║
║  💰 MONETIZATION MODELS:                                         ║
║                                                                  ║
║  • Transaction Fees:    1-2% per payment                         ║
║  • Setup Fees:          2-100 USDC                               ║
║  • Subscription:        0-50 USDC/month                          ║
║  • Listing Fees:        5-25 USDC/month                          ║
║  • Match Fees:          2% of job value                          ║
║  • API Calls:           0.005-0.05 USDC per call                 ║
║                                                                  ║
║  🚀 AGENTLINK PLATFORM IS READY!                                 ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

runDemo().catch(console.error);
