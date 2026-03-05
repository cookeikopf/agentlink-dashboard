/**
 * AgentLink Analytics Dashboard
 * 
 * Echtzeit-Metrics und Predictive Insights
 * Monetarisierung: Subscription Model
 */

import EventEmitter from 'events';

// Real-time Metrics
export interface PlatformMetrics {
  // Transaction Metrics
  transactions: {
    total24h: number;
    total7d: number;
    total30d: number;
    volume24h: bigint;
    volume7d: bigint;
    volume30d: bigint;
    averageValue: bigint;
    successRate: number;
  };
  
  // Agent Metrics
  agents: {
    total: number;
    active24h: number;
    new24h: number;
    averageReputation: number;
    topPerformers: AgentPerformance[];
  };
  
  // Revenue Metrics
  revenue: {
    total24h: bigint;
    total7d: bigint;
    total30d: bigint;
    bySource: Record<RevenueSource, bigint>;
    growthRate: number; // Percentage
  };
  
  // API Usage
  api: {
    totalCalls24h: number;
    uniqueUsers24h: number;
    topEndpoints: EndpointUsage[];
    averageLatency: number;
  };
  
  // Marketplace
  marketplace: {
    activeJobs: number;
    completedJobs24h: number;
    averageMatchTime: number; // Minutes
    totalEscrow: bigint;
  };
}

export interface AgentPerformance {
  address: `0x${string}`;
  name: string;
  reputation: number;
  transactions24h: number;
  earnings24h: bigint;
  growth: number; // Percentage vs previous period
}

export interface EndpointUsage {
  id: string;
  calls: number;
  revenue: bigint;
  averageLatency: number;
}

export type RevenueSource = 
  | 'transactions'
  | 'listing_fees'
  | 'match_fees'
  | 'api_calls'
  | 'premium_subscriptions'
  | 'verification_fees'
  | 'dispute_fees';

// Predictive Insights
export interface PredictiveInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  category: string;
  title: string;
  description: string;
  confidence: number; // 0-100
  impact: 'low' | 'medium' | 'high';
  suggestedAction?: string;
  data: any;
  createdAt: number;
}

// Historical Data Points
export interface DataPoint {
  timestamp: number;
  value: number;
  label: string;
}

export class AnalyticsDashboard extends EventEmitter {
  private metrics: PlatformMetrics;
  private insights: PredictiveInsight[] = [];
  private historicalData: Map<string, DataPoint[]> = new Map();
  
  // Subscription Configuration
  private readonly SUBSCRIPTION_TIERS = {
    basic: { price: 0n, features: ['metrics', 'charts'] },
    pro: { price: 10000000n, features: ['metrics', 'charts', 'insights', 'alerts'] }, // 10 USDC/mo
    enterprise: { price: 50000000n, features: ['all', 'api', 'custom'] } // 50 USDC/mo
  };
  
  private subscribers: Map<`0x${string}`, { tier: keyof typeof SUBSCRIPTION_TIERS; expiresAt: number }> = new Map();
  
  constructor() {
    super();
    this.metrics = this.initializeMetrics();
  }
  
  /**
   * Initialisiert Default Metrics
   */
  private initializeMetrics(): PlatformMetrics {
    return {
      transactions: {
        total24h: 0,
        total7d: 0,
        total30d: 0,
        volume24h: 0n,
        volume7d: 0n,
        volume30d: 0n,
        averageValue: 0n,
        successRate: 100
      },
      agents: {
        total: 0,
        active24h: 0,
        new24h: 0,
        averageReputation: 50,
        topPerformers: []
      },
      revenue: {
        total24h: 0n,
        total7d: 0n,
        total30d: 0n,
        bySource: {
          transactions: 0n,
          listing_fees: 0n,
          match_fees: 0n,
          api_calls: 0n,
          premium_subscriptions: 0n,
          verification_fees: 0n,
          dispute_fees: 0n
        },
        growthRate: 0
      },
      api: {
        totalCalls24h: 0,
        uniqueUsers24h: 0,
        topEndpoints: [],
        averageLatency: 0
      },
      marketplace: {
        activeJobs: 0,
        completedJobs24h: 0,
        averageMatchTime: 0,
        totalEscrow: 0n
      }
    };
  }
  
  /**
   * Aktualisiert Metrics
   */
  updateMetrics(partial: Partial<PlatformMetrics>): void {
    this.metrics = { ...this.metrics, ...partial };
    this.emit('metricsUpdated', this.metrics);
  }
  
  /**
   * Trackt Transaction
   */
  trackTransaction(
    amount: bigint,
    success: boolean,
    source: RevenueSource
  ): void {
    this.metrics.transactions.total24h++;
    this.metrics.transactions.volume24h += amount;
    
    // Calculate fee (1% for transactions)
    const fee = source === 'transactions' ? amount / 100n : amount;
    this.metrics.revenue.total24h += fee;
    this.metrics.revenue.bySource[source] += fee;
    
    // Update success rate
    const total = this.metrics.transactions.total24h;
    const successful = success 
      ? this.metrics.transactions.total24h - 1
      : this.metrics.transactions.total24h;
    this.metrics.transactions.successRate = (successful / total) * 100;
    
    // Store historical data
    this.addDataPoint('transactions', Date.now(), Number(amount));
    
    this.emit('transactionTracked', amount, success);
  }
  
  /**
   * Trackt API Call
   */
  trackAPICall(endpointId: string, latency: number, user: `0x${string}`): void {
    this.metrics.api.totalCalls24h++;
    
    // Update endpoint usage
    const existing = this.metrics.api.topEndpoints.find(e => e.id === endpointId);
    if (existing) {
      existing.calls++;
      existing.averageLatency = (existing.averageLatency + latency) / 2;
    } else {
      this.metrics.api.topEndpoints.push({
        id: endpointId,
        calls: 1,
        revenue: 0n,
        averageLatency: latency
      });
    }
    
    // Update average latency
    const totalCalls = this.metrics.api.totalCalls24h;
    this.metrics.api.averageLatency = 
      (this.metrics.api.averageLatency * (totalCalls - 1) + latency) / totalCalls;
    
    this.emit('apiCallTracked', endpointId, latency);
  }
  
  /**
   * Generiert Predictive Insights
   */
  generateInsights(): PredictiveInsight[] {
    const newInsights: PredictiveInsight[] = [];
    
    // 1. Volume Trend Analysis
    const volumeTrend = this.analyzeTrend('transactions');
    if (volumeTrend.direction === 'up' && volumeTrend.change > 50) {
      newInsights.push({
        id: `insight-${Date.now()}-1`,
        type: 'trend',
        category: 'volume',
        title: 'Transaction Volume Surge',
        description: `Transaction volume increased by ${volumeTrend.change.toFixed(1)}% in the last 24h.`,
        confidence: 85,
        impact: 'high',
        suggestedAction: 'Consider scaling infrastructure to handle increased load.',
        data: volumeTrend,
        createdAt: Date.now()
      });
    }
    
    // 2. Revenue Anomaly Detection
    const revenueAnomaly = this.detectAnomaly('revenue');
    if (revenueAnomaly.detected) {
      newInsights.push({
        id: `insight-${Date.now()}-2`,
        type: 'anomaly',
        category: 'revenue',
        title: 'Revenue Anomaly Detected',
        description: `Revenue is ${revenueAnomaly.deviation > 0 ? 'above' : 'below'} expected by ${Math.abs(revenueAnomaly.deviation).toFixed(1)}%.`,
        confidence: 90,
        impact: revenueAnomaly.deviation > 50 ? 'high' : 'medium',
        suggestedAction: revenueAnomaly.deviation > 0 
          ? 'Investigate successful campaigns and replicate.'
          : 'Review pricing strategy and marketing efforts.',
        data: revenueAnomaly,
        createdAt: Date.now()
      });
    }
    
    // 3. Top Agent Opportunity
    const topAgent = this.metrics.agents.topPerformers[0];
    if (topAgent && topAgent.growth > 100) {
      newInsights.push({
        id: `insight-${Date.now()}-3`,
        type: 'opportunity',
        category: 'agents',
        title: 'High-Growth Agent Identified',
        description: `${topAgent.name} has grown by ${topAgent.growth.toFixed(1)}% in the last 24h.`,
        confidence: 80,
        impact: 'medium',
        suggestedAction: 'Consider featuring this agent in marketing campaigns.',
        data: topAgent,
        createdAt: Date.now()
      });
    }
    
    // 4. API Risk Alert
    const apiRisk = this.assessAPIRisk();
    if (apiRisk.risk === 'high') {
      newInsights.push({
        id: `insight-${Date.now()}-4`,
        type: 'risk',
        category: 'api',
        title: 'API Performance Degradation',
        description: `Average API latency increased to ${this.metrics.api.averageLatency.toFixed(0)}ms.`,
        confidence: 95,
        impact: 'high',
        suggestedAction: 'Investigate API performance and optimize slow endpoints.',
        data: apiRisk,
        createdAt: Date.now()
      });
    }
    
    this.insights = [...newInsights, ...this.insights].slice(0, 50); // Keep last 50
    
    this.emit('insightsGenerated', newInsights);
    
    return newInsights;
  }
  
  /**
   * Analysiert Trend
   */
  private analyzeTrend(metric: string): { direction: 'up' | 'down' | 'stable'; change: number }> {
    const data = this.historicalData.get(metric) || [];
    if (data.length < 2) return { direction: 'stable', change: 0 };
    
    const recent = data.slice(-24); // Last 24 data points
    const older = data.slice(-48, -24); // Previous 24
    
    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, d) => sum + d.value, 0) / older.length 
      : recentAvg;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    return {
      direction: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
      change: Math.abs(change)
    };
  }
  
  /**
   * Erkennt Anomalien
   */
  private detectAnomaly(metric: string): { detected: boolean; deviation: number }> {
    const data = this.historicalData.get(metric) || [];
    if (data.length < 7) return { detected: false, deviation: 0 };
    
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );
    
    const current = values[values.length - 1];
    const deviation = ((current - mean) / stdDev) * 10; // Normalized deviation
    
    return {
      detected: Math.abs(deviation) > 20, // 20% deviation threshold
      deviation
    };
  }
  
  /**
   * Beurteilt API Risk
   */
  private assessAPIRisk(): { risk: 'low' | 'medium' | 'high' }> {
    const avgLatency = this.metrics.api.averageLatency;
    
    if (avgLatency < 100) return { risk: 'low' };
    if (avgLatency < 500) return { risk: 'medium' };
    return { risk: 'high' };
  }
  
  /**
   * Fügt Datenpunkt hinzu
   */
  private addDataPoint(metric: string, timestamp: number, value: number): void {
    const data = this.historicalData.get(metric) || [];
    data.push({ timestamp, value, label: new Date(timestamp).toISOString() });
    
    // Keep last 1000 data points
    if (data.length > 1000) {
      data.shift();
    }
    
    this.historicalData.set(metric, data);
  }
  
  /**
   * Abonniert Dashboard
   */
  subscribe(
    address: `0x${string}`,
    tier: keyof typeof this.SUBSCRIPTION_TIERS
  ): { success: boolean; invoice: SubscriptionInvoice }> {
    const config = this.SUBSCRIPTION_TIERS[tier];
    
    const invoice: SubscriptionInvoice = {
      id: `sub-${Date.now()}`,
      address,
      tier,
      amount: config.price,
      period: 'month',
      status: 'pending'
    };
    
    this.subscribers.set(address, {
      tier,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });
    
    this.emit('subscribed', address, tier);
    
    return { success: true, invoice };
  }
  
  /**
   * Prüft Zugriff
   */
  checkAccess(
    address: `0x${string}`,
    feature: string
  ): { allowed: boolean; tier?: string }> {
    const subscription = this.subscribers.get(address);
    
    if (!subscription || Date.now() > subscription.expiresAt) {
      // Check if feature is in basic tier
      const basicFeatures = this.SUBSCRIPTION_TIERS.basic.features;
      return { allowed: basicFeatures.includes(feature), tier: 'basic' };
    }
    
    const tierConfig = this.SUBSCRIPTION_TIERS[subscription.tier];
    return { 
      allowed: tierConfig.features.includes(feature) || tierConfig.features.includes('all'),
      tier: subscription.tier 
    };
  }
  
  /**
   * Holt Metrics
   */
  getMetrics(): PlatformMetrics {
    return this.metrics;
  }
  
  /**
   * Holt Insights
   */
  getInsights(
    type?: 'trend' | 'anomaly' | 'opportunity' | 'risk',
    limit: number = 10
  ): PredictiveInsight[] {
    let insights = this.insights;
    
    if (type) {
      insights = insights.filter(i => i.type === type);
    }
    
    return insights.slice(0, limit);
  }
  
  /**
   * Holt Historical Data
   */
  getHistoricalData(
    metric: string,
    from: number,
    to: number
  ): DataPoint[] {
    const data = this.historicalData.get(metric) || [];
    return data.filter(d => d.timestamp >= from && d.timestamp <= to);
  }
  
  /**
   * Statistiken
   */
  getStats(): {
    totalSubscribers: number;
    revenueFromSubscriptions: bigint;
    totalInsights: number;
    dataPointsStored: number;
  } {
    const revenue = Array.from(this.subscribers.values())
      .reduce((sum, sub) => {
        const price = this.SUBSCRIPTION_TIERS[sub.tier].price;
        return sum + price;
      }, 0n);
    
    const dataPoints = Array.from(this.historicalData.values())
      .reduce((sum, arr) => sum + arr.length, 0);
    
    return {
      totalSubscribers: this.subscribers.size,
      revenueFromSubscriptions: revenue,
      totalInsights: this.insights.length,
      dataPointsStored: dataPoints
    };
  }
}

export interface SubscriptionInvoice {
  id: string;
  address: `0x${string}`;
  tier: string;
  amount: bigint;
  period: string;
  status: 'pending' | 'paid' | 'expired';
}

export default AnalyticsDashboard;
