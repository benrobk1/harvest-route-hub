import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cancel order request from user ${user.id} for order ${orderId}`);

    // Get the order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, consumer_id, status, total_amount, delivery_date')
      .eq('id', orderId)
      .eq('consumer_id', user.id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order can be cancelled (pending or paid, and more than 24 hours before delivery)
    const allowedStatuses = ['pending', 'paid'];
    if (!allowedStatuses.includes(order.status)) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot cancel order with status: ${order.status}. Only pending or confirmed orders can be cancelled.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if within 24 hours of delivery
    const deliveryTime = new Date(order.delivery_date).getTime();
    const now = Date.now();
    const hoursUntilDelivery = (deliveryTime - now) / (1000 * 60 * 60);

    if (hoursUntilDelivery <= 24) {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot cancel orders within 24 hours of delivery date' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for deletion
    const supabaseServiceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Return inventory to products first
    const { data: orderItems } = await supabaseServiceClient
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        // Get current product quantity
        const { data: product } = await supabaseServiceClient
          .from('products')
          .select('available_quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          // Increment product quantity back
          await supabaseServiceClient
            .from('products')
            .update({ 
              available_quantity: product.available_quantity + item.quantity
            })
            .eq('id', item.product_id);
        }
      }
    }

    // Delete related records first (order_items will cascade, but delete others explicitly)
    await supabaseServiceClient
      .from('credits_ledger')
      .delete()
      .eq('order_id', orderId);

    await supabaseServiceClient
      .from('payment_intents')
      .delete()
      .eq('order_id', orderId);

    await supabaseServiceClient
      .from('transaction_fees')
      .delete()
      .eq('order_id', orderId);

    // Delete the order (order_items will cascade via foreign key)
    const { error: deleteError } = await supabaseServiceClient
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (deleteError) {
      console.error('Error deleting order:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Order ${orderId} permanently deleted`);

    return new Response(
      JSON.stringify({ success: true, message: 'Order cancelled and deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
