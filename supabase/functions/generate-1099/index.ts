import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify admin role
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user) throw new Error("Unauthorized");

    // Check admin role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) throw new Error("Admin access required");

    const { year, recipient_id } = await req.json();
    
    // Fetch recipient tax info
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', recipient_id)
      .single();
    
    if (profileError || !profile?.tax_id_encrypted) {
      throw new Error('Recipient has not submitted tax information');
    }
    
    // Fetch all completed payouts for the year
    const { data: payouts } = await supabaseClient
      .from('payouts')
      .select('amount, description')
      .eq('recipient_id', recipient_id)
      .eq('status', 'completed')
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31`);
    
    const totalAmount = payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    
    // Only generate 1099 if total >= $600 (IRS threshold)
    if (totalAmount < 600) {
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
    
    // Convert to plain Uint8Array for Response compatibility
    const buffer = new Uint8Array(pdfBytes);
    
    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="1099-NEC-${year}-${recipient_id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('1099 generation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
