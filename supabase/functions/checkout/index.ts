import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  cart_id: string;
  delivery_date: string;
  use_credits: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cart_id, delivery_date, use_credits }: CheckoutRequest = await req.json();

    console.log('Checkout request:', { user_id: user.id, cart_id, delivery_date, use_credits });

    // 1. Validate delivery address using Mapbox
    const { data: userProfile, error: profileFetchError } = await supabaseClient
      .from('profiles')
      .select('delivery_address, zip_code')
      .eq('id', user.id)
      .single();

    if (profileFetchError || !userProfile?.delivery_address) {
      return new Response(
        JSON.stringify({ error: 'MISSING_ADDRESS', message: 'Delivery address not found. Please update your profile.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Geocode and validate address with Mapbox
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (mapboxToken) {
      try {
        const encodedAddress = encodeURIComponent(userProfile.delivery_address);
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (!data.features || data.features.length === 0) {
            return new Response(
              JSON.stringify({ 
                error: 'INVALID_ADDRESS', 
                message: 'Unable to validate delivery address. Please check your address in your profile.' 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.log('Address validated:', userProfile.delivery_address);
        }
      } catch (error) {
        console.warn('Address validation failed (non-blocking):', error);
        // Continue with checkout even if validation fails
      }
    }

    // 2. Fetch and validate cart
    const { data: cart, error: cartError } = await supabaseClient
      .from('shopping_carts')
      .select('id, consumer_id')
      .eq('id', cart_id)
      .single();

    if (cartError || !cart || cart.consumer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'INVALID_CART' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch cart items with product details
    const { data: cartItems, error: itemsError } = await supabaseClient
      .from('cart_items')
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        products (
          id,
          name,
          price,
          available_quantity,
          farm_profile_id,
          farm_profiles (
            farm_name,
            farmer_id
          )
        )
      `)
      .eq('cart_id', cart_id);

    if (itemsError || !cartItems || cartItems.length === 0) {
      return new Response(JSON.stringify({ error: 'EMPTY_CART' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Get user profile for zip code
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('zip_code, delivery_address')
      .eq('id', user.id)
      .single();

    if (!profile?.zip_code || !profile?.delivery_address) {
      return new Response(JSON.stringify({ error: 'MISSING_PROFILE_INFO', message: 'Please complete your delivery address and zip code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Fetch market config for user's zip code
    const { data: marketConfig } = await supabaseClient
      .from('market_configs')
      .select('*')
      .eq('zip_code', profile.zip_code)
      .eq('active', true)
      .single();

    if (!marketConfig) {
      return new Response(JSON.stringify({ 
        error: 'NO_MARKET_CONFIG', 
        message: `No active market configuration found for ZIP code ${profile.zip_code}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Validate delivery date
    const deliveryDate = new Date(delivery_date);
    const dayOfWeek = deliveryDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    if (!marketConfig.delivery_days.includes(dayNames[dayOfWeek])) {
      return new Response(JSON.stringify({ 
        error: 'INVALID_DELIVERY_DATE',
        message: `Delivery not available on ${dayNames[dayOfWeek]} for your area`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Check cutoff time
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (deliveryDate <= tomorrow) {
      const cutoffTime = marketConfig.cutoff_time;
      const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
      const todayCutoff = new Date(now);
      todayCutoff.setHours(cutoffHour, cutoffMinute, 0, 0);

      if (now >= todayCutoff) {
        return new Response(JSON.stringify({ 
          error: 'CUTOFF_PASSED',
          message: `Orders for ${delivery_date} must be placed before ${cutoffTime}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 8. Server-side price validation and inventory check
    let subtotal = 0;
    const insufficientProducts: string[] = [];

    for (const item of cartItems) {
      const product = item.products as any;
      
      // Validate price matches (prevent tampering)
      if (item.unit_price !== product.price) {
        console.warn('Price mismatch detected:', { 
          product_id: product.id, 
          cart_price: item.unit_price, 
          actual_price: product.price 
        });
      }

      // Use server-side price
      subtotal += product.price * item.quantity;

      // Check inventory
      if (product.available_quantity < item.quantity) {
        insufficientProducts.push(`${product.name} (available: ${product.available_quantity}, requested: ${item.quantity})`);
      }
    }

    if (insufficientProducts.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'INSUFFICIENT_INVENTORY',
        products: insufficientProducts,
        message: 'Some products are out of stock'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 9. Calculate fees
    const platformFeeRate = 0.10; // 10%
    const platformFee = subtotal * platformFeeRate;
    const deliveryFee = parseFloat(marketConfig.delivery_fee.toString());
    const totalBeforeCredits = subtotal + platformFee + deliveryFee;

    // 10. Handle credits
    let creditsUsed = 0;
    if (use_credits) {
      const { data: latestCredit } = await supabaseClient
        .from('credits_ledger')
        .select('balance_after')
        .eq('consumer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const availableCredits = latestCredit?.balance_after || 0;
      creditsUsed = Math.min(availableCredits, totalBeforeCredits);
    }

    const totalAmount = totalBeforeCredits - creditsUsed;

    // 11. Validate minimum order
    if (subtotal < parseFloat(marketConfig.minimum_order.toString())) {
      return new Response(JSON.stringify({ 
        error: 'BELOW_MINIMUM_ORDER',
        minimum: marketConfig.minimum_order,
        current: subtotal,
        message: `Minimum order is $${marketConfig.minimum_order}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 12. Create order with transaction
    console.log('Creating order...');
    
    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        consumer_id: user.id,
        delivery_date,
        total_amount: totalAmount,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation failed:', orderError);
      throw new Error('Failed to create order');
    }

    console.log('Order created:', order.id);

    // Create order items
    const orderItems = cartItems.map(item => {
      const product = item.products as any;
      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: product.price * item.quantity
      };
    });

    const { error: itemsInsertError } = await supabaseClient
      .from('order_items')
      .insert(orderItems);

    if (itemsInsertError) {
      console.error('Order items creation failed:', itemsInsertError);
      throw new Error('Failed to create order items');
    }

    // Create transaction fees
    const fees = [
      {
        order_id: order.id,
        fee_type: 'platform',
        amount: platformFee,
        description: '10% platform fee'
      },
      {
        order_id: order.id,
        fee_type: 'delivery',
        amount: deliveryFee,
        description: 'Delivery fee'
      }
    ];

    const { error: feesError } = await supabaseClient
      .from('transaction_fees')
      .insert(fees);

    if (feesError) {
      console.error('Fee creation failed:', feesError);
      throw new Error('Failed to create fees');
    }

    // Decrement inventory and create reservations
    for (const item of cartItems) {
      const product = item.products as any;
      
      const { error: inventoryError } = await supabaseClient
        .from('products')
        .update({ available_quantity: product.available_quantity - item.quantity })
        .eq('id', item.product_id);

      if (inventoryError) {
        console.error('Inventory update failed:', inventoryError);
        throw new Error('Failed to update inventory');
      }

      const { error: reservationError } = await supabaseClient
        .from('inventory_reservations')
        .insert({
          product_id: item.product_id,
          consumer_id: user.id,
          order_id: order.id,
          quantity: item.quantity,
          status: 'completed',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      if (reservationError) {
        console.error('Reservation creation failed:', reservationError);
      }
    }

    // Handle credits
    if (creditsUsed > 0) {
      const { data: latestCredit } = await supabaseClient
        .from('credits_ledger')
        .select('balance_after')
        .eq('consumer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const currentBalance = latestCredit?.balance_after || 0;

      const { error: creditError } = await supabaseClient
        .from('credits_ledger')
        .insert({
          consumer_id: user.id,
          order_id: order.id,
          transaction_type: 'redemption',
          amount: -creditsUsed,
          balance_after: currentBalance - creditsUsed,
          description: `Credits redeemed for order`
        });

      if (creditError) {
        console.error('Credit redemption failed:', creditError);
      }
    }

    // Clear cart
    const { error: clearError } = await supabaseClient
      .from('cart_items')
      .delete()
      .eq('cart_id', cart_id);

    if (clearError) {
      console.error('Cart clear failed:', clearError);
    }

    console.log('Order completed successfully');

    // Send order confirmation notification
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          event_type: 'order_confirmation',
          recipient_id: user.id,
          recipient_email: user.email,
          data: {
            order_id: order.id,
            delivery_date,
            total_amount: totalAmount,
            credits_used: creditsUsed
          }
        }
      });
    } catch (notifError) {
      console.error('Notification failed (non-blocking):', notifError);
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      total_amount: totalAmount,
      credits_used: creditsUsed,
      delivery_date
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
