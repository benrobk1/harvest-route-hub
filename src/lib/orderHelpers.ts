/**
 * Frontend order status types for UI display
 */
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in-transit"
  | "delivered"
  | "cancelled";

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
  const normalized = dbStatus.toLowerCase();

  switch (normalized) {
    case "pending":
      return "pending";
    case "confirmed":
      return "confirmed";
    case "in_transit":
    case "in-transit":
      return "in-transit";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
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
export const formatOrderItems = (items: any[]): string => {
  if (!items.length) return "No items";

  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const names = items
    .map(item => item.name ?? item.products?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  if (items.length === 1) {
    const [item] = items;
    const quantity = item.quantity || 0;
    const name = item.name ?? item.products?.name ?? "Item";
    return `${name} (${quantity})`;
  }

  if (items.length > 2) {
    return `${names}, +${items.length - 2} more (${itemCount} items total)`;
  }

  return `${names} (${itemCount} items)`;
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

  if (hours && mins === 0) {
    return `${hours}h`;
  }

  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};
