import { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AdminAuthContext {
  user: User;
  supabase: SupabaseClient;
}

/**
 * Admin Authentication Middleware (Curried)
 * Validates JWT token and verifies user has admin role
 * Returns 403 if user is not an admin
 * 
 * @example
 * const handler = withAdminAuth(async (req, ctx) => {
 *   console.log('Admin user:', ctx.user.id);
 *   return new Response('OK');
 * });
 */
export const withAdminAuth = <T extends AdminAuthContext>(
  handler: (req: Request, ctx: T) => Promise<Response>
): ((req: Request, ctx: Partial<T>) => Promise<Response>) => {
  return async (req: Request, ctx: Partial<T>): Promise<Response> => {
    // Skip authentication for OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return handler(req, ctx as T);
    }
    
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: 'UNAUTHORIZED',
          message: 'Missing authorization header',
        }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = ctx.supabase;
    
    if (!supabase) {
      throw new Error('Supabase client must be initialized before withAdminAuth middleware');
    }

    // Authenticate user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Authentication failed:', error?.message);
      return new Response(
        JSON.stringify({ 
          error: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user has admin role using security definer function
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError) {
      console.error('Admin role check failed:', roleError);
      return new Response(
        JSON.stringify({ 
          error: 'AUTHORIZATION_ERROR',
          message: 'Failed to verify admin permissions',
        }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!isAdmin) {
      console.warn(`User ${user.id} attempted to access admin endpoint without admin role`);
      return new Response(
        JSON.stringify({ 
          error: 'FORBIDDEN',
          message: 'Admin role required for this operation',
        }), 
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Attach user to context and call handler
    const adminContext = {
      ...ctx,
      user,
    } as T;

    return handler(req, adminContext);
  };
};
