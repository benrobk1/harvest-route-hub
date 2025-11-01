import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import type { EdgeFunctionConfig } from '../config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  config: EdgeFunctionConfig;
}

/**
 * Authentication Middleware
 * Validates JWT token and attaches authenticated user to context
 * Returns 401 if authentication fails
 */
export function withAuth<T extends AuthContext>(
  handler: (req: Request, ctx: T) => Promise<Response>
) {
  return async (req: Request, initialContext: Partial<T>): Promise<Response> => {
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
    const supabase = initialContext.supabase as SupabaseClient;
    
    if (!supabase) {
      throw new Error('Supabase client must be initialized before withAuth middleware');
    }

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

    // Attach user to context and call handler
    const authContext = {
      ...initialContext,
      user,
    } as T;

    return handler(req, authContext);
  };
}
