/**
 * METRICS & OBSERVABILITY
 * 
 * Centralized metrics collection for edge functions.
 * Provides structured logging, performance tracking, and error monitoring.
 */

export interface FunctionMetrics {
  requestId: string;
  functionName: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  errorMessage?: string;
  errorStack?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMarker {
  name: string;
  timestamp: number;
}

/**
 * Metrics Collector
 * Tracks function performance and errors
 */
export class MetricsCollector {
  private startTime: number;
  private markers: PerformanceMarker[] = [];
  private requestId: string;
  private functionName: string;

  constructor(requestId: string, functionName: string) {
    this.requestId = requestId;
    this.functionName = functionName;
    this.startTime = Date.now();
  }

  /**
   * Add a performance marker
   */
  mark(name: string): void {
    this.markers.push({
      name,
      timestamp: Date.now() - this.startTime,
    });
  }

  /**
   * Get duration since start
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Log metrics to console (structured logging)
   */
  log(metrics: Partial<FunctionMetrics>): void {
    const fullMetrics: FunctionMetrics = {
      requestId: this.requestId,
      functionName: this.functionName,
      method: metrics.method || 'UNKNOWN',
      path: metrics.path || '/',
      statusCode: metrics.statusCode || 500,
      durationMs: this.getDuration(),
      userId: metrics.userId,
      errorMessage: metrics.errorMessage,
      errorStack: metrics.errorStack,
      metadata: {
        ...metrics.metadata,
        markers: this.markers,
      },
    };

    // Structured JSON logging for log aggregation tools
    console.log(JSON.stringify({
      type: 'metrics',
      timestamp: new Date().toISOString(),
      ...fullMetrics,
    }));

    // Human-readable summary
    const emoji = fullMetrics.statusCode >= 500 ? '❌' :
                  fullMetrics.statusCode >= 400 ? '⚠️' : '✅';
    
    console.log(
      `[${this.requestId}] [${this.functionName.toUpperCase()}] ${emoji} ` +
      `${fullMetrics.statusCode} ${fullMetrics.method} ${fullMetrics.path} - ` +
      `${fullMetrics.durationMs}ms` +
      (fullMetrics.userId ? ` (user: ${fullMetrics.userId.substring(0, 8)})` : '') +
      (fullMetrics.errorMessage ? ` - Error: ${fullMetrics.errorMessage}` : '')
    );
  }
}

/**
 * Create metrics collector for request
 */
export function createMetricsCollector(requestId: string, functionName: string): MetricsCollector {
  return new MetricsCollector(requestId, functionName);
}

/**
 * Log slow query warning
 */
export function logSlowQuery(requestId: string, query: string, durationMs: number, threshold = 1000): void {
  if (durationMs > threshold) {
    console.warn(JSON.stringify({
      type: 'slow_query',
      requestId,
      query: query.substring(0, 100), // Truncate for logging
      durationMs,
      threshold,
      timestamp: new Date().toISOString(),
    }));
  }
}

/**
 * Log business event (e.g., order created, payout processed)
 */
export function logBusinessEvent(
  requestId: string,
  eventType: string,
  details: Record<string, unknown>
): void {
  console.log(JSON.stringify({
    type: 'business_event',
    requestId,
    eventType,
    details,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Log security event (e.g., failed auth, rate limit exceeded)
 */
export function logSecurityEvent(
  requestId: string,
  eventType: string,
  userId: string | undefined,
  details: Record<string, unknown>
): void {
  console.warn(JSON.stringify({
    type: 'security_event',
    requestId,
    eventType,
    userId,
    details,
    timestamp: new Date().toISOString(),
  }));
}
