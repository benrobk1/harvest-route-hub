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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with anon key for auth verification
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the user with anon client
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

    // Check if user is admin using service role client
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(JSON.stringify({ error: 'Failed to verify admin permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      { 
        email: 'leadfarmer@demo.com', 
        password: DEMO_PASSWORD, 
        full_name: 'Sarah Johnson', 
        roles: ['lead_farmer'], 
        profile: { 
          farm_name: 'Valley Collection Point', 
          collection_point_address: '123 Farm Road, Hudson Valley, NY 10001',
          street_address: '123 Farm Road',
          city: 'Hudson Valley',
          state: 'NY',
          zip_code: '10001'
        } 
      },
      { 
        email: 'farmer1@demo.com', 
        password: DEMO_PASSWORD, 
        full_name: 'Mike Thompson', 
        roles: ['farmer'], 
        profile: { 
          farm_name: 'Thompson Family Farm', 
          location: 'Hudson Valley, NY', 
          description: 'Organic vegetables and fruits',
          bio: 'We traded our city shoes for muddy boots and haven\'t stopped smiling since. Every tomato with a funny nose becomes a mascot before it becomes dinner.'
        } 
      },
      { email: 'farmer2@demo.com', password: DEMO_PASSWORD, full_name: 'Lisa Chen', roles: ['farmer'], profile: { farm_name: 'Chen Organic Gardens', location: 'Catskills, NY', description: 'Asian vegetables and herbs' } },
      { email: 'farmer3@demo.com', password: DEMO_PASSWORD, full_name: 'Carlos Rodriguez', roles: ['farmer'], profile: { farm_name: 'Rodriguez Dairy', location: 'Finger Lakes, NY', description: 'Fresh dairy and cheese' } },
      { email: 'farmer4@demo.com', password: DEMO_PASSWORD, full_name: 'Emily White', roles: ['farmer'], profile: { farm_name: 'White Acres', location: 'Adirondacks, NY', description: 'Free-range eggs and poultry' } },
      { email: 'farmer5@demo.com', password: DEMO_PASSWORD, full_name: 'David Brown', roles: ['farmer'], profile: { farm_name: 'Brown Bee Farm', location: 'Finger Lakes, NY', description: 'Honey and beeswax products' } },
      { email: 'farmer6@demo.com', password: DEMO_PASSWORD, full_name: 'Anna Martinez', roles: ['farmer'], profile: { farm_name: 'Martinez Bakery', location: 'Hudson Valley, NY', description: 'Artisan breads and pastries' } },
      { email: 'driver1@demo.com', password: DEMO_PASSWORD, full_name: 'John Driver', roles: ['driver'], profile: { vehicle_type: 'Refrigerated Van', vehicle_make: 'Ford Transit' } },
      { email: 'driver2@demo.com', password: DEMO_PASSWORD, full_name: 'Maria Santos', roles: ['driver'], profile: { vehicle_type: 'Pickup Truck', vehicle_make: 'Toyota Tacoma' } },
      { email: 'driver3@demo.com', password: DEMO_PASSWORD, full_name: 'James Wilson', roles: ['driver'], profile: { vehicle_type: 'Cargo Van', vehicle_make: 'Mercedes Sprinter' } },
    ];

    // Add 96 consumers (48 active + 48 churned for 50% churn rate)
    const addresses = [
      { street: '101 Main St', city: 'Brooklyn', zip: '11201' },
      { street: '102 Oak Ave', city: 'Brooklyn', zip: '11201' },
      { street: '103 Elm St', city: 'Brooklyn', zip: '11201' },
      { street: '104 Pine Rd', city: 'Brooklyn', zip: '11201' },
      { street: '105 Maple Dr', city: 'Brooklyn', zip: '11201' },
      { street: '201 Park Ave', city: 'Brooklyn', zip: '11205' },
      { street: '202 Court St', city: 'Brooklyn', zip: '11205' },
      { street: '203 Smith St', city: 'Brooklyn', zip: '11205' },
      { street: '204 Jay St', city: 'Brooklyn', zip: '11205' },
      { street: '205 Hoyt St', city: 'Brooklyn', zip: '11205' },
      { street: '301 Bedford Ave', city: 'Brooklyn', zip: '11206' },
      { street: '302 Grand St', city: 'Brooklyn', zip: '11206' },
      { street: '303 Kent Ave', city: 'Brooklyn', zip: '11206' },
      { street: '304 Wythe Ave', city: 'Brooklyn', zip: '11206' },
      { street: '305 Berry St', city: 'Brooklyn', zip: '11206' },
    ];

    for (let i = 1; i <= 96; i++) {
      const addr = addresses[i % 15];
      users.push({
        email: `consumer${i}@demo.com`,
        password: DEMO_PASSWORD,
        full_name: `Consumer ${i}`,
        roles: ['consumer'],
        profile: {
          street_address: addr.street,
          city: addr.city,
          state: 'NY',
          zip_code: addr.zip,
          phone: `555-010${i.toString().padStart(2, '0')}`,
          delivery_address: `${addr.street}, ${addr.city}, NY ${addr.zip}`,
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
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
        description: user.profile?.description,
        bio: user.profile?.bio || null
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

    // Step 5: Create market configs for all demo ZIP codes
    console.log('Creating market configs...');
    const marketConfigs = [
      { zip_code: '11201', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '11205', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '11206', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '11211', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '11222', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '10001', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
      { zip_code: '10003', delivery_fee: 5.99, minimum_order: 25, delivery_days: ['Wednesday', 'Saturday'] },
    ];

    for (const config of marketConfigs) {
      await supabase.from('market_configs').insert({
        ...config,
        collection_point_id: leadFarmerId,
        cutoff_time: '12:00:00',
        active: true
      });
    }

    // Step 6: Create 1,025 orders total ($41,000 in sales, $40 AOV)
    // 48 households last 30 days, 50% churn, 93% on-time, 37.2 orders/route
    console.log('Creating orders...');
    const orderIds: string[] = [];
    const now = new Date();
    
    // Last 30 days: 48 active consumers, ~512 orders
    for (let i = 0; i < 512; i++) {
      const consumerNum = (i % 48) + 1;
      const consumerId = createdUserIds[`consumer${consumerNum}@demo.com`];
      const daysAgo = Math.floor(Math.random() * 30);
      const deliveryDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      const numItems = Math.floor(Math.random() * 3) + 2;
      const selectedProducts = productIds.sort(() => 0.5 - Math.random()).slice(0, numItems);
      
      let totalAmount = 0;
      const orderItems: any[] = [];
      
      for (const productId of selectedProducts) {
        const { data: product } = await supabase.from('products').select('price').eq('id', productId).single();
        const quantity = Math.floor(Math.random() * 2) + 1;
        const subtotal = product!.price * quantity;
        totalAmount += subtotal;
        
        orderItems.push({
          product_id: productId,
          quantity,
          unit_price: product!.price,
          subtotal
        });
      }
      
      // Target $40 AOV
      totalAmount = 38 + Math.random() * 4; // $38-42
      
      const { data: order } = await supabase.from('orders').insert({
        consumer_id: consumerId,
        delivery_date: deliveryDate.toISOString().split('T')[0],
        total_amount: totalAmount,
        status: 'delivered',
        created_at: deliveryDate.toISOString()
      }).select().single();
      
      if (order) {
        orderIds.push(order.id);
        
        for (const item of orderItems) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            ...item
          });
        }
      }
    }

    // Orders from 31-60 days ago: 48 churned consumers (ordered last month but not this month)
    for (let i = 0; i < 96; i++) {
      const consumerNum = 48 + (i % 48) + 1; // consumers 49-96
      const consumerId = createdUserIds[`consumer${consumerNum}@demo.com`];
      const daysAgo = 31 + Math.floor(Math.random() * 30); // 31-60 days ago
      const deliveryDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      const numItems = Math.floor(Math.random() * 3) + 2;
      const selectedProducts = productIds.sort(() => 0.5 - Math.random()).slice(0, numItems);
      
      let totalAmount = 0;
      const orderItems: any[] = [];
      
      for (const productId of selectedProducts) {
        const { data: product } = await supabase.from('products').select('price').eq('id', productId).single();
        const quantity = Math.floor(Math.random() * 2) + 1;
        const subtotal = product!.price * quantity;
        totalAmount += subtotal;
        
        orderItems.push({
          product_id: productId,
          quantity,
          unit_price: product!.price,
          subtotal
        });
      }
      
      totalAmount = 38 + Math.random() * 4;
      
      const { data: order } = await supabase.from('orders').insert({
        consumer_id: consumerId,
        delivery_date: deliveryDate.toISOString().split('T')[0],
        total_amount: totalAmount,
        status: 'delivered',
        created_at: deliveryDate.toISOString()
      }).select().single();
      
      if (order) {
        orderIds.push(order.id);
        
        for (const item of orderItems) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            ...item
          });
        }
      }
    }

    // Historical orders 61-90 days ago to reach 1,025 total
    const historicalOrderCount = 1025 - 512 - 96; // = 417
    for (let i = 0; i < historicalOrderCount; i++) {
      const consumerNum = (i % 96) + 1;
      const consumerId = createdUserIds[`consumer${consumerNum}@demo.com`];
      const daysAgo = 61 + Math.floor(Math.random() * 30);
      const deliveryDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      const numItems = Math.floor(Math.random() * 3) + 2;
      const selectedProducts = productIds.sort(() => 0.5 - Math.random()).slice(0, numItems);
      
      let totalAmount = 0;
      const orderItems: any[] = [];
      
      for (const productId of selectedProducts) {
        const { data: product } = await supabase.from('products').select('price').eq('id', productId).single();
        const quantity = Math.floor(Math.random() * 2) + 1;
        const subtotal = product!.price * quantity;
        totalAmount += subtotal;
        
        orderItems.push({
          product_id: productId,
          quantity,
          unit_price: product!.price,
          subtotal
        });
      }
      
      totalAmount = 38 + Math.random() * 4;
      
      const { data: order } = await supabase.from('orders').insert({
        consumer_id: consumerId,
        delivery_date: deliveryDate.toISOString().split('T')[0],
        total_amount: totalAmount,
        status: 'delivered',
        created_at: deliveryDate.toISOString()
      }).select().single();
      
      if (order) {
        orderIds.push(order.id);
        
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

    // Step 8: Create 5 delivery batches (4 completed + 1 available with 36 stops)
    console.log('Creating delivery batches...');
    const today = new Date().toISOString().split('T')[0];
    const batchStopCounts = [37, 38, 37, 37]; // avg = 37.25 ≈ 37.2 for completed batches
    let orderIdx = 0;

    // Create 4 completed batches for driver1
    for (let batchNum = 0; batchNum < 4; batchNum++) {
      const stopCount = batchStopCounts[batchNum];
      const batchDate = new Date(now.getTime() - batchNum * 24 * 60 * 60 * 1000);
      
      const { data: batch } = await supabase.from('delivery_batches').insert({
        lead_farmer_id: leadFarmerId,
        driver_id: createdUserIds['driver1@demo.com'],
        delivery_date: batchDate.toISOString().split('T')[0],
        batch_number: batchNum + 1,
        estimated_duration_minutes: stopCount * 10,
        zip_codes: ['11201', '11205', '11206', '11211', '11222'],
        status: batchNum === 0 ? 'in_progress' : 'completed'
      }).select().single();

      if (batch && orderIdx < orderIds.length) {
        for (let i = 0; i < stopCount; i++) {
          if (orderIdx >= orderIds.length) break;
          const orderId = orderIds[orderIdx++];
          const addr = addresses[i % 15];
          const estimatedArrival = new Date(batchDate.getTime() + i * 10 * 60 * 1000);

          // For 93% on-time: 7% arrive late
          const isLate = Math.random() < 0.07;
          let status: string;
          let actualArrival: Date | null = null;

          if (batchNum === 0) {
            // Current batch: first ~15 delivered, one in progress, rest pending
            status = i < 15 ? 'delivered' : (i < 16 ? 'in_progress' : 'pending');
            if (status === 'delivered') {
              actualArrival = isLate
                ? new Date(estimatedArrival.getTime() + Math.random() * 15 * 60 * 1000)
                : new Date(estimatedArrival.getTime() - Math.random() * 5 * 60 * 1000);
            }
          } else {
            // Past batches: all delivered
            status = 'delivered';
            actualArrival = isLate
              ? new Date(estimatedArrival.getTime() + Math.random() * 15 * 60 * 1000)
              : new Date(estimatedArrival.getTime() - Math.random() * 5 * 60 * 1000);
          }

          await supabase.from('batch_stops').insert({
            delivery_batch_id: batch.id,
            order_id: orderId,
            sequence_number: i + 1,
            address: `${addr.street}, ${addr.city}, NY ${addr.zip}`,
            street_address: addr.street,
            city: addr.city,
            state: 'NY',
            zip_code: addr.zip,
            status,
            address_visible_at: batchNum === 0 && i < 18 ? new Date().toISOString() : null,
            estimated_arrival: estimatedArrival.toISOString(),
            actual_arrival: actualArrival?.toISOString() || null,
            latitude: 40.6782 + (Math.random() * 0.05),
            longitude: -73.9442 + (Math.random() * 0.05)
          });

          await supabase.from('orders').update({
            delivery_batch_id: batch.id
          }).eq('id', orderId);
        }
      }
    }

    // Create an available batch (unclaimed) for tomorrow with 36 stops
    console.log('Creating available batch for demo...');
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];
    
    const { data: availableBatch } = await supabase.from('delivery_batches').insert({
      lead_farmer_id: leadFarmerId,
      driver_id: null, // No driver assigned - available to claim
      delivery_date: dayAfterTomorrowStr,
      batch_number: 5,
      estimated_duration_minutes: 36 * 10, // 360 minutes = 6 hours
      zip_codes: ['11201', '11205', '11206'],
      status: 'pending'
    }).select().single();

    // Create 36 pending stops for the available batch
    if (availableBatch) {
      for (let i = 0; i < 36; i++) {
        const consumerNum = (i % 48) + 1;
        const consumerId = createdUserIds[`consumer${consumerNum}@demo.com`];
        const addr = addresses[i % 15];
        
        // Create order for this stop
        const numItems = Math.floor(Math.random() * 3) + 2;
        const selectedProducts = productIds.sort(() => 0.5 - Math.random()).slice(0, numItems);
        
        let totalAmount = 38 + Math.random() * 4;
        const orderItems: any[] = [];
        
        for (const productId of selectedProducts) {
          const { data: product } = await supabase.from('products').select('price').eq('id', productId).single();
          const quantity = Math.floor(Math.random() * 2) + 1;
          const subtotal = product!.price * quantity;
          
          orderItems.push({
            product_id: productId,
            quantity,
            unit_price: product!.price,
            subtotal
          });
        }
        
        const { data: order } = await supabase.from('orders').insert({
          consumer_id: consumerId,
          delivery_date: dayAfterTomorrowStr,
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
          
          // Create batch stop
          const estimatedArrival = new Date(dayAfterTomorrow.getTime() + i * 10 * 60 * 1000);
          
          await supabase.from('batch_stops').insert({
            delivery_batch_id: availableBatch.id,
            order_id: order.id,
            sequence_number: i + 1,
            address: `${addr.street}, ${addr.city}, NY ${addr.zip}`,
            street_address: addr.street,
            city: addr.city,
            state: 'NY',
            zip_code: addr.zip,
            status: 'pending',
            address_visible_at: null,
            estimated_arrival: estimatedArrival.toISOString(),
            actual_arrival: null,
            latitude: 40.6782 + (Math.random() * 0.05),
            longitude: -73.9442 + (Math.random() * 0.05)
          });
          
          await supabase.from('orders').update({
            delivery_batch_id: availableBatch.id
          }).eq('id', order.id);
        }
      }
    }

    // Step 9: Create delivery ratings
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
      { rating: 5, feedback: 'Always on time!' },
      { rating: 5, feedback: 'Best delivery service!' },
    ];
    
    for (let i = 0; i < Math.min(30, orderIds.length); i++) {
      const driverId = i % 2 === 0 ? driver1Id : driver2Id;
      const rating = ratings[i % ratings.length];
      
      await supabase.from('delivery_ratings').insert({
        order_id: orderIds[i],
        driver_id: driverId,
        rating: rating.rating,
        feedback: rating.feedback
      });
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

    // Step 14: Create payouts and mark 2 batches as completed this month for demo driver
    console.log('Creating payouts and marking batches completed...');
    
    // Mark the 2 most recent batches (batch 0 and 1) as completed within the last 30 days
    const thisMonthStart = new Date();
    thisMonthStart.setDate(thisMonthStart.getDate() - 25); // 25 days ago
    const batch1CompletedDate = new Date(thisMonthStart.getTime() + 5 * 24 * 60 * 60 * 1000); // 20 days ago
    const batch2CompletedDate = new Date(thisMonthStart.getTime() + 12 * 24 * 60 * 60 * 1000); // 13 days ago
    
    // Get the first 2 batches for driver1
    const { data: driver1Batches } = await supabase
      .from('delivery_batches')
      .select('id')
      .eq('driver_id', driver1Id)
      .order('created_at', { ascending: true })
      .limit(2);
    
    if (driver1Batches && driver1Batches.length >= 2) {
      // Update batch 1 (first completed batch this month)
      await supabase.from('delivery_batches')
        .update({ 
          status: 'completed',
          created_at: batch1CompletedDate.toISOString()
        })
        .eq('id', driver1Batches[0].id);
      
      // Update batch 2 (second completed batch this month)
      await supabase.from('delivery_batches')
        .update({ 
          status: 'completed',
          created_at: batch2CompletedDate.toISOString()
        })
        .eq('id', driver1Batches[1].id);
      
      // Get all stops from these 2 batches
      const { data: batch1Stops } = await supabase
        .from('batch_stops')
        .select('order_id')
        .eq('delivery_batch_id', driver1Batches[0].id);
      
      const { data: batch2Stops } = await supabase
        .from('batch_stops')
        .select('order_id')
        .eq('delivery_batch_id', driver1Batches[1].id);
      
      // Calculate total tips from these batches
      let batch1Tips = 0;
      let batch2Tips = 0;
      
      if (batch1Stops) {
        for (const stop of batch1Stops) {
          const tipAmount = Math.random() < 0.5 ? (2 + Math.random() * 3) : 0; // Random tips
          batch1Tips += tipAmount;
          await supabase.from('orders').update({ 
            tip_amount: tipAmount,
            created_at: batch1CompletedDate.toISOString()
          }).eq('id', stop.order_id);
        }
      }
      
      if (batch2Stops) {
        for (const stop of batch2Stops) {
          const tipAmount = Math.random() < 0.5 ? (2 + Math.random() * 3) : 0; // Random tips
          batch2Tips += tipAmount;
          await supabase.from('orders').update({ 
            tip_amount: tipAmount,
            created_at: batch2CompletedDate.toISOString()
          }).eq('id', stop.order_id);
        }
      }
      
      // Ensure total tips equal $15 (adjust second batch tips)
      const totalTips = batch1Tips + batch2Tips;
      const tipAdjustment = 15 - totalTips;
      if (batch2Stops && batch2Stops.length > 0) {
        const firstOrderId = batch2Stops[0].order_id;
        const { data: firstOrder } = await supabase
          .from('orders')
          .select('tip_amount')
          .eq('id', firstOrderId)
          .single();
        
        if (firstOrder) {
          await supabase.from('orders').update({ 
            tip_amount: Number(firstOrder.tip_amount) + tipAdjustment
          }).eq('id', firstOrderId);
        }
      }
      
      // Batch 1: $288 delivery fees (37 stops × $7.50 + $10.50 for batch)
      await supabase.from('payouts').insert({
        order_id: batch1Stops?.[0]?.order_id || orderIds[0],
        recipient_id: driver1Id,
        recipient_type: 'driver',
        amount: 288,
        description: 'Delivery fees for batch',
        status: 'completed',
        completed_at: batch1CompletedDate.toISOString(),
        created_at: batch1CompletedDate.toISOString()
      });
      
      // Batch 2: $288 delivery fees (38 stops × $7.50 + $3)
      await supabase.from('payouts').insert({
        order_id: batch2Stops?.[0]?.order_id || orderIds[1],
        recipient_id: driver1Id,
        recipient_type: 'driver',
        amount: 288,
        description: 'Delivery fees for batch',
        status: 'completed',
        completed_at: batch2CompletedDate.toISOString(),
        created_at: batch2CompletedDate.toISOString()
      });
    }
    
    // Create payouts for farmers from all orders
    for (const orderId of orderIds) {
      const { data: order } = await supabase.from('orders').select('total_amount, created_at').eq('id', orderId).single();
      if (!order) continue;

      const farmerEmail = `farmer${Math.floor(Math.random() * 6) + 1}@demo.com`;
      const farmerId = createdUserIds[farmerEmail];
      
      await supabase.from('payouts').insert({
        order_id: orderId,
        recipient_id: farmerId,
        recipient_type: 'farmer',
        amount: 40,
        status: 'completed',
        completed_at: order.created_at,
        created_at: order.created_at
      });
    }

    console.log('Demo data seeding completed successfully!');

    return new Response(JSON.stringify({
      success: true,
      message: 'Full demo data created successfully',
      summary: {
        users_created: users.length,
        products_created: productIds.length,
        orders_created: 1025 + 36, // Including available batch orders
        batches_created: 5, // 4 completed + 1 available
        ratings_created: 30,
        farm_revenue: 41000,
        households_active: 48,
        churn_rate: 50,
        on_time_percent: 93,
        orders_per_route: 37.2
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
