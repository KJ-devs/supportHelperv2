/**
 * Cache TTL constants in seconds.
 * Configurable per cache key type as required by US-017.
 */
export const CacheTTL = {
  /** Ticket list queries - 5 minutes */
  TICKETS: 300,

  /** User profile data - 15 minutes */
  USER_PROFILE: 900,

  /** Analytics dashboard data - 1 hour */
  ANALYTICS: 3600,

  /** Application settings - 30 minutes */
  APPLICATIONS: 1800,

  /** Ticket stats - 10 minutes */
  TICKET_STATS: 600,
} as const;

/**
 * Cache key prefixes scoped by tenant.
 */
export const CacheKeys = {
  ticketList: (tenantId: string, hash: string) => `tenant:${tenantId}:tickets:list:${hash}`,
  ticketDetail: (tenantId: string, ticketId: string) => `tenant:${tenantId}:tickets:${ticketId}`,
  ticketStats: (tenantId: string) => `tenant:${tenantId}:tickets:stats`,

  userProfile: (tenantId: string, userId: string) => `tenant:${tenantId}:users:${userId}`,
  userList: (tenantId: string) => `tenant:${tenantId}:users:list`,

  analyticsOverview: (tenantId: string, period: string) => `tenant:${tenantId}:analytics:overview:${period}`,
  analyticsTrends: (tenantId: string, period: string, days: number) => `tenant:${tenantId}:analytics:trends:${period}:${days}`,
  analyticsPerformance: (tenantId: string) => `tenant:${tenantId}:analytics:performance`,
  analyticsAgentStats: (tenantId: string) => `tenant:${tenantId}:analytics:agents`,
  analyticsAppStats: (tenantId: string) => `tenant:${tenantId}:analytics:apps`,

  applicationList: (tenantId: string) => `tenant:${tenantId}:apps:list`,
  applicationDetail: (tenantId: string, appId: string) => `tenant:${tenantId}:apps:${appId}`,
  applicationStats: (tenantId: string, appId: string) => `tenant:${tenantId}:apps:${appId}:stats`,
} as const;
