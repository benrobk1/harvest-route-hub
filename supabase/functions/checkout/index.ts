import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  cart_id: string;
  delivery_date: string;
  use_credits: boolean;
  payment_method_id?: string;
  tip_amount?: number;
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

    const { cart_id, delivery_date, use_credits, payment_method_id, tip_amount }: CheckoutRequest = await req.json();

    console.log('Checkout request:', { user_id: user.id, cart_id, delivery_date, use_credits, has_payment_method: !!payment_method_id, tip_amount });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

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
    const tipAmountValue = tip_amount || 0;
    const totalBeforeCredits = subtotal + platformFee + deliveryFee + tipAmountValue;

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

    console.log('Payment breakdown:', { subtotal, platformFee, deliveryFee, tipAmount: tipAmountValue, totalBeforeCredits, creditsUsed, totalAmount });

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

    // 12. Process Stripe payment if amount > 0
    let paymentIntent: Stripe.PaymentIntent | null = null;
    let paymentStatus = 'pending';

    if (totalAmount > 0) {
      console.log('Processing Stripe payment...');

      // Get or create Stripe customer
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
      let customerId: string;

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log('Found existing Stripe customer:', customerId);
      } else {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .single();

        const customer = await stripe.customers.create({
          email: user.email!,
          name: profile?.full_name || undefined,
          phone: profile?.phone || undefined,
          metadata: { supabase_user_id: user.id }
        });
        customerId = customer.id;
        console.log('Created new Stripe customer:', customerId);
      }

      // Create payment intent
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: 'usd',
        customer: customerId,
        metadata: {
          consumer_id: user.id,
          delivery_date,
          subtotal: subtotal.toFixed(2),
          platform_fee: platformFee.toFixed(2),
          delivery_fee: deliveryFee.toFixed(2),
          credits_used: creditsUsed.toFixed(2)
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      // If payment method provided, confirm immediately
      if (payment_method_id) {
        paymentIntentParams.payment_method = payment_method_id;
        paymentIntentParams.confirm = true;
        paymentIntentParams.return_url = `${req.headers.get('origin')}/consumer/order-tracking`;
      }

      try {
        paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
        console.log('Payment intent created:', paymentIntent.id, 'status:', paymentIntent.status);

        // Update payment status based on intent status
        if (paymentIntent.status === 'succeeded') {
          paymentStatus = 'paid';
        } else if (paymentIntent.status === 'requires_action') {
          paymentStatus = 'requires_action';
        }
      } catch (stripeError: any) {
        console.error('Stripe payment failed:', stripeError);
        return new Response(JSON.stringify({
          error: 'PAYMENT_FAILED',
          message: stripeError.message,
          decline_code: stripeError.decline_code
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Order fully covered by credits
      paymentStatus = 'paid';
      console.log('Order fully covered by credits');
    }

    // 13. Create order with transaction
    console.log('Creating order...');
    
    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        consumer_id: user.id,
        delivery_date,
        total_amount: totalAmount,
        tip_amount: tipAmountValue,
        status: paymentStatus === 'paid' ? 'confirmed' : 'pending'
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation failed:', orderError);
      // If payment was made, we should handle this carefully
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.error('CRITICAL: Payment succeeded but order creation failed. Payment intent:', paymentIntent.id);
        // Attempt to refund
        try {
          await stripe.refunds.create({ payment_intent: paymentIntent.id });
          console.log('Refund initiated for failed order');
        } catch (refundError) {
          console.error('Refund also failed:', refundError);
        }
      }
      throw new Error('Failed to create order');
    }

    console.log('Order created:', order.id);

    // Store payment intent record
    if (paymentIntent) {
      const { error: piError } = await supabaseClient
        .from('payment_intents')
        .insert({
          stripe_payment_intent_id: paymentIntent.id,
          order_id: order.id,
          consumer_id: user.id,
          amount: totalAmount,
          status: paymentIntent.status,
          payment_method: paymentIntent.payment_method as string || null,
          client_secret: paymentIntent.client_secret,
          metadata: paymentIntent.metadata
        });

      if (piError) {
        console.error('Failed to store payment intent:', piError);
      }
    }

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

    // Handle credits redemption
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

    // Track monthly spend and auto-apply credits for active subscribers
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('consumer_id', user.id)
      .single();

    if (subscription && subscription.status === 'active') {
      // Reset monthly spend if new month
      let currentSpend = subscription.monthly_spend || 0;
      if (subscription.monthly_spend_period !== currentMonth) {
        currentSpend = 0;
      }

      const newSpend = currentSpend + subtotal;
      const previousThreshold = Math.floor(currentSpend / 100);
      const newThreshold = Math.floor(newSpend / 100);
      
      // Update subscription with new spend
      await supabaseClient
        .from('subscriptions')
        .update({
          monthly_spend: newSpend,
          monthly_spend_period: currentMonth,
          credits_earned: subscription.credits_earned + (newThreshold - previousThreshold) * 10
        })
        .eq('id', subscription.id);

      // Auto-award $10 credit for each $100 spent
      if (newThreshold > previousThreshold) {
        const creditsToAward = (newThreshold - previousThreshold) * 10;
        const { data: latestCredit } = await supabaseClient
          .from('credits_ledger')
          .select('balance_after')
          .eq('consumer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const currentCreditBalance = latestCredit?.balance_after || 0;
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 6); // Credits expire in 6 months

        await supabaseClient
          .from('credits_ledger')
          .insert({
            consumer_id: user.id,
            order_id: order.id,
            transaction_type: 'earned',
            amount: creditsToAward,
            balance_after: currentCreditBalance + creditsToAward,
            description: `Earned $${creditsToAward} credit for spending $${newThreshold * 100}`,
            expires_at: expirationDate.toISOString()
          });

        console.log(`Auto-awarded $${creditsToAward} credit for reaching $${newThreshold * 100} in monthly spend`);
      }
    }

    // Process referral credits for first order
    const { data: existingOrders } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('consumer_id', user.id)
      .neq('id', order.id)
      .limit(1);

    const isFirstOrder = !existingOrders || existingOrders.length === 0;

    if (isFirstOrder) {
      console.log('First order detected, checking for referrals...');
      
      // Check if user was referred
      const { data: referral } = await supabaseClient
        .from('referrals')
        .select('*')
        .eq('referee_id', user.id)
        .eq('status', 'pending')
        .single();

      if (referral) {
        console.log('Referral found, awarding credit to referrer:', referral.referrer_id);
        
        // Award credit to referrer
        const { data: referrerLatestCredit } = await supabaseClient
          .from('credits_ledger')
          .select('balance_after')
          .eq('consumer_id', referral.referrer_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const referrerCurrentBalance = referrerLatestCredit?.balance_after || 0;
        const creditAmount = 25; // $25 referral credit
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 6);

        await supabaseClient
          .from('credits_ledger')
          .insert({
            consumer_id: referral.referrer_id,
            transaction_type: 'earned',
            amount: creditAmount,
            balance_after: referrerCurrentBalance + creditAmount,
            description: `Referral credit: friend completed first order`,
            expires_at: expirationDate.toISOString()
          });

        // Update referral status
        await supabaseClient
          .from('referrals')
          .update({
            status: 'completed',
            credited_at: new Date().toISOString(),
            referee_first_order_id: order.id
          })
          .eq('id', referral.id);

        console.log(`Awarded $${creditAmount} referral credit to ${referral.referrer_id}`);
      }
    }

    // 16. Create payout records for Stripe Connect
    if (paymentStatus === 'paid') {
      console.log('Creating payout records...');
      
      // Group items by farmer
      const farmerPayouts = new Map<string, { farmerId: string; amount: number; items: any[] }>();
      
      for (const item of cartItems) {
        const product = item.products as any;
        const farmProfile = product.farm_profiles as any;
        const farmerId = farmProfile.farmer_id;
        const itemSubtotal = product.price * item.quantity;
        const farmerShare = itemSubtotal * 0.90; // 90% to farmer
        
        if (farmerPayouts.has(farmerId)) {
          const existing = farmerPayouts.get(farmerId)!;
          existing.amount += farmerShare;
          existing.items.push(item);
        } else {
          farmerPayouts.set(farmerId, {
            farmerId,
            amount: farmerShare,
            items: [item]
          });
        }
      }

      // Create payout records
      const payoutInserts = [];
      
      // Farmer payouts
      for (const [farmerId, payout] of farmerPayouts.entries()) {
        // Get farmer's Stripe Connect account
        const { data: farmerProfile } = await supabaseClient
          .from('profiles')
          .select('stripe_connect_account_id, stripe_payouts_enabled')
          .eq('id', farmerId)
          .single();

        payoutInserts.push({
          order_id: order.id,
          recipient_id: farmerId,
          recipient_type: 'farmer',
          amount: payout.amount,
          stripe_connect_account_id: farmerProfile?.stripe_connect_account_id || null,
          status: farmerProfile?.stripe_payouts_enabled ? 'pending' : 'pending',
          description: `Farmer payout for ${payout.items.length} products (90% of subtotal)`
        });
      }

      // Platform fee payout
      payoutInserts.push({
        order_id: order.id,
        recipient_id: null,
        recipient_type: 'platform',
        amount: platformFee,
        status: 'completed',
        description: '10% platform fee'
      });

      // Delivery fee + tip (will be paid to driver later when assigned)
      const driverTotal = deliveryFee + tipAmountValue;
      payoutInserts.push({
        order_id: order.id,
        recipient_id: null,
        recipient_type: 'driver',
        amount: driverTotal,
        status: 'pending',
        description: `Delivery fee${tipAmountValue > 0 ? ' + $' + tipAmountValue.toFixed(2) + ' tip' : ''} (to be assigned to driver)`
      });

      const { error: payoutsError } = await supabaseClient
        .from('payouts')
        .insert(payoutInserts);

      if (payoutsError) {
        console.error('Failed to create payout records:', payoutsError);
      } else {
        console.log(`Created ${payoutInserts.length} payout records`);
      }
    }

    // 17. Clear cart
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

    const response: any = {
      success: true,
      order_id: order.id,
      total_amount: totalAmount,
      credits_used: creditsUsed,
      delivery_date,
      payment_status: paymentStatus
    };

    // Include payment intent details if action required
    if (paymentIntent && paymentIntent.status === 'requires_action') {
      response.requires_action = true;
      response.client_secret = paymentIntent.client_secret;
      response.payment_intent_id = paymentIntent.id;
    }

    return new Response(JSON.stringify(response), {
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
