/**
 * Revenue Model for Blue Harvests
 * 
 * @module deliveryFeeHelpers
 * @description Implements revenue split calculations and delivery fee logic.
 * 
 * ## Revenue Distribution Model
 * 
 * ### Product Revenue Split (from product subtotal)
 * - **88%** → Farmer (product sellers)
 * - **2%** → Lead Farmer (collection point coordination fee)
 * - **10%** → Platform (operating costs, batch optimization, infrastructure)
 * 
 * ### Delivery Fee
 * - **$7.50** flat fee per order (100% to driver)
 * - Added on top of product subtotal at checkout
 * - **Not percentage-based** (driver earnings independent of order size)
 * - Waived for subscription members (platform absorbs cost)
 * 
 * ## Implementation Details
 * 
 * ### Why 88/2/10 Split?
 * 1. **Farmer Priority:** Maximizes earnings for producers (88%)
 * 2. **Lead Farmer Incentive:** Compensates collection point management (2%)
 * 3. **Platform Sustainability:** Covers AI optimization, infrastructure, support (10%)
 * 
 * ### Lead Farmer Role
 * - Manages collection point where farmers drop off orders
 * - Coordinates pickup schedules
 * - Quality checks before driver pickup
 * - Earns 2% commission on all orders in their batch
 * 
 * ### Driver Economics
 * - Fixed $7.50 per delivery (predictable income)
 * - Average batch: 37 deliveries = $277.50 per route
 * - Estimated 7.5 hours per route = ~$37/hour
 * - Gas and vehicle costs: Driver responsibility
 * 
 * ### Financial Flow
 * 1. Consumer pays: Product subtotal + $7.50 delivery + optional tip
 * 2. Checkout creates `transaction_fees` records for each split
 * 3. Checkout creates `payouts` records (status: pending)
 * 4. After delivery, `process-payouts` function transfers to Stripe Connect accounts
 * 
 * @example
 * ```typescript
 * // $100 order revenue split
 * const split = calculateRevenueSplit(100);
 * // { farmerShare: 88, leadFarmerShare: 2, platformFee: 10 }
 * 
 * // Driver payout for 37-delivery batch
 * const driverPayout = calculateDriverPayout(37); // $277.50
 * ```
 */

/**
 * Revenue distribution breakdown for product sales
 */
export interface RevenueSplit {
  /** Farmer's share (always 88%) */
  farmerShare: number;
  /** Lead farmer's coordination fee (always 2%) */
  leadFarmerShare: number;
  /** Platform fee (always 10%) */
  platformFee: number;
}

/**
 * Calculate revenue split from product subtotal
 * 
 * @description All farmers are affiliated with lead farmers, so split is always 88/2/10.
 * This applies only to product revenue, not delivery fees.
 * 
 * @param productSubtotal - Total product sales amount (excluding delivery fee)
 * @returns Revenue split breakdown in dollars
 * 
 * @example
 * ```typescript
 * calculateRevenueSplit(100)
 * // { farmerShare: 88, leadFarmerShare: 2, platformFee: 10 }
 * ```
 */
export function calculateRevenueSplit(productSubtotal: number): RevenueSplit {
  return {
    farmerShare: productSubtotal * 0.88,
    leadFarmerShare: productSubtotal * 0.02,
    platformFee: productSubtotal * 0.10,
  };
}

/**
 * Flat delivery fee charged per order
 * @constant
 */
export const FLAT_DELIVERY_FEE = 7.50;

/**
 * Calculate total driver payout for batch of deliveries
 * 
 * @description Each delivery earns a flat $7.50 fee (not percentage-based).
 * Driver receives total of all delivery fees in the batch.
 * 
 * @param deliveryCount - Number of deliveries in batch
 * @returns Total payout in dollars (flat fee × count)
 * 
 * @example
 * ```typescript
 * calculateDriverPayout(10) // 75.00 ($7.50 × 10)
 * ```
 */
export function calculateDriverPayout(deliveryCount: number): number {
  return Number((deliveryCount * FLAT_DELIVERY_FEE).toFixed(2));
}
