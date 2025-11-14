/**
 * Breakdown of driver expenses
 */
export interface ExpenseBreakdown {
  /** Estimated fuel cost in dollars */
  fuel: number;
  /** Estimated toll cost in dollars */
  tolls: number;
  /** Total expenses (fuel + tolls) */
  total: number;
}

/**
 * Calculate estimated driver expenses for a delivery batch
 * 
 * @description Estimates fuel and toll costs based on delivery count and distance.
 * Uses assumptions: $3.50/gallon gas, 20 MPG efficiency, $50 NYC tolls, 3 miles per stop.
 * 
 * @param deliveryCount - Number of deliveries in batch
 * @param totalDistance - Optional total route distance in miles
 * @returns Breakdown of fuel, tolls, and total expenses
 * 
 * @example
 * ```typescript
 * calculateEstimatedExpenses(10) 
 * // { fuel: 5.25, tolls: 50.00, total: 55.25 }
 * ```
 */
export function calculateEstimatedExpenses(
  deliveryCount: number,
  totalDistance?: number
): ExpenseBreakdown {
  // Demo assumptions:
  // - 30 miles average route (or use actual distance)
  // - $3.50/gallon gas
  // - 20 MPG vehicle efficiency
  // - $50 tolls per day for NYC bridges
  
  const miles = totalDistance ?? (deliveryCount * 3); // ~3mi per stop avg
  const fuelCost = (miles / 20) * 3.50;
  const tollsCost = 50.00; // Flat rate for NYC area tolls

  const roundToCents = (amount: number) => Math.round(amount * 100) / 100;

  return {
    fuel: roundToCents(fuelCost),
    tolls: roundToCents(tollsCost),
    total: roundToCents(fuelCost + tollsCost)
  };
}
