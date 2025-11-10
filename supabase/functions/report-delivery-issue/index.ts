/**
 * REPORT DELIVERY ISSUE EDGE FUNCTION
 * Allows drivers and farmers to report delivery problems to admins
 * Sends immediate email and push notifications to all admins
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ReportIssueSchema = z.object({
  category: z.enum([
    'delivery_delay',
    'vehicle_problem',
    'customer_unavailable',
    'wrong_address',
    'damaged_product',
    'missing_items',
    'collection_point_issue',
    'weather_condition',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  delivery_batch_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  stop_id: z.string().uuid().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  photo_urls: z.array(z.string().url()).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] [REPORT_ISSUE] Request started`);

  try {
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.REPORT_ISSUE);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: 'TOO_MANY_REQUESTS',
        retryAfter: rateCheck.retryAfter 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate input
    const body = await req.json();
    const validated = ReportIssueSchema.parse(body);

    // Check user role
    const { data: isDriver } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'driver',
    });

    const { data: isFarmer } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'farmer',
    });

    const { data: isLeadFarmer } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'lead_farmer',
    });

    if (!isDriver && !isFarmer && !isLeadFarmer) {
      return new Response(JSON.stringify({ 
        error: 'FORBIDDEN',
        message: 'Only drivers and farmers can report issues' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reporter_type = isDriver ? 'driver' : (isLeadFarmer ? 'lead_farmer' : 'farmer');

    // Insert issue
    const { data: issue, error: insertError } = await supabase
      .from('delivery_issues')
      .insert({
        ...validated,
        reporter_id: user.id,
        reporter_type,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] Failed to insert issue:`, insertError);
      throw insertError;
    }

    console.log(`[${requestId}] Issue created: ${issue.id}`);

    // Notify admins
    await notifyAdmins(supabase, issue, requestId);

    return new Response(
      JSON.stringify({ success: true, issue_id: issue.id }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    
    if (error.name === 'ZodError') {
      return new Response(JSON.stringify({ 
        error: 'VALIDATION_ERROR',
        details: error.errors 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'INTERNAL_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function notifyAdmins(supabase: any, issue: any, requestId: string) {
  const severityEmoji: Record<string, string> = {
    low: '🔵',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  const categoryLabels: Record<string, string> = {
    delivery_delay: 'Delivery Delay',
    vehicle_problem: 'Vehicle Problem',
    customer_unavailable: 'Customer Unavailable',
    wrong_address: 'Wrong Address',
    damaged_product: 'Damaged Product',
    missing_items: 'Missing Items',
    collection_point_issue: 'Collection Point Issue',
    weather_condition: 'Weather Condition',
    other: 'Other Issue',
  };

  // Get all admin users
  const { data: admins } = await supabase
    .from('user_roles')
    .select('user_id, profiles!inner(email, full_name, push_subscription)')
    .eq('role', 'admin');

  if (!admins || admins.length === 0) {
    console.warn(`[${requestId}] No admins found to notify`);
    return;
  }

  console.log(`[${requestId}] Notifying ${admins.length} admins`);

  for (const admin of admins) {
    try {
      const profile = admin.profiles;

      // Send email notification
      await supabase.functions.invoke('send-notification', {
        body: {
          event_type: 'admin_alert',
          recipient_email: profile.email,
          data: {
            title: `${severityEmoji[issue.severity]} ${categoryLabels[issue.category]}: ${issue.title}`,
            description: issue.description,
            severity: issue.severity,
            category: issue.category,
            reporter_type: issue.reporter_type,
            issue_id: issue.id,
          },
        },
      });

      // Send push notification if enabled
      if (profile.push_subscription?.enabled) {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: admin.user_id,
            title: `${severityEmoji[issue.severity]} Delivery Issue Reported`,
            body: `${categoryLabels[issue.category]}: ${issue.title}`,
            data: { 
              issue_id: issue.id, 
              severity: issue.severity,
              type: 'delivery_issue',
            },
          },
        });
      }
    } catch (notifyError) {
      console.error(`[${requestId}] Failed to notify admin ${admin.user_id}:`, notifyError);
    }
  }
}
