/**
 * Credits System Helper Functions
 * 
 * Business Rules:
 * - Earn $10 credit for each order $100+ (subscription members only)
 * - Credits available next month after earning
 * - Credits expire 30 days from issue date
 * - 1 credit = $10 discount at checkout
 */

/**
 * Calculate credits earned based on order total
 * @param orderTotal - Total order amount in dollars
 * @returns Number of credits earned (1 credit per $100 spent)
 */
export function calculateCreditsEarned(orderTotal: number): number {
  if (orderTotal < 0) return 0;
  // 1 credit per $100 spent, rounded down
  return Math.floor(orderTotal / 100);
}

/**
 * Apply credits discount to order total
 * @param orderTotal - Total order amount in dollars
 * @param creditsToUse - Number of credits to apply
 * @returns Order total after discount (minimum 0)
 */
export function applyCreditsDiscount(orderTotal: number, creditsToUse: number): number {
  const discountAmount = creditsToUse * 10; // 1 credit = $10
  // Can't discount more than order total
  return Math.max(0, orderTotal - discountAmount);
}

/**
 * Calculate subscription bonus credit for orders $100+
 * @param orderTotal - Total order amount in dollars
 * @param hasActiveSubscription - Whether user has active subscription
 * @returns Bonus credit amount ($10 if eligible, $0 otherwise)
 */
export function calculateSubscriptionBonus(
  orderTotal: number, 
  hasActiveSubscription: boolean
): number {
  if (!hasActiveSubscription) return 0;
  return orderTotal >= 100 ? 10 : 0;
}

/**
 * Calculate credits available next month based on current month earnings
 * @param ledger - Array of credit transactions
 * @returns Total credits earned this month (available next month)
 */
export function calculateAvailableNextMonth(ledger: any[]): number {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  return ledger
    .filter(entry => 
      entry.created_at.startsWith(currentMonth) && 
      entry.transaction_type === 'earned'
    )
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}
