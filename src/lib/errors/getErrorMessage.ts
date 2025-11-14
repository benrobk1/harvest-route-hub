/**
 * List of sensitive keys that should be redacted from error messages
 */
const SENSITIVE_KEYS = new Set([
  'token',
  'password',
  'secret',
  'apiKey',
  'apikey',
  'authorization',
  'access_token',
  'refresh_token',
  'accessToken',
  'refreshToken',
]);

/**
 * Recursively redacts sensitive fields from an object
 */
function redactSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  // For objects with special toJSON or native types (Date, RegExp, etc),
  // we need to check if they have enumerable properties first
  const entries = Object.entries(obj);
  
  // If no enumerable properties, return the object as-is for JSON.stringify
  // This handles Date, RegExp, and other built-in types correctly
  if (entries.length === 0) {
    return obj;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function getErrorMessage(error: unknown): string {
  // Handle Error instances
  if (error instanceof Error && typeof error.message === 'string') {
    // In development/debug builds, we could optionally include stack trace
    // For now, just return the message for security
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle null or undefined
  if (error === null || error === undefined) {
    return 'Unknown error';
  }

  // Handle objects - redact sensitive data before serialization
  if (typeof error === 'object') {
    try {
      const redacted = redactSensitiveData(error);
      return JSON.stringify(redacted);
    } catch {
      // If serialization fails, return generic message
      return 'Unknown error';
    }
  }

  // Handle primitive types (number, boolean, etc.)
  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}
