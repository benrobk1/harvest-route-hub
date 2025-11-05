/**
 * ADMIN QUERIES
 * Query factory pattern for admin-related queries
 * 
 * @module features/admin/queries
 * @description Centralized React Query keys for admin dashboard, user management,
 * analytics, and system monitoring.
 * 
 * @example Usage
 * ```typescript
 * // Get KPIs
 * const { data } = useQuery({ queryKey: adminQueries.kpis() });
 * 
 * // Search users
 * const { data } = useQuery({ 
 *   queryKey: adminQueries.userSearch(searchTerm, role, status) 
 * });
 * 
 * // Get pending user approvals
 * const { data } = useQuery({ queryKey: adminQueries.pendingUsers() });
 * ```
 */

export const adminQueries = {
  /**
   * Base key for all admin queries
   * @returns Base query key array for admin data
   */
  all: () => ['admin'] as const,
  
  /**
   * All admin users list
   * @returns Query key for admins
   */
  admins: () => [...adminQueries.all(), 'admins'] as const,
  
  /**
   * All lead farmers in the system
   * @returns Query key for lead farmers
   */
  leadFarmers: () => [...adminQueries.all(), 'lead-farmers'] as const,
  
  /**
   * All farm profiles (for affiliation management)
   * @returns Query key for all farms
   */
  allFarms: () => [...adminQueries.all(), 'all-farms'] as const,
  
  /**
   * Key Performance Indicators dashboard
   * @returns Query key for KPIs
   */
  kpis: () => [...adminQueries.all(), 'kpis'] as const,
  
  /**
   * System-wide metrics and statistics
   * @returns Query key for metrics
   */
  metrics: () => [...adminQueries.all(), 'metrics'] as const,
  
  /**
   * Financial analytics and revenue data
   * @returns Query key for analytics and financials
   */
  analyticsFinancials: () => [...adminQueries.all(), 'analytics-financials'] as const,
  
  /**
   * System audit logs for security and compliance
   * @returns Query key for audit logs
   */
  auditLogs: () => [...adminQueries.all(), 'audit-logs'] as const,
  
  /**
   * Recent activity feed
   * @returns Query key for recent activity
   */
  recentActivity: () => [...adminQueries.all(), 'recent-activity'] as const,
  
  /**
   * All delivery batches (for batch management)
   * @returns Query key for batches
   */
  batches: () => [...adminQueries.all(), 'batches'] as const,
  
  /**
   * Available drivers for batch assignment
   * @returns Query key for available drivers
   */
  availableDrivers: () => [...adminQueries.all(), 'available-drivers'] as const,
  
  /**
   * Credits transaction history
   * @returns Query key for credits history
   */
  creditsHistory: () => [...adminQueries.all(), 'credits-history'] as const,
  
  /**
   * Live driver tracking data
   * @returns Query key for live drivers
   */
  liveDrivers: () => [...adminQueries.all(), 'live-drivers'] as const,
  
  /**
   * Payment disputes requiring resolution
   * @returns Query key for disputes
   */
  disputes: () => [...adminQueries.all(), 'disputes'] as const,
  
  /**
   * Users pending approval (farmers, drivers, consumers)
   * @returns Query key for pending users
   */
  pendingUsers: () => [...adminQueries.all(), 'pending-users'] as const,
  
  /**
   * User search with filters
   * @param searchTerm - Search string (name, email, etc.)
   * @param roleFilter - Filter by role (farmer, driver, consumer, admin)
   * @param statusFilter - Filter by status (active, pending, suspended)
   * @returns Query key for user search results
   */
  userSearch: (searchTerm: string, roleFilter: string, statusFilter: string) => 
    [...adminQueries.all(), 'user-search', searchTerm, roleFilter, statusFilter] as const,
};
