/**
 * Unit Tests für A2A Protocol
 * 
 * Testet Intent Matching, x402 Integration und Reputation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { A2AIntentMatcher, IntentUtils } from '../src/a2a/matcher';
import { X402Parser, X402Utils } from '../src/x402/parser';
import { AgentLinkA2A } from '../src/index';

// Mock für viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: vi.fn()
  })),
  http: vi.fn()
}));

vi.mock('viem/chains', () => ({
  baseSepolia: { id: 84532 }
}));

describe('A2AIntentMatcher', () => {
  let matcher: A2AIntentMatcher;
  
  beforeEach(() => {
    matcher = new A2AIntentMatcher('https://test.rpc');
  });
  
  describe('Intent Matching', () => {
    it('sollte Agenten basierend auf Intent finden', async () => {
      const intent = IntentUtils.createIntent(
        'payment processing',
        '0x1234567890123456789012345678901234567890'
      );
      
      // Mock implementation würde hier Blockchain-Daten simulieren
      const matches = await matcher.matchIntent(intent);
      
      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });
    
    it('sollte Requester aus Matching ausschließen', async () => {
      const requesterAddress = '0x1234567890123456789012345678901234567890';
      const intent = IntentUtils.createIntent('payment', requesterAddress);
      
      const matches = await matcher.matchIntent(intent);
      
      // Kein Match sollte der Requester selbst sein
      matches.forEach(match => {
        expect(match.agent.address.toLowerCase()).not.toBe(requesterAddress.toLowerCase());
      });
    });
    
    it('sollte Confidence-Score berechnen', async () => {
      const intent = IntentUtils.createIntent('data analysis', '0x1234...');
      
      const matches = await matcher.matchIntent(intent);
      
      matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
  
  describe('Best Match Selection', () => {
    it('sollte den besten Agenten zurückgeben', async () => {
      const intent = IntentUtils.createIntent('escrow', '0x1234...');
      
      const bestMatch = await matcher.findBestMatch(intent);
      
      if (bestMatch) {
        expect(bestMatch.confidence).toBeGreaterThan(0);
        expect(bestMatch.agent).toBeDefined();
      }
    });
  });
});

describe('IntentUtils', () => {
  describe('Keyword Extraction', () => {
    it('sollte Keywords aus Intent extrahieren', () => {
      const keywords = IntentUtils.extractKeywords('payment processing');
      
      expect(keywords).toContain('payment');
    });
    
    it('sollte mehrere Keywords finden', () => {
      const keywords = IntentUtils.extractKeywords('escrow and dispute resolution');
      
      expect(keywords).toContain('escrow');
      expect(keywords).toContain('dispute');
    });
    
    it('sollte keine false positives finden', () => {
      const keywords = IntentUtils.extractKeywords('random unrelated text');
      
      expect(keywords.length).toBe(0);
    });
  });
  
  describe('Intent Creation', () => {
    it('sollte Intent Objekt erstellen', () => {
      const intent = IntentUtils.createIntent(
        'data processing',
        '0x1234567890123456789012345678901234567890',
        { maxPrice: '1.00', currency: 'USDC' }
      );
      
      expect(intent.action).toBe('data processing');
      expect(intent.requester).toBe('0x1234567890123456789012345678901234567890');
      expect(intent.requirements?.maxPrice).toBe('1.00');
    });
  });
});

describe('X402 Integration', () => {
  describe('Parser', () => {
    const mockRequirements = {
      scheme: 'exact' as const,
      network: 'base-sepolia',
      token: 'USDC',
      amount: '1000000',
      recipient: '0x1234567890123456789012345678901234567890',
      deadline: Math.floor(Date.now() / 1000) + 1200
    };
    
    it('sollte Requirements encodieren/decodieren', () => {
      const encoded = X402Parser.encodeRequirements(mockRequirements);
      const decoded = X402Parser.parseRequirements(encoded);
      
      expect(decoded.scheme).toBe(mockRequirements.scheme);
      expect(decoded.amount).toBe(mockRequirements.amount);
      expect(decoded.recipient).toBe(mockRequirements.recipient);
    });
    
    it('sollte Response Headers erstellen', () => {
      const headers = X402Parser.createResponseHeaders(mockRequirements);
      
      expect(headers['X-PAYMENT-REQUIRED']).toBeDefined();
      expect(headers['X-PAYMENT-REQUIRED-VERSION']).toBe('2.0');
    });
    
    it('sollte valide Requirements akzeptieren', () => {
      expect(() => {
        X402Parser.validateRequirements(mockRequirements);
      }).not.toThrow();
    });
    
    it('sollte invalide Requirements ablehnen', () => {
      const invalid = { ...mockRequirements, amount: '0' };
      
      expect(() => {
        X402Parser.validateRequirements(invalid);
      }).toThrow();
    });
    
    it('sollte abgelaufene Deadlines erkennen', () => {
      const expired = {
        ...mockRequirements,
        deadline: Math.floor(Date.now() / 1000) - 100
      };
      
      expect(() => {
        X402Parser.validateRequirements(expired);
      }).toThrow('expired');
    });
  });
  
  describe('Utils', () => {
    it('sollte Deadline berechnen', () => {
      const deadline = X402Utils.calculateDeadline(20);
      const expected = Math.floor(Date.now() / 1000) + 1200;
      
      expect(deadline).toBeGreaterThanOrEqual(expected - 5);
      expect(deadline).toBeLessThanOrEqual(expected + 5);
    });
    
    it('sollte USDC Amount korrekt parsen', () => {
      const amount = X402Utils.parseUSDCAmount('1.5');
      expect(amount).toBe(BigInt(1500000));
    });
    
    it('sollte USDC Amount korrekt formatieren', () => {
      expect(X402Utils.formatUSDCAmount(BigInt(1500000))).toBe('1.5');
      expect(X402Utils.formatUSDCAmount(BigInt(1000000))).toBe('1');
    });
    
    it('sollte mit ungeraden Beträgen umgehen', () => {
      expect(X402Utils.formatUSDCAmount(BigInt(1234567))).toBe('1.234567');
    });
  });
});

describe('AgentLinkA2A SDK', () => {
  let sdk: AgentLinkA2A;
  
  beforeEach(() => {
    sdk = new AgentLinkA2A('https://test.rpc');
  });
  
  it('sollte initialisiert werden', () => {
    expect(sdk).toBeDefined();
  });
  
  it('sollte Agenten finden', async () => {
    const intent = IntentUtils.createIntent('payment', '0x1234...');
    const agents = await sdk.findAgents(intent);
    
    expect(agents).toBeDefined();
    expect(Array.isArray(agents)).toBe(true);
  });
  
  it('sollte besten Agenten finden', async () => {
    const intent = IntentUtils.createIntent('payment', '0x1234...');
    const best = await sdk.findBestAgent(intent);
    
    // Kann null sein wenn keine Agenten gefunden
    expect(best === null || best.confidence > 0).toBe(true);
  });
  
  it('sollte x402 Requirements parsen', () => {
    const requirements = {
      scheme: 'exact' as const,
      network: 'base-sepolia',
      token: 'USDC',
      amount: '1000000',
      recipient: '0x1234567890123456789012345678901234567890',
      deadline: Date.now() + 1200000
    };
    
    const encoded = X402Parser.encodeRequirements(requirements);
    const parsed = AgentLinkA2A.parseX402Requirements(encoded);
    
    expect(parsed.amount).toBe(requirements.amount);
  });
  
  it('sollte x402 Response erstellen', () => {
    const requirements = {
      scheme: 'exact' as const,
      network: 'base-sepolia',
      token: 'USDC',
      amount: '1000000',
      recipient: '0x1234567890123456789012345678901234567890',
      deadline: Date.now() + 1200000
    };
    
    const headers = AgentLinkA2A.createX402Response(requirements);
    
    expect(headers['X-PAYMENT-REQUIRED']).toBeDefined();
    expect(headers['X-PAYMENT-REQUIRED-VERSION']).toBe('2.0');
  });
});

describe('Performance', () => {
  it('sollte Intent Matching in unter 100ms durchführen', async () => {
    const matcher = new A2AIntentMatcher('https://test.rpc');
    const intent = IntentUtils.createIntent('payment', '0x1234...');
    
    const start = Date.now();
    await matcher.matchIntent(intent);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('sollte x402 Parsing in unter 10ms durchführen', () => {
    const requirements = {
      scheme: 'exact' as const,
      network: 'base-sepolia',
      token: 'USDC',
      amount: '1000000',
      recipient: '0x1234567890123456789012345678901234567890',
      deadline: Date.now() + 1200000
    };
    
    const encoded = X402Parser.encodeRequirements(requirements);
    
    const start = Date.now();
    X402Parser.parseRequirements(encoded);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(10);
  });
});

describe('Integration', () => {
  it('sollte kompletten Flow simulieren', async () => {
    // 1. Intent erstellen
    const intent = IntentUtils.createIntent(
      'data processing',
      '0x1234567890123456789012345678901234567890',
      { maxPrice: '2.00', currency: 'USDC' }
    );
    
    // 2. SDK initialisieren
    const sdk = new AgentLinkA2A('https://test.rpc');
    
    // 3. Agenten finden
    const matches = await sdk.findAgents(intent);
    
    // 4. x402 Response erstellen (wenn Agent gefunden)
    if (matches.length > 0) {
      const requirements = {
        scheme: 'exact' as const,
        network: 'base-sepolia',
        token: 'USDC',
        amount: '1500000', // 1.5 USDC
        recipient: matches[0].agent.address,
        deadline: X402Utils.calculateDeadline(20)
      };
      
      const headers = AgentLinkA2A.createX402Response(requirements);
      
      expect(headers['X-PAYMENT-REQUIRED']).toBeDefined();
    }
  });
});
