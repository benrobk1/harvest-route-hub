/**
 * BUSINESS CONSTANTS (Server-Side)
 * Single source of truth for business rules
 * Shared between all edge functions
 */

// Revenue splits (must sum to 100%)
export const REVENUE_SPLITS = {
  FARMER_SHARE: 0.88,      // 88% to farmer
  LEAD_FARMER_SHARE: 0.02, // 2% to lead farmer
  PLATFORM_FEE: 0.10,      // 10% platform fee
} as const;

// Delivery fees
export const DELIVERY_FEE_USD = 7.50; // Flat fee per order

// Credit system
export const CREDITS = {
  VALUE_PER_CREDIT: 10,           // $10 per credit
  EARNINGS_THRESHOLD: 100,        // Earn 1 credit per $100 spent
  EXPIRATION_DAYS: 30,            // Credits expire after 30 days
  REFERRAL_BONUS: 10,             // $10 credit for first order via referral
} as const;

// Order limits
export const ORDER_LIMITS = {
  MIN_ORDER_AMOUNT: 25,           // Minimum $25 order
  MAX_ITEMS_PER_ORDER: 50,        // Prevent abuse
} as const;

// Batch optimization constraints
export const BATCH_CONSTRAINTS = {
  MIN_SIZE: 8,                    // Minimum orders per batch
  TARGET_SIZE: 15,                // Target orders per batch
  MAX_SIZE: 20,                   // Maximum orders per batch
  DEFAULT_TARGET_SIZE: 37,        // Default target if no market config
  DEFAULT_MIN_SIZE: 30,           // Default min if no market config
  DEFAULT_MAX_SIZE: 45,           // Default max if no market config
  DEFAULT_MAX_ROUTE_HOURS: 7.5,   // Default max round trip time
} as const;

// Rate limiting
export const RATE_LIMITS = {
  CHECKOUT: { 
    maxRequests: 10, 
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'checkout' 
  },
  BATCH_GENERATION: { 
    maxRequests: 10, 
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'batch_gen' 
  },
} as const;

// Subscription
export const SUBSCRIPTION = {
  TRIAL_DAYS: 60,                 // Free trial period
  MONTHLY_PRICE_USD: 9.99,        // Monthly subscription cost
} as const;
