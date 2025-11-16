import { z } from 'zod';

/**
 * CLIENT ENVIRONMENT VALIDATION
 * Validates required environment variables at app startup
 * Fails fast with helpful error messages
 */

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url({ message: "VITE_SUPABASE_URL must be a valid URL" }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, { message: "VITE_SUPABASE_PUBLISHABLE_KEY is required" }),
  VITE_SUPABASE_PROJECT_ID: z.string().min(1, { message: "VITE_SUPABASE_PROJECT_ID is required" }),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_', { message: "VITE_STRIPE_PUBLISHABLE_KEY must start with 'pk_'" }),
  VITE_SENTRY_DSN: z.string().url().optional(),
});

function validateEnv() {
  const result = EnvSchema.safeParse(import.meta.env);
  
  if (!result.success) {
    const missing = result.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    
    throw new Error(
      `❌ Environment configuration error:\n\n${missing}\n\n` +
      `See .env.example for required configuration.`
    );
  }
  
  // Production warnings for optional but recommended variables
  if (import.meta.env.PROD) {
    if (!import.meta.env.VITE_SENTRY_DSN) {
      console.error(
        '⚠️  PRODUCTION WARNING: VITE_SENTRY_DSN not set!\n' +
        '   Error tracking is disabled. Incidents will not be captured.\n' +
        '   Set up Sentry at: https://sentry.io/'
      );
    }
  }
  
  return result.data;
}

export const env = validateEnv();
