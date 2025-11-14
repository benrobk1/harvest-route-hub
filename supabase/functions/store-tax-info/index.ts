import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import {
  createMiddlewareStack,
  withAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from "../_shared/middleware/index.ts";
import type { AuthContext } from "../_shared/middleware/withAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

const StoreTaxInfoSchema = z.object({
  tax_id: z.string().min(4, { message: "tax_id is required" }),
  tax_id_type: z.string().min(1, { message: "tax_id_type is required" }),
  tax_name: z.string().min(1, { message: "tax_name is required" }),
  tax_address: z.string().min(1, { message: "tax_address is required" }),
});

type StoreTaxInfoInput = z.infer<typeof StoreTaxInfoSchema>;

interface StoreTaxInfoContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    ValidationContext<StoreTaxInfoInput>,
    SupabaseServiceRoleContext {}

async function encryptData(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = Deno.env.get("TAX_ENCRYPTION_KEY");

  if (!key) {
    throw new Error("TAX_ENCRYPTION_KEY not configured");
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(plaintext),
  );

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

const stack = createMiddlewareStack<StoreTaxInfoContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withValidation(StoreTaxInfoSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, user, input } = ctx;
  const { tax_id, tax_id_type, tax_name, tax_address } = input;

  const encryptedTaxId = await encryptData(tax_id);

  const { error } = await supabase
    .from("profiles")
    .update({
      tax_id_encrypted: encryptedTaxId,
      tax_id_type,
      tax_name,
      tax_address,
      w9_submitted_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error(
      `[${requestId}] [STORE-TAX-INFO] Failed to persist tax info`,
      error,
    );
    throw error;
  }

  console.log(
    `[${requestId}] [STORE-TAX-INFO] Tax info stored successfully`,
    { userId: user.id },
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

serve((req) => {
  const initialContext: Partial<StoreTaxInfoContext> = {};

  return handler(req, initialContext);
});
