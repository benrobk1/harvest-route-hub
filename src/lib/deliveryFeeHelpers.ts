/**
 * Delivery Fee & Revenue Split Helper Functions
 * 
 * Revenue Model: 90/5/5 Split
 * - 90% to farmer (higher than traditional grocery ~40-50%)
 * - 5% platform fee (operations, support, infrastructure)
 * - 5% delivery fee (driver payouts, route optimization)
 */

export interface RevenueSplit {
  farmerShare: number;
  platformFee: number;
  deliveryFee: number;
}

/**
 * Calculate 90/5/5 revenue split
 * @param orderTotal - Total order amount in dollars
 * @returns Split breakdown for farmer, platform, and delivery
 */
export function calculateRevenueSplit(orderTotal: number): RevenueSplit {
  return {
    farmerShare: orderTotal * 0.90,
    platformFee: orderTotal * 0.05,
    deliveryFee: orderTotal * 0.05,
  };
}

/**
 * Calculate 5% delivery fee
 * @param orderTotal - Total order amount in dollars
 * @returns Delivery fee amount (rounded to 2 decimals)
 */
export function calculateDeliveryFee(orderTotal: number): number {
  return Number((orderTotal * 0.05).toFixed(2));
}

/**
 * Calculate total driver payout for batch of deliveries
 * @param deliveries - Array of deliveries with subtotal amounts
 * @returns Total payout (sum of all delivery fees)
 */
export function calculateDriverPayout(
  deliveries: Array<{ subtotal: number }>
): number {
  const totalDeliveryFees = deliveries.reduce(
    (sum, delivery) => sum + calculateDeliveryFee(delivery.subtotal),
    0
  );
  return Number(totalDeliveryFees.toFixed(2));
}
