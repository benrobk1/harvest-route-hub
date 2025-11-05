/**
 * ORDERS FEATURE MODULE
 * Public API for orders functionality
 * Centralized exports following feature-based architecture
 */

// Hooks
export { useActiveOrder } from './hooks/useActiveOrder';

// Types
export type { Order, OrderItem, OrderWithDetails } from './types';

// Queries
export { orderQueries } from './queries';
