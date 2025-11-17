/**
 * API KEY ROTATION SYSTEM
 * 
 * Manages secure API key rotation with:
 * - Version tracking
 * - Graceful transition periods
 * - Automatic expiration
 * - Audit logging
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface APIKey {
  id: string;
  service: string; // 'stripe', 'mapbox', 'osrm', etc.
  key_hash: string;
  version: number;
  status: 'active' | 'transitioning' | 'expired';
  created_at: string;
  expires_at: string;
  last_used_at?: string;
}

export interface KeyRotationResult {
  success: boolean;
  newVersion: number;
  transitionPeriod: string;
  error?: string;
}

/**
 * Hash API key for storage (one-way)
 */
async function hashAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get active API key for service
 */
export async function getActiveAPIKey(
  supabase: SupabaseClient,
  service: string
): Promise<string | null> {
  // Check environment variables first
  const envKey = Deno.env.get(`${service.toUpperCase()}_API_KEY`) ||
                 Deno.env.get(`${service.toUpperCase()}_SECRET_KEY`);
  
  if (envKey) {
    // Update last_used_at
    const keyHash = await hashAPIKey(envKey);
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash)
      .eq('service', service);
    
    return envKey;
  }

  return null;
}

/**
 * Rotate API key with transition period
 */
export async function rotateAPIKey(
  supabase: SupabaseClient,
  service: string,
  newKey: string,
  transitionDays: number = 7
): Promise<KeyRotationResult> {
  try {
    const keyHash = await hashAPIKey(newKey);
    
    // Get current active key
    const { data: currentKey } = await supabase
      .from('api_keys')
      .select('*')
      .eq('service', service)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const newVersion = (currentKey?.version || 0) + 1;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + transitionDays);

    // Mark current key as transitioning
    if (currentKey) {
      await supabase
        .from('api_keys')
        .update({ 
          status: 'transitioning',
          expires_at: expiresAt.toISOString()
        })
        .eq('id', currentKey.id);
    }

    // Insert new key
    const { error } = await supabase
      .from('api_keys')
      .insert({
        service: service,
        key_hash: keyHash,
        version: newVersion,
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
      });

    if (error) throw error;

    console.log(`[API_KEY_ROTATION] ${service} rotated to version ${newVersion}`);

    return {
      success: true,
      newVersion: newVersion,
      transitionPeriod: `${transitionDays} days`
    };
  } catch (error: any) {
    console.error('[API_KEY_ROTATION] Error:', error);
    return {
      success: false,
      newVersion: 0,
      transitionPeriod: '',
      error: error.message
    };
  }
}

/**
 * Expire old API keys
 */
export async function expireOldKeys(
  supabase: SupabaseClient
): Promise<number> {
  const { data: expiredKeys } = await supabase
    .from('api_keys')
    .select('id, service, version')
    .eq('status', 'transitioning')
    .lt('expires_at', new Date().toISOString());

  if (!expiredKeys || expiredKeys.length === 0) {
    return 0;
  }

  const ids = expiredKeys.map(k => k.id);
  await supabase
    .from('api_keys')
    .update({ status: 'expired' })
    .in('id', ids);

  console.log(`[API_KEY_ROTATION] Expired ${expiredKeys.length} keys:`, 
    expiredKeys.map(k => `${k.service} v${k.version}`).join(', ')
  );

  return expiredKeys.length;
}

/**
 * Get key rotation status for all services
 */
export async function getKeyRotationStatus(
  supabase: SupabaseClient
): Promise<{
  service: string;
  version: number;
  status: string;
  daysUntilExpiration: number;
}[]> {
  const { data: keys } = await supabase
    .from('api_keys')
    .select('*')
    .in('status', ['active', 'transitioning'])
    .order('service')
    .order('version', { ascending: false });

  if (!keys) return [];

  return keys.map(key => {
    const expiresAt = new Date(key.expires_at);
    const daysUntilExpiration = Math.floor(
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return {
      service: key.service,
      version: key.version,
      status: key.status,
      daysUntilExpiration
    };
  });
}

/**
 * Audit log for key usage
 */
export async function logKeyUsage(
  supabase: SupabaseClient,
  service: string,
  requestId: string,
  success: boolean,
  error?: string
): Promise<void> {
  await supabase.from('api_key_audit_log').insert({
    service: service,
    request_id: requestId,
    success: success,
    error_message: error,
    timestamp: new Date().toISOString()
  });
}

/**
 * Check if service needs key rotation (>90 days old)
 */
export async function checkKeyRotationNeeded(
  supabase: SupabaseClient
): Promise<string[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: oldKeys } = await supabase
    .from('api_keys')
    .select('service')
    .eq('status', 'active')
    .lt('created_at', ninetyDaysAgo.toISOString());

  return oldKeys?.map(k => k.service) || [];
}
