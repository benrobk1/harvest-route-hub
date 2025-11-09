import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { EdgeFunctionConfig } from '../config.ts';

/**
 * TAX INFORMATION SERVICE
 * Handles secure encryption and storage of tax data
 */
export class TaxInfoService {
  constructor(
    private supabase: SupabaseClient,
    private config: EdgeFunctionConfig
  ) {}

  /**
   * Encrypts data using AES-256-GCM
   */
  private async encryptData(plaintext: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = this.config.taxEncryptionKey;
    
    if (!key) {
      throw new Error('TAX_ENCRYPTION_KEY not configured');
    }

    // Derive encryption key from secret
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(plaintext)
    );

    // Combine salt + iv + ciphertext and encode as base64
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Stores encrypted tax information for a user
   */
  async storeTaxInfo(
    userId: string,
    taxId: string,
    taxIdType: 'EIN' | 'SSN',
    taxName: string,
    taxAddress: string
  ): Promise<void> {
    // Encrypt tax ID
    const encryptedTaxId = await this.encryptData(taxId);

    // Store in database
    const { error } = await this.supabase
      .from('profiles')
      .update({
        tax_id_encrypted: encryptedTaxId,
        tax_id_type: taxIdType,
        tax_name: taxName,
        tax_address: taxAddress,
        w9_submitted_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to store tax info: ${error.message}`);
    }
  }
}
