import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { loadConfig } from '../_shared/config.ts';
import { withAdminAuth } from '../_shared/middleware/withAdminAuth.ts';
import { withCORS } from '../_shared/middleware/withCORS.ts';
import { withRequestId } from '../_shared/middleware/withRequestId.ts';
import { withErrorHandling } from '../_shared/middleware/withErrorHandling.ts';
import { withRateLimit } from '../_shared/middleware/withRateLimit.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { Generate1099RequestSchema } from '../_shared/contracts/admin.ts';

/**
 * GENERATE 1099 EDGE FUNCTION
 * 
 * Generates IRS Form 1099-NEC PDFs for recipients with $600+ earnings.
 * Requires admin authentication and validation.
 */

serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  try {
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    console.log(`[${requestId}] [GENERATE-1099] Request started`);

    // Authenticate admin user
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

    // Check admin role
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

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.GENERATE_1099);
    if (!rateCheck.allowed) {
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
    const result = Generate1099RequestSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.flatten(),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { year, recipient_id } = result.data;
    
    // Fetch recipient tax info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', recipient_id)
      .single();
    
    if (profileError || !profile?.tax_id_encrypted) {
      return new Response(JSON.stringify({ 
        error: 'Recipient has not submitted tax information',
        code: 'NO_TAX_INFO'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Fetch all completed payouts for the year
    const { data: payouts } = await supabase
      .from('payouts')
      .select('amount, description')
      .eq('recipient_id', recipient_id)
      .eq('status', 'completed')
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31`);
    
    const totalAmount = payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    
    // Only generate 1099 if total >= $600 (IRS threshold)
    if (totalAmount < 600) {
      console.log(`[${requestId}] ✅ Below threshold: $${totalAmount}`);
      return new Response(JSON.stringify({ 
        below_threshold: true,
        message: `Total earnings $${totalAmount.toFixed(2)} below $600 threshold. 1099 not required.`,
        total: totalAmount
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // Generate IRS Form 1099-NEC PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard 8.5x11 letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const { height } = page.getSize();
    const fontSize = 10;
    
    // Form header
    page.drawText('Form 1099-NEC', { 
      x: 250, 
      y: height - 50, 
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(`Year: ${year}`, { 
      x: 260, 
      y: height - 70, 
      size: 12,
      font: font,
      color: rgb(0, 0, 0)
    });
    
    // Payer information (Blue Harvests)
    page.drawText('PAYER:', { x: 50, y: height - 120, size: fontSize, font: boldFont });
    page.drawText('Blue Harvests Inc.', { x: 50, y: height - 135, size: fontSize, font: font });
    page.drawText('Tax ID: XX-XXXXXXX', { x: 50, y: height - 150, size: fontSize, font: font });
    
    // Recipient information
    page.drawText('RECIPIENT:', { x: 350, y: height - 120, size: fontSize, font: boldFont });
    page.drawText(profile.tax_name || profile.full_name, { x: 350, y: height - 135, size: fontSize, font: font });
    page.drawText(`${profile.tax_id_type.toUpperCase()}: XXX-XX-${profile.tax_id_encrypted.slice(-4)}`, { 
      x: 350, 
      y: height - 150, 
      size: fontSize, 
      font: font 
    });
    
    if (profile.tax_address) {
      const addressLines = profile.tax_address.split('\n');
      addressLines.forEach((line: string, i: number) => {
        page.drawText(line, { 
          x: 350, 
          y: height - 165 - (i * 15), 
          size: fontSize, 
          font: font 
        });
      });
    }
    
    // Box 1: Nonemployee compensation
    page.drawText('1. Nonemployee compensation', { 
      x: 50, 
      y: height - 250, 
      size: fontSize, 
      font: boldFont 
    });
    page.drawText(`$${totalAmount.toFixed(2)}`, { 
      x: 250, 
      y: height - 250, 
      size: 12, 
      font: boldFont 
    });
    
    // Footer
    page.drawText('This is a copy for your records. Please file with your tax return.', {
      x: 50,
      y: 50,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    const pdfBytes = await pdfDoc.save();
    const buffer = new Uint8Array(pdfBytes);
    
    console.log(`[${requestId}] ✅ Generated 1099-NEC for ${recipient_id}: $${totalAmount.toFixed(2)}`);
    
    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="1099-NEC-${year}-${recipient_id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error(`[${requestId}] ❌ 1099 generation error:`, error);
    return new Response(JSON.stringify({ 
      error: error.message,
      code: 'GENERATION_FAILED'
    }), {
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json' 
      },
      status: 500,
    });
  }
});

// Helper function for rate limiting
async function checkRateLimit(
  supabase: any,
  userId: string,
  config: { maxRequests: number; windowMs: number; keyPrefix: string }
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `${config.keyPrefix}:${userId}`;

  const { data: recentRequests, error } = await supabase
    .from('rate_limits')
    .select('created_at')
    .eq('key', key)
    .gte('created_at', new Date(windowStart).toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }

  const requestCount = recentRequests?.length || 0;

  if (requestCount >= config.maxRequests) {
    const oldestRequest = new Date(recentRequests[0].created_at).getTime();
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  await supabase
    .from('rate_limits')
    .insert({ key, created_at: new Date().toISOString() });

  await supabase
    .from('rate_limits')
    .delete()
    .eq('key', key)
    .lt('created_at', new Date(windowStart).toISOString());

  return { allowed: true };
}
