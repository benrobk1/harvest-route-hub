import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { AwardCreditsRequestSchema } from '../_shared/contracts/credits.ts';
import { createMetricsCollector } from '../_shared/monitoring/metrics.ts';

/**
 * AWARD CREDITS EDGE FUNCTION
 * 
 * Admin-only function to award credits to consumers.
 * Supports earned, bonus, and refund transaction types.
 * Full middleware: RequestId + Metrics + Auth + AdminAuth + RateLimit + Validation + ErrorHandling
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Request ID for tracing
  const requestId = crypto.randomUUID();
  const metrics = createMetricsCollector(requestId, 'award-credits');
  console.log(`[${requestId}] [AWARD-CREDITS] Request started`);

  try {
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    metrics.mark('auth_complete');

    // Admin authorization
    const { data: hasAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required', code: 'UNAUTHORIZED' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Admin user ${user.id} authorized`);
    metrics.mark('admin_auth_complete');

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.AWARD_CREDITS);
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] ⚠️ Rate limit exceeded for user ${user.id}`);
      return new Response(JSON.stringify({ 
        error: 'TOO_MANY_REQUESTS', 
        message: 'Too many requests. Please try again later.',
        retryAfter: rateCheck.retryAfter,
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter || 60),
        }
      });
    }

    // Validate input
    const body = await req.json();
    const result = AwardCreditsRequestSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.flatten(),
        code: 'VALIDATION_ERROR',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      consumer_id, 
      amount, 
      description, 
      transaction_type = 'earned',
      expires_in_days = 90 
    } = result.data;

    metrics.mark('validation_complete');
    console.log(`[${requestId}] Awarding credits:`, { 
      consumer_id, 
      amount, 
      description, 
      transaction_type, 
      admin: user.id 
    });

    // Get current credit balance
    const { data: latestCredit } = await supabase
      .from('credits_ledger')
      .select('balance_after')
      .eq('consumer_id', consumer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = latestCredit?.balance_after || 0;
    const newBalance = currentBalance + amount;

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Insert credit transaction
    const { data: creditRecord, error: creditError } = await supabase
      .from('credits_ledger')
      .insert({
        consumer_id,
        transaction_type,
        amount,
        balance_after: newBalance,
        description,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (creditError) {
      console.error(`[${requestId}] ❌ Failed to award credits:`, creditError);
      throw new Error(`Credit award failed: ${creditError.message}`);
    }

    metrics.mark('credits_awarded');
    console.log(`[${requestId}] ✅ Credits awarded successfully:`, creditRecord.id);

    // Send notification to user (non-blocking)
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          event_type: 'credits_awarded',
          recipient_id: consumer_id,
          data: {
            amount,
            new_balance: newBalance,
            description,
            expires_at: expiresAt.toISOString()
          }
        }
      });
    } catch (notifError) {
      console.error(`[${requestId}] Notification failed (non-blocking):`, notifError);
    }

    const response = new Response(JSON.stringify({
      success: true,
      credit_id: creditRecord.id,
      amount_awarded: amount,
      new_balance: newBalance,
      expires_at: expiresAt.toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // Log metrics
    metrics.log({
      method: req.method,
      path: new URL(req.url).pathname,
      statusCode: 200,
      userId: user.id,
    });

    return response;

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Award credits error:`, error);
    
    // Log error metrics
    metrics.log({
      method: req.method,
      path: new URL(req.url).pathname,
      statusCode: 500,
      errorMessage: error.message,
      errorStack: error.stack,
    });

    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message,
      code: 'CREDIT_AWARD_FAILED'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
