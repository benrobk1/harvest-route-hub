import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DemoUser {
  email: string;
  password: string;
  full_name: string;
  roles: string[];
  profile?: any;
}

const DEMO_PASSWORD = "demo123456";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting full demo data seeding...');

    // Step 1: Delete existing demo data
    console.log('Deleting existing demo users...');
    const { data: demoUsers } = await supabase.auth.admin.listUsers();
    const demoEmails = demoUsers?.users.filter(u => u.email?.endsWith('@demo.com')) || [];
    
    for (const demoUser of demoEmails) {
      await supabase.auth.admin.deleteUser(demoUser.id);
    }

    // Clean up orphaned market configs
    await supabase.from('market_configs').delete().eq('zip_code', '10001');
    await supabase.from('market_configs').delete().eq('zip_code', '10002');
    await supabase.from('market_configs').delete().eq('zip_code', '10003');
    await supabase.from('market_configs').delete().eq('zip_code', '10010');
    await supabase.from('market_configs').delete().eq('zip_code', '10011');

    // Step 2: Create all user accounts
    console.log('Creating user accounts...');
    
    const users: DemoUser[] = [
      { email: 'admin@demo.com', password: DEMO_PASSWORD, full_name: 'Demo Admin', roles: ['admin'] },
      { email: 'leadfarmer@demo.com', password: DEMO_PASSWORD, full_name: 'Sarah Johnson', roles: ['lead_farmer'], profile: { farm_name: 'Valley Collection Point', collection_point_address: '123 Farm Road, Hudson Valley, NY 10001' } },
      { email: 'farmer1@demo.com', password: DEMO_PASSWORD, full_name: 'Mike Thompson', roles: ['farmer'], profile: { farm_name: 'Thompson Family Farm', location: 'Hudson Valley, NY', description: 'Organic vegetables and fruits' } },
      { email: 'farmer2@demo.com', password: DEMO_PASSWORD, full_name: 'Lisa Chen', roles: ['farmer'], profile: { farm_name: 'Chen Organic Gardens', location: 'Catskills, NY', description: 'Asian vegetables and herbs' } },
      { email: 'farmer3@demo.com', password: DEMO_PASSWORD, full_name: 'Carlos Rodriguez', roles: ['farmer'], profile: { farm_name: 'Rodriguez Dairy', location: 'Finger Lakes, NY', description: 'Fresh dairy and cheese' } },
      { email: 'farmer4@demo.com', password: DEMO_PASSWORD, full_name: 'Emily White', roles: ['farmer'], profile: { farm_name: 'White Acres', location: 'Adirondacks, NY', description: 'Free-range eggs and poultry' } },
      { email: 'farmer5@demo.com', password: DEMO_PASSWORD, full_name: 'David Brown', roles: ['farmer'], profile: { farm_name: 'Brown Bee Farm', location: 'Finger Lakes, NY', description: 'Honey and beeswax products' } },
      { email: 'farmer6@demo.com', password: DEMO_PASSWORD, full_name: 'Anna Martinez', roles: ['farmer'], profile: { farm_name: 'Martinez Bakery', location: 'Hudson Valley, NY', description: 'Artisan breads and pastries' } },
      { email: 'driver1@demo.com', password: DEMO_PASSWORD, full_name: 'John Driver', roles: ['driver'], profile: { vehicle_type: 'Refrigerated Van', vehicle_make: 'Ford Transit' } },
      { email: 'driver2@demo.com', password: DEMO_PASSWORD, full_name: 'Maria Santos', roles: ['driver'], profile: { vehicle_type: 'Pickup Truck', vehicle_make: 'Toyota Tacoma' } },
      { email: 'driver3@demo.com', password: DEMO_PASSWORD, full_name: 'James Wilson', roles: ['driver'], profile: { vehicle_type: 'Cargo Van', vehicle_make: 'Mercedes Sprinter' } },
    ];

    // Add 12 consumers
    for (let i = 1; i <= 12; i++) {
      users.push({
        email: `consumer${i}@demo.com`,
        password: DEMO_PASSWORD,
        full_name: `Consumer ${i}`,
        roles: ['consumer'],
        profile: {
          street_address: `${100 + i} Main St`,
          city: 'New York',
          state: 'NY',
          zip_code: i <= 4 ? '10001' : i <= 8 ? '10002' : '10003',
          phone: `555-010${i.toString().padStart(2, '0')}`,
        }
      });
    }

    const createdUserIds: { [email: string]: string } = {};
    
    for (const user of users) {
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name }
      });

      if (signUpError) {
        console.error(`Error creating user ${user.email}:`, signUpError);
        continue;
      }

      const userId = authData.user.id;
      createdUserIds[user.email] = userId;

      // Update profile with additional info
      if (user.profile) {
        await supabase.from('profiles').update(user.profile).eq('id', userId);
      }

      // Approve all users
      await supabase.from('profiles').update({
        approval_status: 'approved',
        approved_at: new Date().toISOString()
      }).eq('id', userId);

      // Assign roles
      for (const role of user.roles) {
        await supabase.from('user_roles').insert({
          user_id: userId,
          role: role
        });
      }
    }

    // Step 3: Create farm profiles and products
    console.log('Creating farm profiles and products...');
    
    const farmProfiles: { [email: string]: string } = {};
    const farmerEmails = ['farmer1@demo.com', 'farmer2@demo.com', 'farmer3@demo.com', 'farmer4@demo.com', 'farmer5@demo.com', 'farmer6@demo.com', 'leadfarmer@demo.com'];
    
    for (const email of farmerEmails) {
      const userId = createdUserIds[email];
      const user = users.find(u => u.email === email)!;
      
      const { data: farmProfile } = await supabase.from('farm_profiles').insert({
        farmer_id: userId,
        farm_name: user.profile?.farm_name,
        location: user.profile?.location,
        description: user.profile?.description
      }).select().single();

      if (farmProfile) {
        farmProfiles[email] = farmProfile.id;
      }
    }

    // Create products for each farm
    const products: { [farmEmail: string]: any[] } = {
      'farmer1@demo.com': [
        { name: 'Organic Tomatoes', price: 4.99, unit: 'lb', available_quantity: 50 },
        { name: 'Fresh Lettuce', price: 3.49, unit: 'head', available_quantity: 40 },
        { name: 'Baby Carrots', price: 3.99, unit: 'lb', available_quantity: 60 },
        { name: 'Green Beans', price: 4.49, unit: 'lb', available_quantity: 35 },
        { name: 'Bell Peppers', price: 5.99, unit: 'lb', available_quantity: 45 },
        { name: 'Cucumbers', price: 2.99, unit: 'each', available_quantity: 50 },
        { name: 'Zucchini', price: 3.49, unit: 'lb', available_quantity: 40 },
        { name: 'Summer Squash', price: 3.99, unit: 'lb', available_quantity: 30 },
      ],
      'farmer2@demo.com': [
        { name: 'Bok Choy', price: 3.99, unit: 'bunch', available_quantity: 35 },
        { name: 'Chinese Cabbage', price: 2.99, unit: 'head', available_quantity: 30 },
        { name: 'Thai Basil', price: 4.49, unit: 'bunch', available_quantity: 25 },
        { name: 'Lemongrass', price: 3.49, unit: 'bunch', available_quantity: 20 },
        { name: 'Ginger Root', price: 5.99, unit: 'lb', available_quantity: 15 },
        { name: 'Snow Peas', price: 6.99, unit: 'lb', available_quantity: 25 },
      ],
      'farmer3@demo.com': [
        { name: 'Fresh Milk', price: 6.99, unit: 'gallon', available_quantity: 40 },
        { name: 'Cheddar Cheese', price: 8.99, unit: 'lb', available_quantity: 25 },
        { name: 'Greek Yogurt', price: 5.49, unit: 'quart', available_quantity: 30 },
        { name: 'Butter', price: 7.99, unit: 'lb', available_quantity: 20 },
        { name: 'Fresh Cream', price: 4.99, unit: 'pint', available_quantity: 15 },
      ],
      'farmer4@demo.com': [
        { name: 'Farm Fresh Eggs', price: 6.99, unit: 'dozen', available_quantity: 60 },
        { name: 'Free-Range Chicken', price: 14.99, unit: 'lb', available_quantity: 20 },
        { name: 'Duck Eggs', price: 8.99, unit: 'dozen', available_quantity: 15 },
      ],
      'farmer5@demo.com': [
        { name: 'Wildflower Honey', price: 12.99, unit: 'jar', available_quantity: 30 },
        { name: 'Raw Honeycomb', price: 15.99, unit: 'piece', available_quantity: 10 },
        { name: 'Beeswax Candles', price: 8.99, unit: 'each', available_quantity: 25 },
        { name: 'Honey Sticks', price: 4.99, unit: 'pack', available_quantity: 40 },
      ],
      'farmer6@demo.com': [
        { name: 'Sourdough Bread', price: 7.99, unit: 'loaf', available_quantity: 35 },
        { name: 'Croissants', price: 9.99, unit: 'pack of 6', available_quantity: 20 },
        { name: 'Cinnamon Rolls', price: 11.99, unit: 'pack of 4', available_quantity: 15 },
        { name: 'Whole Wheat Bread', price: 6.99, unit: 'loaf', available_quantity: 30 },
      ],
    };

    const productIds: string[] = [];
    
    for (const [email, items] of Object.entries(products)) {
      const farmProfileId = farmProfiles[email];
      for (const item of items) {
        const { data: product } = await supabase.from('products').insert({
          farm_profile_id: farmProfileId,
          name: item.name,
          price: item.price,
          unit: item.unit,
          available_quantity: item.available_quantity,
          approved: true,
          approved_at: new Date().toISOString()
        }).select().single();
        
        if (product) {
          productIds.push(product.id);
        }
      }
    }

    // Step 4: Create farm affiliations
    console.log('Creating farm affiliations...');
    const leadFarmerId = createdUserIds['leadfarmer@demo.com'];
    
    for (const email of ['farmer1@demo.com', 'farmer2@demo.com', 'farmer3@demo.com', 'farmer4@demo.com', 'farmer5@demo.com', 'farmer6@demo.com']) {
      await supabase.from('farm_affiliations').insert({
        lead_farmer_id: leadFarmerId,
        farm_profile_id: farmProfiles[email],
        commission_rate: 2.0,
        active: true
      });
    }

    // Step 5: Create market configs
    console.log('Creating market configs...');
    const marketConfigs = [
      { zip_code: '10001', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '10002', delivery_fee: 6.99, minimum_order: 30, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '10003', delivery_fee: 7.99, minimum_order: 35, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '10010', delivery_fee: 8.99, minimum_order: 30, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '10011', delivery_fee: 9.99, minimum_order: 35, delivery_days: ['Wednesday', 'Saturday'] },
    ];

    for (const config of marketConfigs) {
      await supabase.from('market_configs').insert({
        ...config,
        collection_point_id: leadFarmerId,
        cutoff_time: '12:00:00',
        active: true
      });
    }

    // Step 6: Create historical orders (30 completed)
    console.log('Creating historical orders...');
    const orderIds: string[] = [];
    
    for (let i = 0; i < 30; i++) {
      const consumerNum = (i % 12) + 1;
      const consumerId = createdUserIds[`consumer${consumerNum}@demo.com`];
      const daysAgo = Math.floor(Math.random() * 14) + 1; // 1-14 days ago
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() - daysAgo);
      
      // Random selection of 2-5 products
      const numItems = Math.floor(Math.random() * 4) + 2;
      const selectedProducts = productIds.sort(() => 0.5 - Math.random()).slice(0, numItems);
      
      let totalAmount = 0;
      const orderItems: any[] = [];
      
      for (const productId of selectedProducts) {
        const { data: product } = await supabase.from('products').select('price').eq('id', productId).single();
        const quantity = Math.floor(Math.random() * 3) + 1;
        const subtotal = product!.price * quantity;
        totalAmount += subtotal;
        
        orderItems.push({
          product_id: productId,
          quantity,
          unit_price: product!.price,
          subtotal
        });
      }
      
      totalAmount += 5.99; // delivery fee
      const tipAmount = Math.floor(Math.random() * 10) + 2; // $2-$11
      totalAmount += tipAmount;
      
      const { data: order } = await supabase.from('orders').insert({
        consumer_id: consumerId,
        delivery_date: deliveryDate.toISOString().split('T')[0],
        total_amount: totalAmount,
        tip_amount: tipAmount,
        status: 'delivered',
        box_code: `B${Math.floor(i / 15) + 1}-${(i % 15) + 1}`
      }).select().single();
      
      if (order) {
        orderIds.push(order.id);
        
        // Create order items
        for (const item of orderItems) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            ...item
          });
        }
      }
    }

    // Step 7: Create pending orders (8)
    console.log('Creating pending orders...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    for (let i = 0; i < 8; i++) {
      const consumerNum = (i % 12) + 1;
      const consumerId = createdUserIds[`consumer${consumerNum}@demo.com`];
      
      const numItems = Math.floor(Math.random() * 4) + 2;
      const selectedProducts = productIds.sort(() => 0.5 - Math.random()).slice(0, numItems);
      
      let totalAmount = 0;
      const orderItems: any[] = [];
      
      for (const productId of selectedProducts) {
        const { data: product } = await supabase.from('products').select('price').eq('id', productId).single();
        const quantity = Math.floor(Math.random() * 3) + 1;
        const subtotal = product!.price * quantity;
        totalAmount += subtotal;
        
        orderItems.push({
          product_id: productId,
          quantity,
          unit_price: product!.price,
          subtotal
        });
      }
      
      totalAmount += 5.99;
      
      const { data: order } = await supabase.from('orders').insert({
        consumer_id: consumerId,
        delivery_date: tomorrowStr,
        total_amount: totalAmount,
        tip_amount: 0,
        status: 'pending'
      }).select().single();
      
      if (order) {
        for (const item of orderItems) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            ...item
          });
        }
      }
    }

    // Step 8: Create active delivery batches with stops
    console.log('Creating delivery batches...');
    const today = new Date().toISOString().split('T')[0];
    
    // Batch 1: 37 stops for driver1
    const { data: batch1 } = await supabase.from('delivery_batches').insert({
      lead_farmer_id: leadFarmerId,
      driver_id: createdUserIds['driver1@demo.com'],
      delivery_date: today,
      batch_number: 1,
      estimated_duration_minutes: 450,
      zip_codes: ['10001', '10002'],
      status: 'in_progress'
    }).select().single();

    if (batch1) {
      // Create 37 stops (use first 37 completed orders)
      for (let i = 0; i < Math.min(37, orderIds.length); i++) {
        const orderId = orderIds[i];
        const status = i < 10 ? 'delivered' : i < 15 ? 'in_progress' : 'pending';
        const addressVisible = i < 18; // First 18 visible
        
        await supabase.from('batch_stops').insert({
          delivery_batch_id: batch1.id,
          order_id: orderId,
          sequence_number: i + 1,
          address: `${100 + i} Main St, New York, NY 10001`,
          street_address: `${100 + i} Main St`,
          city: 'New York',
          state: 'NY',
          zip_code: i < 20 ? '10001' : '10002',
          status,
          address_visible_at: addressVisible ? new Date().toISOString() : null,
          latitude: 40.7128 + (Math.random() * 0.1),
          longitude: -74.0060 + (Math.random() * 0.1)
        });
      }
    }

    // Batch 2: 22 stops for driver2
    const { data: batch2 } = await supabase.from('delivery_batches').insert({
      lead_farmer_id: leadFarmerId,
      driver_id: createdUserIds['driver2@demo.com'],
      delivery_date: today,
      batch_number: 2,
      estimated_duration_minutes: 330,
      zip_codes: ['10003'],
      status: 'assigned'
    }).select().single();

    if (batch2 && orderIds.length > 37) {
      for (let i = 0; i < 22; i++) {
        const orderId = orderIds[37 + i];
        
        await supabase.from('batch_stops').insert({
          delivery_batch_id: batch2.id,
          order_id: orderId,
          sequence_number: i + 1,
          address: `${200 + i} Elm St, New York, NY 10003`,
          street_address: `${200 + i} Elm St`,
          city: 'New York',
          state: 'NY',
          zip_code: '10003',
          status: 'pending',
          address_visible_at: i < 3 ? new Date().toISOString() : null,
          latitude: 40.7310 + (Math.random() * 0.1),
          longitude: -73.9970 + (Math.random() * 0.1)
        });
      }
    }

    // Step 9: Create delivery ratings and tips
    console.log('Creating ratings...');
    const driver1Id = createdUserIds['driver1@demo.com'];
    const driver2Id = createdUserIds['driver2@demo.com'];
    
    const ratings = [
      { rating: 5, feedback: 'Excellent delivery! Very professional.' },
      { rating: 5, feedback: 'On time and friendly!' },
      { rating: 4, feedback: 'Good service overall.' },
      { rating: 5, feedback: 'Great experience!' },
      { rating: 5, feedback: 'Will order again!' },
      { rating: 4, feedback: 'Nice delivery.' },
    ];
    
    for (let i = 0; i < 25; i++) {
      if (i < orderIds.length) {
        const driverId = i % 2 === 0 ? driver1Id : driver2Id;
        const rating = ratings[i % ratings.length];
        
        await supabase.from('delivery_ratings').insert({
          order_id: orderIds[i],
          driver_id: driverId,
          rating: rating.rating,
          feedback: rating.feedback
        });
      }
    }

    // Step 10: Create credits and referrals
    console.log('Creating credits and referrals...');
    const consumer1Id = createdUserIds['consumer1@demo.com'];
    const consumer2Id = createdUserIds['consumer2@demo.com'];
    const consumer3Id = createdUserIds['consumer3@demo.com'];
    const consumer7Id = createdUserIds['consumer7@demo.com'];
    
    // Consumer 1: $45 in credits
    await supabase.from('credits_ledger').insert([
      {
        consumer_id: consumer1Id,
        amount: 25,
        balance_after: 25,
        transaction_type: 'referral_earned',
        description: 'Referral credit from consumer3@demo.com',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        consumer_id: consumer1Id,
        amount: 10,
        balance_after: 35,
        transaction_type: 'subscription_credit',
        description: 'Monthly subscription credit',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        consumer_id: consumer1Id,
        amount: 10,
        balance_after: 45,
        transaction_type: 'subscription_credit',
        description: 'Monthly subscription credit',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]);
    
    // Referral chain: Consumer 1 -> Consumer 3 -> Consumer 7
    await supabase.from('referrals').insert([
      {
        referrer_id: consumer1Id,
        referee_id: consumer3Id,
        credit_amount: 25,
        status: 'completed',
        credited_at: new Date().toISOString()
      },
      {
        referrer_id: consumer3Id,
        referee_id: consumer7Id,
        credit_amount: 25,
        status: 'completed',
        credited_at: new Date().toISOString()
      }
    ]);

    // Step 11: Create subscriptions
    console.log('Creating subscriptions...');
    await supabase.from('subscriptions').insert([
      {
        consumer_id: consumer1Id,
        status: 'active',
        current_period_start: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_spend: 120,
        credits_earned: 10
      },
      {
        consumer_id: createdUserIds['consumer4@demo.com'],
        status: 'active',
        current_period_start: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        current_period_end: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_spend: 85,
        credits_earned: 10
      },
      {
        consumer_id: consumer2Id,
        status: 'trialing',
        trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_spend: 0,
        credits_earned: 0
      }
    ]);

    // Step 12: Create pre-filled shopping cart
    console.log('Creating shopping carts...');
    const { data: cart } = await supabase.from('shopping_carts').insert({
      consumer_id: consumer1Id
    }).select().single();

    if (cart) {
      const cartProducts = productIds.slice(0, 5);
      for (const productId of cartProducts) {
        const { data: product } = await supabase.from('products').select('price').eq('id', productId).single();
        await supabase.from('cart_items').insert({
          cart_id: cart.id,
          product_id: productId,
          quantity: 2,
          unit_price: product!.price
        });
      }
    }

    // Step 13: Create saved carts
    await supabase.from('saved_carts').insert([
      {
        consumer_id: consumer2Id,
        name: 'Weekly Staples',
        items: JSON.stringify(productIds.slice(0, 3).map(id => ({ product_id: id, quantity: 2 })))
      },
      {
        consumer_id: consumer2Id,
        name: 'Summer BBQ',
        items: JSON.stringify(productIds.slice(3, 7).map(id => ({ product_id: id, quantity: 3 })))
      }
    ]);

    // Step 14: Create payouts
    console.log('Creating payouts...');
    for (let i = 0; i < 15; i++) {
      if (i < orderIds.length) {
        const orderId = orderIds[i];
        const farmerEmail = `farmer${(i % 6) + 1}@demo.com`;
        const farmerId = createdUserIds[farmerEmail];
        
        await supabase.from('payouts').insert({
          order_id: orderId,
          recipient_id: farmerId,
          recipient_type: 'farmer',
          amount: 50 + (i * 10),
          status: i < 10 ? 'completed' : 'pending',
          completed_at: i < 10 ? new Date().toISOString() : null
        });
      }
    }

    console.log('Demo data seeding completed successfully!');

    return new Response(JSON.stringify({
      success: true,
      message: 'Full demo data created successfully',
      summary: {
        users_created: users.length,
        products_created: productIds.length,
        orders_created: 38,
        batches_created: 2,
        ratings_created: 25,
        payouts_created: 15
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error seeding demo data:', error);
    return new Response(JSON.stringify({
      error: 'Failed to seed demo data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
