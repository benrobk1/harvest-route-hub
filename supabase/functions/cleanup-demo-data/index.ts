import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is an admin
    const { data: roles, error: roleError } = await supabase.rpc('has_role', {
      user_id: user.id,
      check_role: 'admin'
    });

    if (roleError || !roles) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting demo data cleanup...');

    // Delete all demo users and related data
    const demoEmails = [
      'admin@demo.com',
      'consumer1@demo.com',
      'consumer2@demo.com', 
      'consumer3@demo.com',
      'consumer4@demo.com',
      'consumer5@demo.com',
      'driver1@demo.com',
      'driver2@demo.com',
      'driver3@demo.com',
      'farmer1@demo.com',
      'farmer2@demo.com',
      'farmer3@demo.com',
      'farmer4@demo.com',
      'leadfarmer1@demo.com',
      'leadfarmer2@demo.com'
    ];

    // Get all demo user IDs
    const { data: demoProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('email', demoEmails);

    const demoUserIds = demoProfiles?.map(p => p.id) || [];

    if (demoUserIds.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No demo data found to clean up',
        deletedUsers: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${demoUserIds.length} demo users to delete`);

    // Get IDs of related entities first
    const { data: deliveryBatches } = await supabase
      .from('delivery_batches')
      .select('id')
      .or(`driver_id.in.(${demoUserIds.join(',')}),lead_farmer_id.in.(${demoUserIds.join(',')})`);
    
    const batchIds = deliveryBatches?.map(b => b.id) || [];

    const { data: batchStops } = await supabase
      .from('batch_stops')
      .select('id')
      .in('delivery_batch_id', batchIds);
    
    const batchStopIds = batchStops?.map(bs => bs.id) || [];

    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .in('consumer_id', demoUserIds);
    
    const orderIds = orders?.map(o => o.id) || [];

    const { data: carts } = await supabase
      .from('shopping_carts')
      .select('id')
      .in('consumer_id', demoUserIds);
    
    const cartIds = carts?.map(c => c.id) || [];

    const { data: farmProfiles } = await supabase
      .from('farm_profiles')
      .select('id')
      .in('farmer_id', demoUserIds);
    
    const farmProfileIds = farmProfiles?.map(fp => fp.id) || [];

    // Delete data in correct order to avoid foreign key constraints
    
    if (demoUserIds.length > 0) {
      await supabase.from('delivery_scan_logs').delete().in('driver_id', demoUserIds);
    }
    
    if (batchStopIds.length > 0) {
      await supabase.from('delivery_proofs').delete().in('batch_stop_id', batchStopIds);
    }

    if (demoUserIds.length > 0) {
      await supabase.from('delivery_ratings').delete().in('driver_id', demoUserIds);
    }
    
    if (batchIds.length > 0) {
      await supabase.from('batch_stops').delete().in('delivery_batch_id', batchIds);
      await supabase.from('batch_metadata').delete().in('delivery_batch_id', batchIds);
    }
    
    if (demoUserIds.length > 0) {
      await supabase.from('routes').delete().in('driver_id', demoUserIds);
    }
    
    if (batchIds.length > 0) {
      await supabase.from('delivery_batches').delete().in('id', batchIds);
    }
    
    if (orderIds.length > 0) {
      await supabase.from('order_items').delete().in('order_id', orderIds);
      await supabase.from('transaction_fees').delete().in('order_id', orderIds);
    }
    
    if (demoUserIds.length > 0) {
      await supabase.from('payment_intents').delete().in('consumer_id', demoUserIds);
    }
    
    if (orderIds.length > 0) {
      await supabase.from('orders').delete().in('id', orderIds);
    }
    
    if (cartIds.length > 0) {
      await supabase.from('cart_items').delete().in('cart_id', cartIds);
    }
    
    if (demoUserIds.length > 0) {
      await supabase.from('shopping_carts').delete().in('consumer_id', demoUserIds);
      await supabase.from('saved_carts').delete().in('consumer_id', demoUserIds);
      await supabase.from('credits_ledger').delete().in('consumer_id', demoUserIds);
      await supabase.from('referrals').delete().in('referrer_id', demoUserIds);
      await supabase.from('referrals').delete().in('referee_id', demoUserIds);
      await supabase.from('subscriptions').delete().in('consumer_id', demoUserIds);
      await supabase.from('inventory_reservations').delete().in('consumer_id', demoUserIds);
      await supabase.from('payouts').delete().in('recipient_id', demoUserIds);
    }
    
    if (farmProfileIds.length > 0) {
      await supabase.from('products').delete().in('farm_profile_id', farmProfileIds);
      await supabase.from('farm_photos').delete().in('farm_profile_id', farmProfileIds);
      await supabase.from('farm_affiliations').delete().in('farm_profile_id', farmProfileIds);
    }
    
    if (demoUserIds.length > 0) {
      await supabase.from('farm_affiliations').delete().in('lead_farmer_id', demoUserIds);
      await supabase.from('farm_profiles').delete().in('farmer_id', demoUserIds);
      await supabase.from('disputes').delete().in('consumer_id', demoUserIds);
      await supabase.from('disputes').delete().in('resolved_by', demoUserIds);
      await supabase.from('approval_history').delete().in('user_id', demoUserIds);
      await supabase.from('user_roles').delete().in('user_id', demoUserIds);
      await supabase.from('profiles').delete().in('id', demoUserIds);
    }
    
    // Delete auth users
    for (const userId of demoUserIds) {
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (err) {
        console.error(`Error deleting auth user ${userId}:`, err);
      }
    }

    console.log('Demo data cleanup completed successfully');

    return new Response(JSON.stringify({ 
      message: 'Demo data cleaned up successfully',
      deletedUsers: demoUserIds.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error cleaning up demo data:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
