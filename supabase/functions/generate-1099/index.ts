import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { Generate1099RequestSchema } from '../_shared/contracts/admin.ts';
import { 
  withRequestId, 
  withCORS, 
  withAdminAuth,
  withValidation,
  withRateLimit,
  withErrorHandling, 
  withMetrics,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type MetricsContext,
  type ValidationContext
} from '../_shared/middleware/index.ts';

/**
 * GENERATE 1099 EDGE FUNCTION
 * 
 * Generates IRS Form 1099-NEC PDFs for recipients with $600+ earnings.
 * Uses middleware pattern with admin auth and rate limiting.
 */

type Generate1099Request = {
  year: number;
  recipient_id: string;
};

type Context = RequestIdContext & CORSContext & AuthContext & MetricsContext & ValidationContext<Generate1099Request>;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('generation_started');
  
  const config = loadConfig();
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

  const { year, recipient_id } = ctx.input;
  
  console.log(`[${ctx.requestId}] Generating 1099 for recipient ${recipient_id}, year ${year}`);
  
  // Fetch recipient tax info
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', recipient_id)
    .single();
  
  if (profileError || !profile?.tax_id_encrypted) {
    console.error(`[${ctx.requestId}] ❌ No tax info for recipient ${recipient_id}`);
    ctx.metrics.mark('no_tax_info');
    return new Response(JSON.stringify({ 
      error: 'Recipient has not submitted tax information',
      code: 'NO_TAX_INFO'
    }), {
      status: 400,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
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
    console.log(`[${ctx.requestId}] ✅ Below threshold: $${totalAmount}`);
    ctx.metrics.mark('below_threshold');
    return new Response(JSON.stringify({ 
      below_threshold: true,
      message: `Total earnings $${totalAmount.toFixed(2)} below $600 threshold. 1099 not required.`,
      total: totalAmount
    }), {
      headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
  
  ctx.metrics.mark('generating_pdf');
  
  // Generate IRS Form 1099-NEC PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
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
  
  // Payer information
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
  
  console.log(`[${ctx.requestId}] ✅ Generated 1099-NEC for ${recipient_id}: $${totalAmount.toFixed(2)}`);
  ctx.metrics.mark('pdf_generated');
  
  return new Response(buffer, {
    headers: {
      ...ctx.corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="1099-NEC-${year}-${recipient_id.slice(0, 8)}.pdf"`,
    },
  });
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withAdminAuth,
  withValidation(Generate1099RequestSchema),
  withRateLimit(RATE_LIMITS.GENERATE_1099),
  withMetrics('generate-1099'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
