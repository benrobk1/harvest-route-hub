import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestUser {
  email: string;
  password: string;
  role: 'consumer' | 'farmer' | 'driver' | 'admin';
  full_name: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple secret check for one-time seeding
    const authHeader = req.headers.get('authorization');
    const expectedSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!authHeader || !authHeader.includes(expectedSecret || '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const testUsers: TestUser[] = [
      { email: 'test-consumer@example.com', password: 'password123', role: 'consumer', full_name: 'Test Consumer' },
      { email: 'test-farmer@example.com', password: 'password123', role: 'farmer', full_name: 'Test Farmer' },
      { email: 'test-driver@example.com', password: 'password123', role: 'driver', full_name: 'Test Driver' },
      { email: 'test-admin@example.com', password: 'password123', role: 'admin', full_name: 'Test Admin' },
    ];

    const results = [];

    for (const user of testUsers) {
      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name }
      });

      if (authError) {
        console.error(`Error creating ${user.role}:`, authError);
        results.push({ email: user.email, success: false, error: authError.message });
        continue;
      }

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: authUser.user.id, role: user.role });

      if (roleError) {
        console.error(`Error assigning role to ${user.role}:`, roleError);
        results.push({ email: user.email, success: false, error: roleError.message });
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

      results.push({ email: user.email, role: user.role, success: true });
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
