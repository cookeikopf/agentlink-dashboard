/**
 * Input Validation Schemas
 * 
 * Zod schemas for all API inputs
 */

import { z } from 'zod';

// Address validation
const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

// BigInt validation for amounts
const AmountSchema = z.union([
  z.bigint(),
  z.string().regex(/^\d+$/).transform(val => BigInt(val)),
  z.number().int().positive().transform(val => BigInt(val))
]);

// Common schemas
export const PaginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20')
}).transform(({ page, limit }) => ({
  skip: (page - 1) * limit,
  take: Math.min(limit, 100), // Max 100 per page
  page
}));

// Wallet Schemas
export const CreateWalletSchema = z.object({
  ownerAddress: AddressSchema,
  name: z.string().min(1).max(100),
  isPremium: z.boolean().default(false)
});

export const CreateSessionKeySchema = z.object({
  walletId: z.string().uuid(),
  permissions: z.array(z.object({
    type: z.enum(['contract', 'function', 'token', 'api']),
    target: z.string(),
    actions: z.array(z.string())
  })).min(1),
  spendLimit: AmountSchema,
  duration: z.number().int().min(60).max(86400).default(3600) // 1 min to 24 hours
});

export const ValidateSessionKeySchema = z.object({
  sessionKeyId: z.string().uuid(),
  contract: AddressSchema,
  functionName: z.string(),
  value: AmountSchema.default(() => 0n)
});

// Marketplace Schemas
export const CreateListingSchema = z.object({
  walletId: z.string().uuid(),
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  category: z.enum(['defi', 'security', 'coding', 'design', 'data', 'marketing', 'legal', 'other']),
  minPrice: AmountSchema.refine(val => val >= 100000n, 'Minimum price is 0.1 USDC'),
  maxPrice: AmountSchema,
  currency: z.string().default('USDC')
}).refine(data => data.maxPrice >= data.minPrice, {
  message: 'Max price must be greater than or equal to min price',
  path: ['maxPrice']
});

export const AddSkillSchema = z.object({
  listingId: z.string().uuid(),
  name: z.string().min(1).max(50),
  level: z.enum(['beginner', 'intermediate', 'expert']),
  verified: z.boolean().default(false)
});

export const SearchListingsSchema = z.object({
  category: z.enum(['defi', 'security', 'coding', 'design', 'data', 'marketing', 'legal', 'other']).optional(),
  minReputation: z.string().regex(/^\d+$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+$/).optional(),
  availableOnly: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  verifiedOnly: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  skills: z.string().transform(val => val.split(',')).optional()
}).merge(PaginationSchema);

// Job Schemas
export const CreateJobSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  category: z.enum(['defi', 'security', 'coding', 'design', 'data', 'marketing', 'legal', 'other']),
  budgetMin: AmountSchema.refine(val => val >= 100000n, 'Minimum budget is 0.1 USDC'),
  budgetMax: AmountSchema,
  currency: z.string().default('USDC'),
  deadline: z.string().datetime().transform(str => new Date(str)),
  requiredSkills: z.array(z.string().min(1).max(50)).min(1)
}).refine(data => data.budgetMax >= data.budgetMin, {
  message: 'Max budget must be greater than or equal to min budget',
  path: ['budgetMax']
}).refine(data => data.deadline > new Date(), {
  message: 'Deadline must be in the future',
  path: ['deadline']
});

// Match Schemas
export const CreateMatchSchema = z.object({
  jobId: z.string().uuid(),
  listingId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  proposedPrice: AmountSchema
});

export const UpdateMatchStatusSchema = z.object({
  matchId: z.string().uuid(),
  status: z.enum(['pending', 'accepted', 'rejected', 'expired'])
});

// Escrow Schemas
export const CreateEscrowSchema = z.object({
  matchId: z.string().uuid(),
  amount: AmountSchema,
  token: AddressSchema,
  milestones: z.array(z.object({
    description: z.string().min(1).max(500),
    amount: AmountSchema,
    deadline: z.string().datetime().optional()
  })).min(1)
}).refine(data => {
  const total = data.milestones.reduce((sum, m) => sum + BigInt(m.amount.toString()), 0n);
  return total === BigInt(data.amount.toString());
}, {
  message: 'Milestone amounts must sum to total amount',
  path: ['milestones']
});

// Workflow Schemas
export const CreateWorkflowSchema = z.object({
  ownerId: z.string().uuid(),
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(1000),
  totalBudget: AmountSchema,
  steps: z.array(z.object({
    type: z.enum(['debugger', 'auditor', 'tester', 'reviewer', 'deployer', 'optimizer']),
    input: z.record(z.any())
  })).min(1).max(10)
});

// Payment Schemas
export const CreatePaymentSchema = z.object({
  to: AddressSchema,
  amount: AmountSchema.refine(val => val >= 100000n && val <= 1000000000000n, {
    message: 'Amount must be between 0.1 and 1,000,000 USDC'
  }),
  token: AddressSchema,
  intentId: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid intent ID'),
  expiresIn: z.number().int().min(60).max(604800).optional() // 1 min to 7 days
});

// ID Parameter Schema
export const IdParamSchema = z.object({
  id: z.string().uuid()
});

// Review Schema
export const CreateReviewSchema = z.object({
  agentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  quality: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  punctuality: z.number().int().min(1).max(5).optional(),
  value: z.number().int().min(1).max(5).optional(),
  dealId: z.string().optional()
});

// Validation middleware factory
export function validate(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
              code: e.code
            }))
          }
        });
      }
      next(error);
    }
  };
}

// Validate query params
export function validateQuery(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query validation failed',
            details: error.errors
          }
        });
      }
      next(error);
    }
  };
}

// Validate params
export function validateParams(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.params);
      req.validatedParams = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parameter validation failed',
            details: error.errors
          }
        });
      }
      next(error);
    }
  };
}
