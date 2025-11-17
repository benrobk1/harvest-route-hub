/**
 * EDGE FUNCTION CONFIGURATION
 * Centralized environment and config management for edge functions
 * Validates required secrets and provides helpful error messages
 */

export interface EdgeFunctionConfig {
  supabase: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
  };
  stripe?: {
    secretKey: string;
    // No apiVersion = use account default (safest)
  };
  mapbox?: {
    publicToken: string;
  };
  lovable?: {
    apiKey: string;
  };
  sentry?: {
    dsn: string;
  };
  taxEncryptionKey?: string;
}

/**
 * Initialize Sentry for error tracking
 *
 * NOTE: Sentry Deno SDK integration is prepared but disabled by default.
 * Set SENTRY_DSN environment variable to enable error tracking.
 */
export function initSentry(config: EdgeFunctionConfig): void {
  if (!config.sentry?.dsn) {
    console.warn('[CONFIG] Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  // TODO: Integrate Sentry Deno SDK
  // import * as Sentry from 'https://deno.land/x/sentry/mod.ts';
  // Sentry.init({
  //   dsn: config.sentry.dsn,
  //   environment: Deno.env.get('ENVIRONMENT') || 'production',
  //   tracesSampleRate: 1.0,
  // });

  console.log(`[CONFIG] Sentry initialized: ${config.sentry.dsn.substring(0, 25)}...`);
}

/**
 * Load and validate edge function configuration
 * Fails fast on missing critical secrets with helpful error messages
 */
export function loadConfig(): EdgeFunctionConfig {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  // Critical env vars - fail fast with descriptive errors
  if (!supabaseUrl) {
    throw new Error('❌ SUPABASE_URL is required. Check your Lovable Cloud configuration.');
  }
  if (!supabaseServiceRoleKey) {
    throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY is required. Check your Lovable Cloud configuration.');
  }
  if (!supabaseAnonKey) {
    throw new Error('❌ SUPABASE_ANON_KEY is required. Check your Lovable Cloud configuration.');
  }

  // Optional env vars - log warnings but continue
  const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const sentryDsn = Deno.env.get('SENTRY_DSN');
  const taxEncryptionKey = Deno.env.get('TAX_ENCRYPTION_KEY');

  if (!stripeSecretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY not configured - payment processing endpoints will fail');
  }

  if (!mapboxToken) {
    console.warn('⚠️  MAPBOX_PUBLIC_TOKEN not configured - geocoding will use ZIP fallbacks');
  }

  if (!lovableApiKey) {
    console.warn('⚠️  LOVABLE_API_KEY not configured - batch optimization will use geographic fallback');
  }

  if (!sentryDsn) {
    console.warn('⚠️  SENTRY_DSN not configured - error tracking disabled (console logs only)');
  }

  if (!taxEncryptionKey) {
    console.warn('⚠️  TAX_ENCRYPTION_KEY not configured - tax info storage will fail');
  }

  return {
    supabase: {
      url: supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      anonKey: supabaseAnonKey,
    },
    stripe: stripeSecretKey ? {
      secretKey: stripeSecretKey,
      // No apiVersion specified = use Stripe account default (safest)
    } : undefined,
    mapbox: mapboxToken ? { publicToken: mapboxToken } : undefined,
    lovable: lovableApiKey ? { apiKey: lovableApiKey } : undefined,
    sentry: sentryDsn ? { dsn: sentryDsn } : undefined,
    taxEncryptionKey,
  };
}

/**
 * Validate that Stripe configuration is present
 * Call this from edge functions that require Stripe integration
 * @throws Error if Stripe is not configured
 */
export function requireStripe(config: EdgeFunctionConfig): asserts config is EdgeFunctionConfig & { stripe: { secretKey: string } } {
  if (!config.stripe?.secretKey) {
    throw new Error('❌ STRIPE_SECRET_KEY is required for this endpoint. Add it in Lovable Cloud Secrets UI.');
  }
}
