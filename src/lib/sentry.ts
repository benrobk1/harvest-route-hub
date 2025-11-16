import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isProduction = import.meta.env.PROD;
  
  if (!dsn) {
    if (isProduction) {
      console.error(
        '❌ CRITICAL: Sentry DSN not configured in production!\n' +
        'Error tracking is DISABLED. Set VITE_SENTRY_DSN environment variable.\n' +
        'Get your DSN from: https://sentry.io/'
      );
    } else {
      console.warn('⚠️  Sentry DSN not configured. Error tracking disabled in development.');
    }
    return;
  }
  
  console.log('✅ Initializing Sentry error tracking...');

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.breadcrumbsIntegration({
        console: true,
        dom: true,
        fetch: true,
        history: true,
        sentry: true,
      }),
    ],
    // Performance monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in production, 100% in dev
    tracePropagationTargets: ['localhost', /^https:\/\/.*\.lovableproject\.com/, /^https:\/\/.*\.lovable\.app/],
    
    // Session replay
    replaysSessionSampleRate: isProduction ? 0.05 : 0.1, // 5% in production, 10% in dev
    replaysOnErrorSampleRate: 1.0, // Always capture on errors
    
    environment: import.meta.env.MODE,
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'development',
    
    // Enhanced error filtering and tagging
    beforeSend(event, hint) {
      // Add custom context for better debugging
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          event.tags = {
            ...event.tags,
            error_type: error.name,
          };
        }
      }
      return event;
    },
  });
};

// Set user context for better error tracking
export const setSentryUser = (user: { id: string; email: string; role?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
};

// Clear user context on logout
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
export const addBreadcrumb = Sentry.addBreadcrumb;
