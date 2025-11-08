/**
 * Credits System Helper Functions
 * 
 * @module creditsHelpers
 * @description Handles credit calculations for Blue Harvests rewards program.
 * 
 * ## Business Rules
 * 
 * ### Earning Credits
 * - **Rate:** $10 credit per $100 spent (10% cashback)
 * - **Eligibility:** Subscription members only
 * - **Calculation:** Rounded down (e.g., $199 spent = $10 credit, not $20)
 * - **Minimum:** No minimum order to earn (but $25 min to checkout)
 * 
 * ### Using Credits
 * - **Value:** 1 credit = $10 discount at checkout
 * - **Limit:** Can use up to 100% of order total
 * - **Timing:** Credits available immediately upon earning (not next month)
 * - **Expiration:** Credits expire 12 months after earning
 * 
 * ### Referral Bonus
 * - **Amount:** $25 credit for both referrer and referee
 * - **Trigger:** When referee places first order
 * - **Expiration:** 12 months from issue date
 * 
 * ### Database Integration
 * - All transactions logged in `credits_ledger` table
 * - `transaction_type`: 'earned' | 'redeemed' | 'referral_bonus' | 'expired'
 * - `balance_after` tracks running balance
 * - `expires_at` enforces 12-month expiration
 * 
 * @example
 * ```typescript
 * // Earning credits on $150 order
 * const creditsEarned = calculateCreditsEarned(150); // 1 credit ($10)
 * 
 * // Applying credits at checkout
 * const finalTotal = applyCreditsDiscount(50, 2); // $50 - $20 = $30
 * 
 * // Subscription bonus check
 * const bonus = calculateSubscriptionBonus(100, true); // $10
 * ```
 */

/**
 * Calculate credits earned based on order total
 * 
 * @param orderTotal - Total order amount in dollars
 * @returns Number of credits earned (1 credit = $10 value per $100 spent)
 * 
 * @remarks
 * - Uses `Math.floor()` to round down (no partial credits)
 * - Minimum $0.01 to earn, but checkout has $25 minimum
 * - Only called for users with active subscriptions
 * - Credits logged in `credits_ledger` with 12-month expiration
 * 
 * @example
 * ```typescript
 * calculateCreditsEarned(99)   // 0 credits (under threshold)
 * calculateCreditsEarned(100)  // 1 credit ($10 value)
 * calculateCreditsEarned(199)  // 1 credit (rounded down)
 * calculateCreditsEarned(250)  // 2 credits ($20 value)
 * ```
 */
export function calculateCreditsEarned(orderTotal: number): number {
  if (orderTotal < 0) return 0;
  // 1 credit per $100 spent, rounded down
  return Math.floor(orderTotal / 100);
}

/**
 * Apply credits discount to order total
 * 
 * @param orderTotal - Total order amount in dollars
 * @param creditsToUse - Number of credits to apply
 * @returns Order total after discount (minimum $0, cannot go negative)
 * 
 * @remarks
 * - 1 credit = $10 discount
 * - Can use credits for up to 100% of order
 * - Excess credits are not applied (order total floors at $0)
 * - Frontend validates available balance before submission
 * - Credits deducted via `credits_ledger` transaction
 * 
 * @example
 * ```typescript
 * applyCreditsDiscount(50, 2)   // $50 - $20 = $30
 * applyCreditsDiscount(50, 5)   // $50 - $50 = $0 (capped)
 * applyCreditsDiscount(50, 10)  // $50 - $100 = $0 (not -$50)
 * ```
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
