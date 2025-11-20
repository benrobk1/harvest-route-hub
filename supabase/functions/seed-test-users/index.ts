import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  withRequestId,
  withCORS,
  withErrorHandling,
  withMetrics,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type MetricsContext,
  type SupabaseServiceRoleContext
} from '../_shared/middleware/index.ts';
import { getErrorMessage } from '../_shared/utils.ts';

/**
 * SEED TEST USERS EDGE FUNCTION
 * 
 * Development utility to create test users for all roles.
 * Requires service role key authentication.
 */

interface TestUser {
  email: string;
  password: string;
  role: 'consumer' | 'farmer' | 'driver' | 'admin';
  full_name: string;
}

type Context = RequestIdContext & CORSContext & MetricsContext & SupabaseServiceRoleContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('seeding_started');
  
  const { config, supabase: supabaseAdmin } = ctx;
  
  // Simple secret check for one-time seeding
  const authHeader = req.headers.get('authorization');
  const expectedSecret = config.supabase.serviceRoleKey;
  
  if (!authHeader || !authHeader.includes(expectedSecret)) {
    console.error(`[${ctx.requestId}] ❌ Unauthorized seed attempt`);
    ctx.metrics.mark('unauthorized_attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
      { 
        headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' }, 
        status: 401 
      }
    );
  }

  const testUsers: TestUser[] = [
    { email: 'test-consumer@example.com', password: 'password123', role: 'consumer', full_name: 'Test Consumer' },
    { email: 'test-farmer@example.com', password: 'password123', role: 'farmer', full_name: 'Test Farmer' },
    { email: 'test-driver@example.com', password: 'password123', role: 'driver', full_name: 'Test Driver' },
    { email: 'test-admin@example.com', password: 'password123', role: 'admin', full_name: 'Test Admin' },
  ];

  console.log(`[${ctx.requestId}] Creating ${testUsers.length} test users`);

  const results = [];

  for (const user of testUsers) {
    try {
      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name }
      });

      if (authError) {
        console.error(`[${ctx.requestId}] Error creating ${user.role}:`, authError);
        results.push({ email: user.email, success: false, error: authError.message });
        ctx.metrics.mark('user_creation_failed');
        continue;
      }

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: authUser.user.id, role: user.role });

      if (roleError) {
        console.error(`[${ctx.requestId}] Error assigning role to ${user.role}:`, roleError);
        results.push({ email: user.email, success: false, error: roleError.message });
        ctx.metrics.mark('role_assignment_failed');
        continue;
      }

      // Auto-approve farmers and drivers
      if (user.role === 'farmer' || user.role === 'driver') {
        await supabaseAdmin
          .from('profiles')
          .update({ 
            approval_status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', authUser.user.id);
      }

      console.log(`[${ctx.requestId}] ✅ Created ${user.role}: ${user.email}`);
      results.push({ email: user.email, role: user.role, success: true });
      ctx.metrics.mark(`user_created_${user.role}`);
    } catch (error) {
      console.error(`[${ctx.requestId}] Failed to create user ${user.email}:`, error);
      results.push({ email: user.email, success: false, error: getErrorMessage(error) });
      ctx.metrics.mark('user_creation_error');
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[${ctx.requestId}] ✅ Seeding complete: ${successCount}/${testUsers.length} successful`);
  ctx.metrics.mark('seeding_complete');

  return new Response(
    JSON.stringify({ results }),
    { headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' } }
  );
};

// Compose middleware stack (no auth needed - uses service role check)
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withMetrics('seed-test-users'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as Context));
