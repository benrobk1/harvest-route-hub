import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Geocoding helper using Mapbox
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
  if (!mapboxToken) {
    console.error('MAPBOX_PUBLIC_TOKEN not configured');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`
    );
    
    if (!response.ok) {
      console.error('Mapbox geocoding failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
    
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

// Calculate distance between two points using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Simple nearest-neighbor TSP algorithm for route optimization
function optimizeRoute(stops: any[]): any[] {
  if (stops.length <= 1) return stops;

  const optimized = [];
  const remaining = [...stops];
  
  // Start with first stop
  let current = remaining.shift()!;
  optimized.push(current);

  // Always pick nearest unvisited stop
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      if (current.latitude && current.longitude && 
          remaining[i].latitude && remaining[i].longitude) {
        const distance = calculateDistance(
          current.latitude,
          current.longitude,
          remaining[i].latitude,
          remaining[i].longitude
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }

  return optimized;
}

// Calculate estimated arrival times
function calculateEstimatedArrivals(stops: any[], startTime: Date): any[] {
  const avgSpeedKmh = 40; // Average driving speed
  const stopDurationMinutes = 10; // Time per delivery stop
  let currentTime = new Date(startTime);

  return stops.map((stop, index) => {
    if (index > 0 && stop.latitude && stop.longitude && 
        stops[index - 1].latitude && stops[index - 1].longitude) {
      const distance = calculateDistance(
        stops[index - 1].latitude,
        stops[index - 1].longitude,
        stop.latitude,
        stop.longitude
      );
      const travelMinutes = (distance / avgSpeedKmh) * 60;
      currentTime = new Date(currentTime.getTime() + (travelMinutes + stopDurationMinutes) * 60000);
    }
    
    return {
      ...stop,
      estimated_arrival: currentTime.toISOString()
    };
  });
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

    console.log('Starting batch generation...');

    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    console.log('Processing orders for delivery date:', tomorrowDate);

    // 1. Find all pending orders for tomorrow
    const { data: pendingOrders, error: ordersError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        consumer_id,
        total_amount,
        profiles (
          zip_code,
          delivery_address,
          full_name
        )
      `)
      .eq('delivery_date', tomorrowDate)
      .eq('status', 'pending')
      .is('delivery_batch_id', null);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log('No pending orders found for tomorrow');
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending orders to process',
        batches_created: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingOrders.length} pending orders`);

    // 2. Geocode addresses and group orders by ZIP code
    const ordersByZip: { [key: string]: any[] } = {};
    
    console.log('Geocoding addresses...');
    const geocodedOrders = await Promise.all(
      pendingOrders.map(async (order) => {
        const profile = order.profiles as any;
        const address = profile?.delivery_address;
        const coords = address ? await geocodeAddress(address) : null;
        
        return {
          ...order,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null
        };
      })
    );

    for (const order of geocodedOrders) {
      const profile = order.profiles as any;
      const zipCode = profile?.zip_code || 'unknown';
      
      if (!ordersByZip[zipCode]) {
        ordersByZip[zipCode] = [];
      }
      ordersByZip[zipCode].push(order);
    }

    console.log(`Orders grouped into ${Object.keys(ordersByZip).length} ZIP code zones`);

    const batchesCreated = [];
    const errors = [];

    // 3. Create delivery batch for each ZIP zone
    for (const [zipCode, orders] of Object.entries(ordersByZip)) {
      try {
        console.log(`Creating batch for ZIP ${zipCode} with ${orders.length} orders`);

        // Get next batch number for this date
        const { data: existingBatches } = await supabaseClient
          .from('delivery_batches')
          .select('batch_number')
          .eq('delivery_date', tomorrowDate)
          .order('batch_number', { ascending: false })
          .limit(1);

        const nextBatchNumber = existingBatches && existingBatches.length > 0 
          ? existingBatches[0].batch_number + 1 
          : 1;

        // Create delivery batch
        const { data: batch, error: batchError } = await supabaseClient
          .from('delivery_batches')
          .insert({
            delivery_date: tomorrowDate,
            batch_number: nextBatchNumber,
            zip_codes: [zipCode],
            status: 'pending',
            lead_farmer_id: null // Will be assigned later by admin
          })
          .select()
          .single();

        if (batchError || !batch) {
          console.error('Batch creation error:', batchError);
          errors.push({ zipCode, error: batchError?.message });
          continue;
        }

        console.log(`Batch ${batch.id} created with number ${nextBatchNumber}`);

        // 4. Prepare stops with geocoded data
        const profile = orders[0].profiles as any;
        const unoptimizedStops = orders.map((order) => {
          const orderProfile = order.profiles as any;
          return {
            delivery_batch_id: batch.id,
            order_id: order.id,
            address: orderProfile?.delivery_address || 'Address not provided',
            latitude: order.latitude,
            longitude: order.longitude,
            status: 'pending'
          };
        });

        // 5. Optimize route using nearest-neighbor TSP
        console.log('Optimizing route...');
        const optimizedStops = optimizeRoute(unoptimizedStops);

        // 6. Calculate estimated arrival times (start at 9 AM on delivery date)
        const startTime = new Date(tomorrowDate);
        startTime.setHours(9, 0, 0, 0);
        const stopsWithTimes = calculateEstimatedArrivals(optimizedStops, startTime);

        // 7. Add sequence numbers
        const batchStops = stopsWithTimes.map((stop, index) => ({
          ...stop,
          sequence_number: index + 1
        }));

        // 8. Insert batch stops
        const { data: createdStops, error: stopsError } = await supabaseClient
          .from('batch_stops')
          .insert(batchStops)
          .select();

        if (stopsError) {
          console.error('Batch stop creation error:', stopsError);
          errors.push({ batch_id: batch.id, error: stopsError.message });
          continue;
        }

        console.log(`Created ${batchStops.length} optimized stops`);

        // 9. Generate route_data JSON
        const totalDistance = batchStops.reduce((total, stop, index) => {
          if (index === 0) return 0;
          if (stop.latitude && stop.longitude && 
              batchStops[index - 1].latitude && batchStops[index - 1].longitude) {
            return total + calculateDistance(
              batchStops[index - 1].latitude,
              batchStops[index - 1].longitude,
              stop.latitude,
              stop.longitude
            );
          }
          return total;
        }, 0);

        const routeData = {
          total_distance_km: Math.round(totalDistance * 100) / 100,
          stops: batchStops.map(stop => ({
            sequence: stop.sequence_number,
            address: stop.address,
            latitude: stop.latitude,
            longitude: stop.longitude,
            estimated_arrival: stop.estimated_arrival
          })),
          optimization_method: 'nearest_neighbor_tsp',
          generated_at: new Date().toISOString()
        };

        // 10. Create route entry
        const { error: routeError } = await supabaseClient
          .from('routes')
          .insert({
            delivery_batch_id: batch.id,
            driver_id: null, // Will be assigned later
            route_data: routeData,
            status: 'assigned'
          });

        if (routeError) {
          console.error('Route creation error:', routeError);
          errors.push({ batch_id: batch.id, error: routeError.message });
        }

        // 11. Update batch with estimated duration
        const estimatedDuration = Math.ceil(
          (totalDistance / 40) * 60 + // Travel time at 40 km/h
          (batchStops.length * 10) // 10 minutes per stop
        );

        await supabaseClient
          .from('delivery_batches')
          .update({ estimated_duration_minutes: estimatedDuration })
          .eq('id', batch.id);

        console.log(`Route optimized: ${totalDistance.toFixed(1)} km, ${estimatedDuration} minutes`);

        // 12. Update orders to confirmed status and link to batch
        const orderIds = orders.map(o => o.id);
        const { error: updateError } = await supabaseClient
          .from('orders')
          .update({
            status: 'confirmed',
            delivery_batch_id: batch.id
          })
          .in('id', orderIds);

        if (updateError) {
          console.error('Order update error:', updateError);
          errors.push({ batch_id: batch.id, error: updateError.message });
        }

        batchesCreated.push({
          batch_id: batch.id,
          batch_number: nextBatchNumber,
          zip_code: zipCode,
          order_count: orders.length,
          total_distance_km: Math.round(totalDistance * 100) / 100,
          estimated_duration_minutes: estimatedDuration
        });

        // 13. Send notifications for locked orders
        for (const order of orders) {
          try {
            await supabaseClient.functions.invoke('send-notification', {
              body: {
                event_type: 'order_locked',
                recipient_id: order.consumer_id,
                data: {
                  order_id: order.id,
                  batch_id: batch.id,
                  delivery_date: tomorrowDate
                }
              }
            });
          } catch (notifError) {
            console.error('Notification error (non-blocking):', notifError);
          }
        }

        console.log(`Batch ${batch.id} completed with ${orders.length} stops`);

      } catch (error: any) {
        console.error(`Error processing ZIP ${zipCode}:`, error);
        errors.push({ zipCode, error: error.message });
      }
    }

    const response = {
      success: true,
      delivery_date: tomorrowDate,
      batches_created: batchesCreated.length,
      total_orders_processed: pendingOrders.length,
      batches: batchesCreated,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Batch generation complete:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Batch generation error:', error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});