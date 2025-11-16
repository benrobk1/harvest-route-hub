import { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface DriverAuthContext {
  user: User;
  supabase: SupabaseClient;
}

/**
 * Driver Authentication Middleware (Curried)
 * Validates user has driver role
 * Returns 403 if not a driver
 * 
 * @example
 * const handler = withDriverAuth(async (req, ctx) => {
 *   console.log('Driver:', ctx.user.id);
 *   return new Response('OK');
 * });
 */
export const withDriverAuth = <T extends DriverAuthContext>(
  handler: (req: Request, ctx: T) => Promise<Response>
): ((req: Request, ctx: T) => Promise<Response>) => {
  return async (req: Request, ctx: T): Promise<Response> => {
    // Skip authentication for OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return handler(req, ctx);
    }
    
    const { user, supabase } = ctx;

    // Check driver role
    const { data: isDriver, error: roleErr } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'driver',
    });

    if (roleErr || !isDriver) {
      console.warn(`Driver role check failed for user ${user.id}`);
      return new Response(
        JSON.stringify({ 
          error: 'DRIVER_ROLE_REQUIRED',
          message: 'Driver role required to access this resource',
        }), 
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return handler(req, ctx);
  };
};
