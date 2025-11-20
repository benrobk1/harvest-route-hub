/**
 * PAYLOAD ENCRYPTION UTILITIES
 * 
 * Provides end-to-end encryption for sensitive data in requests/responses.
 * Uses AES-256-GCM for authenticated encryption.
 */

/**
 * Generate encryption key from secret
 */
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt sensitive payload
 */
export async function encryptPayload(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(secret, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(data)
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(
    salt.length + iv.length + encrypted.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Return base64 encoded
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt sensitive payload
 */
export async function decryptPayload(
  encryptedData: string,
  secret: string
): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);

  const key = await deriveKey(secret, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encrypted
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypt JSON object
 */
export async function encryptJSON<T>(
  data: T,
  secret: string
): Promise<string> {
  return encryptPayload(JSON.stringify(data), secret);
}

/**
 * Decrypt JSON object
 */
export async function decryptJSON<T>(
  encryptedData: string,
  secret: string
): Promise<T> {
  const decrypted = await decryptPayload(encryptedData, secret);
  return JSON.parse(decrypted);
}

/**
 * Hash sensitive data (one-way)
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Redact sensitive fields from logs
 */
export function redactSensitiveData<T>(
  data: T,
  sensitiveFields: string[] = ['password', 'ssn', 'credit_card', 'api_key', 'secret']
): T {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const redacted: Record<string, unknown> | unknown[] = Array.isArray(data)
    ? [...data]
    : { ...(data as Record<string, unknown>) };

  for (const key in redacted) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key], sensitiveFields);
    }
  }

  return redacted as T;
}
