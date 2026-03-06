/**
 * Rate Limiting
 * 
 * Protection against abuse and DoS attacks
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { RateLimitError } from './errorHandler.js';

// Store for IP-based rate limiting (in production use Redis)
const ipStore = new Map<string, { count: number; resetTime: number }>();

// Standard rate limiter
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      },
      retryAfter: Math.ceil(15 * 60) // seconds
    });
  }
});

// Strict rate limiter for sensitive endpoints
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_STRICT',
        message: 'Too many requests to sensitive endpoint'
      },
      retryAfter: Math.ceil(15 * 60)
    });
  }
});

// Auth endpoints limiter
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT',
        message: 'Too many authentication attempts. Please try again later.'
      },
      retryAfter: Math.ceil(60 * 60)
    });
  }
});

// Payment endpoints limiter
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'PAYMENT_RATE_LIMIT',
        message: 'Too many payment requests. Please slow down.'
      },
      retryAfter: 60
    });
  }
});

// Admin endpoints limiter
export const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'ADMIN_RATE_LIMIT',
        message: 'Too many admin requests'
      },
      retryAfter: Math.ceil(5 * 60)
    });
  }
});

// Custom rate limiter with memory store (for development/testing)
export function createCustomLimiter(
  windowMs: number,
  maxRequests: number,
  keyGenerator?: (req: Request) => string
) {
  const store = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: Function) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    
    const record = store.get(key);
    
    if (!record || now > record.resetTime) {
      // Reset or create new record
      store.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded'
        },
        retryAfter
      });
    }
    
    record.count++;
    next();
  };
}

// Sliding window rate limiter (more accurate)
export class SlidingWindowLimiter {
  private windows = new Map<string, number[]>();
  
  constructor(
    private windowMs: number,
    private maxRequests: number
  ) {}
  
  isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let requests = this.windows.get(key) || [];
    
    // Remove old requests outside window
    requests = requests.filter(time => time > windowStart);
    
    const allowed = requests.length < this.maxRequests;
    
    if (allowed) {
      requests.push(now);
    }
    
    this.windows.set(key, requests);
    
    // Cleanup old keys periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }
    
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - requests.length),
      resetTime: requests[0] ? requests[0] + this.windowMs : now + this.windowMs
    };
  }
  
  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [key, requests] of this.windows) {
      const valid = requests.filter(time => time > windowStart);
      if (valid.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, valid);
      }
    }
  }
}

// Export singleton instance
export const slidingWindowLimiter = new SlidingWindowLimiter(60000, 100);
