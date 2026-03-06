import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CreateWalletSchema,
  CreateSessionKeySchema,
  CreateListingSchema,
  CreateJobSchema,
  CreatePaymentSchema,
  PaginationSchema
} from '../src/middleware/validation.js';

describe('Validation Schemas', () => {
  
  describe('CreateWalletSchema', () => {
    it('should validate valid wallet data', () => {
      const data = {
        ownerAddress: '0x1234567890123456789012345678901234567890',
        name: 'Test Wallet',
        isPremium: false
      };
      
      const result = CreateWalletSchema.parse(data);
      expect(result.ownerAddress).toBe(data.ownerAddress);
      expect(result.name).toBe(data.name);
      expect(result.isPremium).toBe(false);
    });
    
    it('should reject invalid address', () => {
      const data = {
        ownerAddress: 'invalid-address',
        name: 'Test'
      };
      
      expect(() => CreateWalletSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject empty name', () => {
      const data = {
        ownerAddress: '0x1234567890123456789012345678901234567890',
        name: ''
      };
      
      expect(() => CreateWalletSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject name too long', () => {
      const data = {
        ownerAddress: '0x1234567890123456789012345678901234567890',
        name: 'a'.repeat(101)
      };
      
      expect(() => CreateWalletSchema.parse(data)).toThrow(z.ZodError);
    });
  });
  
  describe('CreateSessionKeySchema', () => {
    it('should validate valid session key data', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        permissions: [
          { type: 'contract', target: '0xabc', actions: ['execute'] }
        ],
        spendLimit: 1000000n,
        duration: 3600
      };
      
      const result = CreateSessionKeySchema.parse(data);
      expect(result.walletId).toBe(data.walletId);
      expect(result.permissions).toHaveLength(1);
      expect(result.spendLimit).toBe(1000000n);
    });
    
    it('should accept string spend limit and convert to bigint', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        permissions: [{ type: 'contract', target: '0xabc', actions: ['execute'] }],
        spendLimit: '1000000',
        duration: 3600
      };
      
      const result = CreateSessionKeySchema.parse(data);
      expect(result.spendLimit).toBe(1000000n);
    });
    
    it('should reject missing permissions', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        permissions: [],
        spendLimit: 1000000n
      };
      
      expect(() => CreateSessionKeySchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject duration too short', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        permissions: [{ type: 'contract', target: '0xabc', actions: ['execute'] }],
        spendLimit: 1000000n,
        duration: 30 // Less than 60
      };
      
      expect(() => CreateSessionKeySchema.parse(data)).toThrow(z.ZodError);
    });
  });
  
  describe('CreateListingSchema', () => {
    it('should validate valid listing data', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Agent',
        description: 'This is a test agent with sufficient description',
        category: 'coding',
        minPrice: 1000000n,
        maxPrice: 5000000n
      };
      
      const result = CreateListingSchema.parse(data);
      expect(result.name).toBe(data.name);
      expect(result.category).toBe('coding');
    });
    
    it('should reject min price below 0.1 USDC', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        description: 'This is a test agent with sufficient description',
        category: 'coding',
        minPrice: 50000n, // Less than 100000
        maxPrice: 5000000n
      };
      
      expect(() => CreateListingSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject max price less than min price', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        description: 'This is a test agent with sufficient description',
        category: 'coding',
        minPrice: 5000000n,
        maxPrice: 1000000n
      };
      
      expect(() => CreateListingSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject description too short', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        description: 'Too short',
        category: 'coding',
        minPrice: 1000000n,
        maxPrice: 5000000n
      };
      
      expect(() => CreateListingSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject invalid category', () => {
      const data = {
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        description: 'This is a test agent with sufficient description',
        category: 'invalid-category',
        minPrice: 1000000n,
        maxPrice: 5000000n
      };
      
      expect(() => CreateListingSchema.parse(data)).toThrow(z.ZodError);
    });
  });
  
  describe('CreateJobSchema', () => {
    it('should validate valid job data', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const data = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Job',
        description: 'This is a detailed job description with enough characters',
        category: 'coding',
        budgetMin: 1000000n,
        budgetMax: 5000000n,
        deadline: futureDate,
        requiredSkills: ['Solidity', 'TypeScript']
      };
      
      const result = CreateJobSchema.parse(data);
      expect(result.title).toBe(data.title);
      expect(result.requiredSkills).toHaveLength(2);
    });
    
    it('should reject deadline in the past', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const data = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Job',
        description: 'This is a detailed job description with enough characters',
        category: 'coding',
        budgetMin: 1000000n,
        budgetMax: 5000000n,
        deadline: pastDate,
        requiredSkills: ['Solidity']
      };
      
      expect(() => CreateJobSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject empty skills array', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const data = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Job',
        description: 'This is a detailed job description with enough characters',
        category: 'coding',
        budgetMin: 1000000n,
        budgetMax: 5000000n,
        deadline: futureDate,
        requiredSkills: []
      };
      
      expect(() => CreateJobSchema.parse(data)).toThrow(z.ZodError);
    });
  });
  
  describe('CreatePaymentSchema', () => {
    it('should validate valid payment data', () => {
      const data = {
        to: '0x1234567890123456789012345678901234567890',
        amount: 1000000n,
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        intentId: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234'
      };
      
      const result = CreatePaymentSchema.parse(data);
      expect(result.to).toBe(data.to);
      expect(result.amount).toBe(1000000n);
    });
    
    it('should reject amount too low', () => {
      const data = {
        to: '0x1234567890123456789012345678901234567890',
        amount: 50000n, // Less than 100000
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        intentId: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234'
      };
      
      expect(() => CreatePaymentSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject amount too high', () => {
      const data = {
        to: '0x1234567890123456789012345678901234567890',
        amount: 2000000000000n, // More than 1M
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        intentId: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234'
      };
      
      expect(() => CreatePaymentSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should reject invalid intent ID format', () => {
      const data = {
        to: '0x1234567890123456789012345678901234567890',
        amount: 1000000n,
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        intentId: 'invalid-intent-id'
      };
      
      expect(() => CreatePaymentSchema.parse(data)).toThrow(z.ZodError);
    });
  });
  
  describe('PaginationSchema', () => {
    it('should parse pagination with defaults', () => {
      const data = {};
      const result = PaginationSchema.parse(data);
      
      expect(result.page).toBe(1);
      expect(result.take).toBe(20);
      expect(result.skip).toBe(0);
    });
    
    it('should calculate skip correctly', () => {
      const data = { page: '3', limit: '50' };
      const result = PaginationSchema.parse(data);
      
      expect(result.page).toBe(3);
      expect(result.take).toBe(50);
      expect(result.skip).toBe(100); // (3-1) * 50
    });
    
    it('should cap limit at 100', () => {
      const data = { page: '1', limit: '200' };
      const result = PaginationSchema.parse(data);
      
      expect(result.take).toBe(100);
    });
  });
});

describe('Error Classes', () => {
  it('should create ValidationError with correct properties', () => {
    const error = new (await import('../src/middleware/errorHandler.js')).ValidationError(
      'Invalid input',
      { field: 'name' }
    );
    
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input');
    expect(error.isOperational).toBe(true);
  });
  
  it('should create NotFoundError with correct properties', () => {
    const error = new (await import('../src/middleware/errorHandler.js')).NotFoundError('Wallet');
    
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Wallet not found');
  });
  
  it('should create AuthenticationError with correct properties', () => {
    const error = new (await import('../src/middleware/errorHandler.js')).AuthenticationError();
    
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });
  
  it('should create AuthorizationError with correct properties', () => {
    const error = new (await import('../src/middleware/errorHandler.js')).AuthorizationError();
    
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
  });
});
