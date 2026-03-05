/**
 * AgentLink API Gateway
 * 
 * Proxy für externe APIs mit x402-Micropayments
 * Monetarisierung: Per-Call Fees
 */

import { Router, Request, Response } from 'express';

// API Endpoint Definition
export interface APIEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  provider: string;
  upstream: string; // Actual API URL
  pricing: {
    basePrice: bigint; // Base price in USDC (6 decimals)
    perUnit?: bigint;  // Additional price per unit (e.g., per KB)
    unitName?: string;
  };
  x402Config: {
    enabled: boolean;
    scheme: 'exact' | 'max';
    network: string;
  };
  rateLimit: {
    requests: number;
    window: number; // seconds
  };
  cache?: {
    ttl: number; // seconds
  };
  transform?: (data: any) => any;
}

// Supported API Categories
export type APICategory = 
  | 'defi'
  | 'weather'
  | 'crypto'
  | 'ai'
  | 'storage'
  | 'compute';

// Usage Tracking
export interface APIUsage {
  endpointId: string;
  caller: `0x${string}`;
  calls: number;
  totalSpent: bigint;
  lastCall: number;
}

export class APIGateway {
  private endpoints: Map<string, APIEndpoint> = new Map();
  private usage: Map<string, APIUsage> = new Map();
  private router: Router;
  
  // Fee Configuration
  private readonly PLATFORM_FEE_PERCENT = 5; // 5% platform fee
  
  constructor() {
    this.router = Router();
    this.initializeDefaultEndpoints();
    this.setupRoutes();
  }
  
  /**
   * Initialisiert Standard Endpoints
   */
  private initializeDefaultEndpoints() {
    const defaultEndpoints: APIEndpoint[] = [
      // DeFi APIs
      {
        id: 'aave-rates',
        path: '/api/aave/rates',
        method: 'GET',
        provider: 'Aave Protocol',
        upstream: 'https://api.aave.com/rates',
        pricing: { basePrice: 10000n }, // 0.01 USDC
        x402Config: { enabled: true, scheme: 'exact', network: 'base-sepolia' },
        rateLimit: { requests: 100, window: 60 },
        cache: { ttl: 300 }
      },
      {
        id: 'aave-supply',
        path: '/api/aave/supply',
        method: 'POST',
        provider: 'Aave Protocol',
        upstream: 'https://api.aave.com/supply',
        pricing: { basePrice: 50000n }, // 0.05 USDC
        x402Config: { enabled: true, scheme: 'exact', network: 'base-sepolia' },
        rateLimit: { requests: 10, window: 60 }
      },
      {
        id: 'aave-borrow',
        path: '/api/aave/borrow',
        method: 'POST',
        provider: 'Aave Protocol',
        upstream: 'https://api.aave.com/borrow',
        pricing: { basePrice: 50000n }, // 0.05 USDC
        x402Config: { enabled: true, scheme: 'exact', network: 'base-sepolia' },
        rateLimit: { requests: 10, window: 60 }
      },
      
      // Weather APIs
      {
        id: 'weather-current',
        path: '/api/weather/current',
        method: 'GET',
        provider: 'Weather API',
        upstream: 'https://api.weather.com/current',
        pricing: { basePrice: 5000n }, // 0.005 USDC
        x402Config: { enabled: true, scheme: 'exact', network: 'base-sepolia' },
        rateLimit: { requests: 200, window: 60 },
        cache: { ttl: 600 }
      },
      {
        id: 'weather-forecast',
        path: '/api/weather/forecast',
        method: 'GET',
        provider: 'Weather API',
        upstream: 'https://api.weather.com/forecast',
        pricing: { basePrice: 10000n }, // 0.01 USDC
        x402Config: { enabled: true, scheme: 'exact', network: 'base-sepolia' },
        rateLimit: { requests: 100, window: 60 },
        cache: { ttl: 3600 }
      },
      
      // Crypto Data
      {
        id: 'crypto-price',
        path: '/api/crypto/price',
        method: 'GET',
        provider: 'CoinGecko',
        upstream: 'https://api.coingecko.com/price',
        pricing: { basePrice: 5000n }, // 0.005 USDC
        x402Config: { enabled: true, scheme: 'exact', network: 'base-sepolia' },
        rateLimit: { requests: 500, window: 60 },
        cache: { ttl: 60 }
      },
      
      // AI Services
      {
        id: 'ai-completion',
        path: '/api/ai/completion',
        method: 'POST',
        provider: 'AI Provider',
        upstream: 'https://api.ai.com/completion',
        pricing: { 
          basePrice: 50000n, // 0.05 USDC
          perUnit: 1000n,    // 0.001 USDC per token
          unitName: 'token'
        },
        x402Config: { enabled: true, scheme: 'max', network: 'base-sepolia' },
        rateLimit: { requests: 50, window: 60 }
      },
      {
        id: 'ai-embedding',
        path: '/api/ai/embedding',
        method: 'POST',
        provider: 'AI Provider',
        upstream: 'https://api.ai.com/embedding',
        pricing: { basePrice: 20000n }, // 0.02 USDC
        x402Config: { enabled: true, scheme: 'exact', network: 'base-sepolia' },
        rateLimit: { requests: 100, window: 60 }
      }
    ];
    
    defaultEndpoints.forEach(ep => this.endpoints.set(ep.id, ep));
  }
  
  /**
   * Setup Express Routes
   */
  private setupRoutes() {
    // Health check
    this.router.get('/health', (req, res) => {
      res.json({ status: 'ok', endpoints: this.endpoints.size });
    });
    
    // List all endpoints
    this.router.get('/api/endpoints', (req, res) => {
      const list = Array.from(this.endpoints.values()).map(ep => ({
        id: ep.id,
        path: ep.path,
        method: ep.method,
        provider: ep.provider,
        price: formatUSDC(ep.pricing.basePrice),
        x402: ep.x402Config.enabled
      }));
      res.json(list);
    });
    
    // Dynamic route for each endpoint
    this.endpoints.forEach(endpoint => {
      const handler = this.createEndpointHandler(endpoint);
      
      switch (endpoint.method) {
        case 'GET':
          this.router.get(endpoint.path, handler);
          break;
        case 'POST':
          this.router.post(endpoint.path, handler);
          break;
        case 'PUT':
          this.router.put(endpoint.path, handler);
          break;
        case 'DELETE':
          this.router.delete(endpoint.path, handler);
          break;
      }
    });
  }
  
  /**
   * Erstellt Handler für einen Endpoint
   */
  private createEndpointHandler(endpoint: APIEndpoint) {
    return async (req: Request, res: Response) => {
      try {
        // 1. Check if payment required (x402)
        if (endpoint.x402Config.enabled) {
          const paymentHeader = req.headers['x-payment-signature'];
          if (!paymentHeader) {
            // Return 402 Payment Required
            res.status(402).set({
              'X-PAYMENT-REQUIRED': JSON.stringify({
                scheme: endpoint.x402Config.scheme,
                network: endpoint.x402Config.network,
                maxAmountRequired: endpoint.pricing.basePrice.toString(),
                resource: endpoint.path
              })
            }).json({
              error: 'Payment required',
              price: formatUSDC(endpoint.pricing.basePrice),
              endpoint: endpoint.id
            });
            return;
          }
          
          // Verify payment (simplified - would use x402 verify)
          const paymentValid = await this.verifyPayment(
            paymentHeader as string,
            endpoint.pricing.basePrice
          );
          
          if (!paymentValid) {
            res.status(402).json({ error: 'Invalid payment' });
            return;
          }
          
          // Track usage
          const caller = this.extractCaller(paymentHeader as string);
          this.trackUsage(endpoint.id, caller, endpoint.pricing.basePrice);
        }
        
        // 2. Check rate limit
        const rateLimitKey = `${endpoint.id}:${req.ip}`;
        if (!this.checkRateLimit(rateLimitKey, endpoint.rateLimit)) {
          res.status(429).json({ error: 'Rate limit exceeded' });
          return;
        }
        
        // 3. Check cache
        const cacheKey = `${endpoint.id}:${JSON.stringify(req.query)}`;
        if (endpoint.cache) {
          const cached = await this.getCache(cacheKey);
          if (cached) {
            res.json(cached);
            return;
          }
        }
        
        // 4. Call upstream API
        const response = await this.callUpstream(endpoint, req);
        
        // 5. Transform response
        let data = response;
        if (endpoint.transform) {
          data = endpoint.transform(data);
        }
        
        // 6. Cache response
        if (endpoint.cache) {
          await this.setCache(cacheKey, data, endpoint.cache.ttl);
        }
        
        // 7. Return response
        res.json(data);
        
      } catch (error: any) {
        console.error(`API Gateway error for ${endpoint.path}:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }
  
  /**
   * Verifiziert x402 Payment
   */
  private async verifyPayment(signature: string, expectedAmount: bigint): Promise<boolean> {
    // In production: use proper x402 verification
    // For now: mock verification
    return signature.length > 0;
  }
  
  /**
   * Extrahiert Caller aus Payment
   */
  private extractCaller(signature: string): `0x${string}` {
    // In production: decode payment to get sender
    return '0xCaller00000000000000000000000000000000000';
  }
  
  /**
   * Trackt API Usage
   */
  private trackUsage(endpointId: string, caller: `0x${string}`, amount: bigint): void {
    const key = `${endpointId}:${caller}`;
    const existing = this.usage.get(key);
    
    if (existing) {
      existing.calls++;
      existing.totalSpent += amount;
      existing.lastCall = Date.now();
    } else {
      this.usage.set(key, {
        endpointId,
        caller,
        calls: 1,
        totalSpent: amount,
        lastCall: Date.now()
      });
    }
  }
  
  /**
   * Prüft Rate Limit
   */
  private checkRateLimit(key: string, limit: { requests: number; window: number }): boolean {
    // Simplified rate limiting - in production use Redis
    return true;
  }
  
  /**
   * Ruft Upstream API auf
   */
  private async callUpstream(endpoint: APIEndpoint, req: Request): Promise<any> {
    // In production: actual HTTP call to upstream
    // Mock response for demonstration
    switch (endpoint.id) {
      case 'aave-rates':
        return {
          usdc: { supplyAPY: '0.045', borrowAPY: '0.065' },
          eth: { supplyAPY: '0.025', borrowAPY: '0.035' },
          timestamp: Date.now()
        };
      case 'weather-current':
        return {
          location: req.query.city || 'Berlin',
          temperature: 22,
          condition: 'Sunny',
          humidity: 65
        };
      case 'crypto-price':
        return {
          bitcoin: { usd: 65000, change24h: 2.5 },
          ethereum: { usd: 3500, change24h: 1.8 }
        };
      case 'ai-completion':
        return {
          completion: 'This is a mock AI response.',
          tokensUsed: 150
        };
      default:
        return { success: true, endpoint: endpoint.id };
    }
  }
  
  /**
   * Holt aus Cache
   */
  private async getCache(key: string): Promise<any | null> {
    // In production: Redis
    return null;
  }
  
  /**
   * Speichert in Cache
   */
  private async setCache(key: string, value: any, ttl: number): Promise<void> {
    // In production: Redis
  }
  
  /**
   * Fügt neuen Endpoint hinzu
   */
  registerEndpoint(endpoint: APIEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    // Re-setup routes
    this.setupRoutes();
  }
  
  /**
   * Holt Router für Express Integration
   */
  getRouter(): Router {
    return this.router;
  }
  
  /**
   * Holt Usage Statistics
   */
  getUsageStats(): {
    totalCalls: number;
    totalRevenue: bigint;
    topEndpoints: { endpointId: string; calls: number }[];
  } {
    const usage = Array.from(this.usage.values());
    
    const totalCalls = usage.reduce((sum, u) => sum + u.calls, 0);
    const totalRevenue = usage.reduce((sum, u) => sum + u.totalSpent, 0n);
    
    // Aggregate by endpoint
    const endpointCalls = new Map<string, number>();
    usage.forEach(u => {
      const current = endpointCalls.get(u.endpointId) || 0;
      endpointCalls.set(u.endpointId, current + u.calls);
    });
    
    const topEndpoints = Array.from(endpointCalls.entries())
      .map(([endpointId, calls]) => ({ endpointId, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);
    
    return { totalCalls, totalRevenue, topEndpoints };
  }
  
  /**
   * Berechnet Platform Fees
   */
  calculateFees(amount: bigint): { platform: bigint; provider: bigint } {
    const platform = (amount * BigInt(this.PLATFORM_FEE_PERCENT)) / 100n;
    const provider = amount - platform;
    return { platform, provider };
  }
}

// Helper
function formatUSDC(amount: bigint): string {
  const usdc = Number(amount) / 1_000_000;
  return `${usdc.toFixed(6)} USDC`;
}

export default APIGateway;
