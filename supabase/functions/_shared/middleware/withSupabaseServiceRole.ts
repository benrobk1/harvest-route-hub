import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

import { loadConfig, type EdgeFunctionConfig } from '../config.ts';

export interface SupabaseServiceRoleContext {
  supabase: SupabaseClient;
  config: EdgeFunctionConfig;
}

export const withSupabaseServiceRole = <T extends SupabaseServiceRoleContext>(
  handler: (req: Request, ctx: T) => Promise<Response>,
): ((req: Request, ctx: Partial<T>) => Promise<Response>) => {
  return async (req: Request, ctx: Partial<T>): Promise<Response> => {
    const config = ctx.config ?? loadConfig();

    const supabase =
      ctx.supabase ??
      createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: { persistSession: false },
        global: {
          headers: { 'x-client-info': 'harvest-route-edge' },
        },
      });

    const nextContext = {
      ...ctx,
      config,
      supabase,
    } as T;

    return handler(req, nextContext);
  };
};
