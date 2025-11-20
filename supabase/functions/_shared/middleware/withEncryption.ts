/**
 * ENCRYPTION MIDDLEWARE
 * 
 * Automatically encrypts/decrypts sensitive request/response payloads.
 * Use for endpoints handling PII or financial data.
 */

import { encryptJSON, decryptJSON } from '../security/encryption.ts';

export interface EncryptionContext {
  requestId: string;
  encryptionEnabled: boolean;
  encryptionSecret: string;
}

/**
 * Encryption Middleware
 * Encrypts responses and decrypts requests for sensitive endpoints
 * 
 * @example
 * const handler = withEncryption(async (req, ctx) => {
 *   // Request body is automatically decrypted
 *   // Response will be automatically encrypted
 *   return new Response(JSON.stringify({ ssn: '123-45-6789' }));
 * });
 */
export const withEncryption = <T extends EncryptionContext>(
  handler: (req: Request, ctx: T) => Promise<Response>
): ((req: Request, ctx: T) => Promise<Response>) => {
  return async (req: Request, ctx: T): Promise<Response> => {
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
    
    if (!encryptionSecret) {
      console.warn(`[${ctx.requestId}] [ENCRYPTION] No encryption secret configured`);
      return handler(req, ctx);
    }

    const encryptionContext = {
      ...ctx,
      encryptionEnabled: true,
      encryptionSecret
    } as T;

    // Decrypt request if needed
    let modifiedRequest = req;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        const encryptedBody = await req.text();
        if (encryptedBody.startsWith('encrypted:')) {
          const encrypted = encryptedBody.replace('encrypted:', '');
          const decrypted = await decryptJSON(encrypted, encryptionSecret);
          
          modifiedRequest = new Request(req.url, {
            method: req.method,
            headers: req.headers,
            body: JSON.stringify(decrypted)
          });
          
          console.log(`[${ctx.requestId}] [ENCRYPTION] Request decrypted`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${ctx.requestId}] [ENCRYPTION] Decryption failed:`, errorMessage);
        return new Response(
          JSON.stringify({ error: 'Failed to decrypt request' }),
          { status: 400 }
        );
      }
    }

    // Call handler
    const response = await handler(modifiedRequest, encryptionContext);

    // Encrypt response if requested
    const acceptEncryption = req.headers.get('x-accept-encryption') === 'true';
    if (acceptEncryption && response.ok) {
      try {
        const responseData = await response.json();
        const encrypted = await encryptJSON(responseData, encryptionSecret);
        
        console.log(`[${ctx.requestId}] [ENCRYPTION] Response encrypted`);
        
        return new Response(
          JSON.stringify({ encrypted: true, data: encrypted }),
          {
            status: response.status,
            headers: {
              ...Object.fromEntries(response.headers.entries()),
              'x-encrypted': 'true'
            }
          }
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${ctx.requestId}] [ENCRYPTION] Encryption failed:`, errorMessage);
        // Return unencrypted on encryption failure
        return response;
      }
    }

    return response;
  };
};
