/**
 * PAYOUT QUERIES
 * Query factory pattern for payout-related queries
 * 
 * @module features/payouts/queries
 * @description Centralized React Query keys for payout management and history.
 * Supports farmers, drivers, and lead farmer commission payouts.
 * 
 * @example Usage
 * ```typescript
 * // Get farmer payout details
 * const { data } = useQuery({ 
 *   queryKey: payoutQueries.details(userId, 'farmer') 
 * });
 * 
 * // Get driver payout history
 * const { data } = useQuery({ 
 *   queryKey: payoutQueries.history(userId, 'driver') 
 * });
 * ```
 */

export const payoutQueries = {
  /**
   * Base key for all payout queries
   * @returns Base query key array for payouts
   */
  all: () => ['payouts'] as const,
  
  /**
   * Payout details by recipient type
   * Includes current balance, pending, and recent transactions
   * 
   * @param userId - User ID
   * @param recipientType - Type of payout recipient
   * @returns Query key for payout details
   */
  details: (userId: string, recipientType: 'farmer' | 'driver' | 'lead_farmer_commission') =>
    ['payout-details', userId, recipientType] as const,
  
  /**
   * Payout history with transaction records
   * 
   * @param userId - User ID
   * @param recipientType - Type of payout recipient
   * @returns Query key for payout history
   */
  history: (userId: string, recipientType: 'farmer' | 'driver' | 'lead_farmer_commission') =>
    ['payout-history', userId, recipientType] as const,
};
