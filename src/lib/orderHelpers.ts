/**
 * Frontend order status types for UI display
 */
export type OrderStatus = "ordered" | "farm_pickup" | "en_route" | "delivered";

/**
 * Maps database order status to frontend display status
 * 
 * @param dbStatus - Database status value
 * @returns Frontend status for UI display
 * 
 * @example
 * ```typescript
 * mapOrderStatus('confirmed') // 'ordered'
 * mapOrderStatus('in_transit') // 'farm_pickup'
 * ```
 */
export const mapOrderStatus = (dbStatus: string): OrderStatus => {
  switch (dbStatus) {
    case 'confirmed':
      return 'ordered';
    case 'in_transit':
      return 'farm_pickup';
    case 'out_for_delivery':
      return 'en_route';
    case 'delivered':
      return 'delivered';
    default:
      return 'ordered';
  }
};

/**
 * Formats order items into a readable summary string
 * 
 * @param items - Array of order items with products
 * @returns Formatted string like "Apples, Carrots, +2 more (15 items total)"
 * 
 * @example
 * ```typescript
 * formatOrderItems([{quantity: 5, products: {name: 'Apples'}}, ...])
 * // "Apples, Carrots, +2 more (15 items total)"
 * ```
 */
export type OrderItemSummary = {
  quantity: number;
  products: { name: string };
};

export const formatOrderItems = (items: OrderItemSummary[]): string => {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemNames = items.map(item => item.products.name).slice(0, 2).join(', ');
  
  if (items.length > 2) {
    return `${itemNames}, +${items.length - 2} more (${itemCount} items total)`;
  }
  
  if (itemNames) {
    return `${itemNames} (${itemCount} items)`;
  }
  
  return `(${itemCount} items)`;
};

/**
 * Formats minutes into a human-readable time string
 * 
 * @param minutes - Optional number of minutes
 * @returns Formatted time string like "2h 30m" or "45m", undefined if no input
 * 
 * @example
 * ```typescript
 * formatEstimatedTime(150) // "2h 30m"
 * formatEstimatedTime(45) // "45m"
 * ```
 */
export const formatEstimatedTime = (minutes?: number): string | undefined => {
  if (minutes === undefined || minutes === null) return undefined;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};
