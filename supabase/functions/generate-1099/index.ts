import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import {
  createMiddlewareStack,
  withAdminAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from "../_shared/middleware/index.ts";
import type { AdminAuthContext } from "../_shared/middleware/withAdminAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

const Generate1099Schema = z.object({
  year: z.number().int().min(2000, { message: "year must be >= 2000" }),
  recipient_id: z.string().uuid({ message: "recipient_id must be a valid UUID" }),
});

type Generate1099Input = z.infer<typeof Generate1099Schema>;

interface Generate1099Context
  extends RequestIdContext,
    CORSContext,
    AdminAuthContext,
    ValidationContext<Generate1099Input>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<Generate1099Context>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withValidation(Generate1099Schema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, input } = ctx;
  const { year, recipient_id } = input;

  console.log(
    `[${requestId}] [GENERATE-1099] Generating form`,
    { year, recipientId: recipient_id },
  );

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", recipient_id)
    .single();

  if (profileError) {
    console.error(
      `[${requestId}] [GENERATE-1099] Failed to load recipient`,
      profileError,
    );
    throw profileError;
  }

  if (!profile?.tax_id_encrypted) {
    throw new Error("Recipient has not submitted tax information");
  }

  // Validate tax_id_type is present to avoid runtime errors
  if (!profile.tax_id_type) {
    throw new Error("Recipient tax ID type is missing");
  }

  // Validate tax_id_last4 is present for recipient verification
  if (!profile.tax_id_last4) {
    throw new Error("Recipient tax ID last 4 digits not available");
  }

  // Load payer information from company_settings
  const { data: payerInfo, error: payerError } = await supabase
    .from("company_settings")
    .select("legal_name, tax_id")
    .single();

  if (payerError || !payerInfo) {
    console.error(
      `[${requestId}] [GENERATE-1099] Failed to load payer information`,
      payerError,
    );
    throw new Error("Failed to load payer information");
  }

  // Validate that required payer fields are non-empty
  const missingFields: string[] = [];
  if (!payerInfo.legal_name || !payerInfo.legal_name.trim()) {
    missingFields.push("legal_name");
  }
  if (!payerInfo.tax_id || !payerInfo.tax_id.trim()) {
    missingFields.push("tax_id");
  }

  if (missingFields.length > 0) {
    console.error(
      `[${requestId}] [GENERATE-1099] Missing required payer fields: ${missingFields.join(", ")}`,
      { legal_name: payerInfo.legal_name, tax_id: payerInfo.tax_id },
    );
    throw new Error("Failed to load payer information");
  }

  const { data: payouts, error: payoutsError } = await supabase
    .from("payouts")
    .select("amount, description, created_at")
    .eq("recipient_id", recipient_id)
    .eq("status", "completed")
    .gte("created_at", `${year}-01-01`)
    .lte("created_at", `${year}-12-31`);

  if (payoutsError) {
    console.error(
      `[${requestId}] [GENERATE-1099] Failed to load payouts`,
      payoutsError,
    );
    throw payoutsError;
  }

  const totalAmount = payouts?.reduce(
    (sum, payout) => sum + Number(payout.amount ?? 0),
    0,
  ) ?? 0;

  if (totalAmount < 600) {
    console.log(
      `[${requestId}] [GENERATE-1099] Below reporting threshold`,
      { totalAmount },
    );

    return new Response(
      JSON.stringify({
        below_threshold: true,
        message: `Total earnings $${totalAmount.toFixed(2)} below $600 threshold. 1099 not required.`,
        total: totalAmount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const fontSize = 10;

  page.drawText("Form 1099-NEC", {
    x: 250,
    y: height - 50,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Year: ${year}`, {
    x: 260,
    y: height - 70,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText("PAYER:", { x: 50, y: height - 120, size: fontSize, font: boldFont });
  page.drawText(payerInfo.legal_name, { x: 50, y: height - 135, size: fontSize, font });
  page.drawText(`Tax ID: ${payerInfo.tax_id}`, { x: 50, y: height - 150, size: fontSize, font });

  page.drawText("RECIPIENT:", {
    x: 350,
    y: height - 120,
    size: fontSize,
    font: boldFont,
  });
  page.drawText(profile.tax_name || profile.full_name || "", {
    x: 350,
    y: height - 135,
    size: fontSize,
    font,
  });

  // Use tax_id_last4 for recipient verification on 1099 forms
  const taxIdType = profile.tax_id_type.toUpperCase();
  const taxIdDisplay = `${taxIdType}: XXX-XX-${profile.tax_id_last4}`;

  page.drawText(taxIdDisplay, {
    x: 350,
    y: height - 150,
    size: fontSize,
    font,
  });

  if (profile.tax_address) {
    const addressLines = String(profile.tax_address).split("\n");
    addressLines.forEach((line: string, index: number) => {
      page.drawText(line, {
        x: 350,
        y: height - 165 - index * 15,
        size: fontSize,
        font,
      });
    });
  }

  page.drawText("1. Nonemployee compensation", {
    x: 50,
    y: height - 250,
    size: fontSize,
    font: boldFont,
  });
  page.drawText(`$${totalAmount.toFixed(2)}`, {
    x: 250,
    y: height - 250,
    size: 12,
    font: boldFont,
  });

  page.drawText(
    "This is a copy for your records. Please file with your tax return.",
    {
      x: 50,
      y: 50,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    },
  );

  const pdfBytes = await pdfDoc.save();
  const buffer = new Uint8Array(pdfBytes);

  return new Response(buffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="1099-NEC-${year}-${recipient_id.slice(0, 8)}.pdf"`,
    },
  });
});

serve((req) => {
  const initialContext: Partial<Generate1099Context> = {};

  return handler(req, initialContext);
});
