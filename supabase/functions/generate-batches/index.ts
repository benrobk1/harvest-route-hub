import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { RATE_LIMITS } from '../_shared/constants.ts';
import { BatchGenerationService } from '../_shared/services/BatchGenerationService.ts';
import {
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withRateLimit,
  withErrorHandling,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type SupabaseServiceRoleContext,
  type AuthContext,
} from '../_shared/middleware/index.ts';

/**
 * GENERATE BATCHES EDGE FUNCTION
 * 
 * Creates optimized delivery batches for pending orders.
 * Uses OSRM for routing and 2-opt optimization.
 * Requires admin authentication.
 * 
 * Full Middleware Pattern:
 * RequestId + CORS + Auth + AdminAuth + RateLimit + ErrorHandling
 */

type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  SupabaseServiceRoleContext;

const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, supabase, config } = ctx;

  console.log(`[${requestId}] Starting batch generation...`);

    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    console.log(`[${requestId}] Processing orders for delivery date: ${tomorrowDate}`);

    // Find all pending orders for tomorrow
    const { data: pendingOrders, error: ordersError } = await supabase
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
      console.error(`[${requestId}] Error fetching orders:`, ordersError);
      throw ordersError;
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log(`[${requestId}] No pending orders found`);
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending orders to process',
        batches_created: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Found ${pendingOrders.length} pending orders`);

    // Initialize batch generation service
    const batchService = new BatchGenerationService(
      supabase,
      config.mapbox?.publicToken,
      Deno.env.get('OSRM_SERVER_URL') || 'https://router.project-osrm.org'
    );

    // Geocode addresses and group by ZIP
    console.log(`[${requestId}] Geocoding addresses...`);
    const geocodedOrders = await Promise.all(
      pendingOrders.map(async (order) => {
        const profile = order.profiles as any;
        const address = profile?.delivery_address;
        const zipCode = profile?.zip_code;
        const coords = address ? await batchService.geocodeAddress(address, zipCode) : null;
        
        return {
          ...order,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null
        };
      })
    );

    // Group by ZIP code
    const ordersByZip: { [key: string]: any[] } = {};
    for (const order of geocodedOrders) {
      const profile = order.profiles as any;
      const zipCode = profile?.zip_code || 'unknown';
      
      if (!ordersByZip[zipCode]) {
        ordersByZip[zipCode] = [];
      }
      ordersByZip[zipCode].push(order);
    }

    console.log(`[${requestId}] Orders grouped into ${Object.keys(ordersByZip).length} ZIP zones`);

    const batchesCreated = [];
    const errors = [];

    // Create delivery batch for each ZIP zone
    for (const [zipCode, orders] of Object.entries(ordersByZip)) {
      try {
        console.log(`[${requestId}] Creating batch for ZIP ${zipCode} with ${orders.length} orders`);

        // Get next batch number
        const { data: existingBatches } = await supabase
          .from('delivery_batches')
          .select('batch_number')
          .eq('delivery_date', tomorrowDate)
          .order('batch_number', { ascending: false })
          .limit(1);

        const nextBatchNumber = existingBatches && existingBatches.length > 0 
          ? existingBatches[0].batch_number + 1 
          : 1;

        // Create delivery batch
        const { data: batch, error: batchError } = await supabase
          .from('delivery_batches')
          .insert({
            delivery_date: tomorrowDate,
            batch_number: nextBatchNumber,
            zip_codes: [zipCode],
            status: 'pending',
            lead_farmer_id: null
          })
          .select()
          .single();

        if (batchError || !batch) {
          console.error(`[${requestId}] Batch creation error:`, batchError);
          errors.push({ zipCode, error: batchError?.message });
          continue;
        }

        console.log(`[${requestId}] Batch ${batch.id} created with number ${nextBatchNumber}`);

        // Prepare stops
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

        // Optimize route using service
        console.log(`[${requestId}] Optimizing route with OSRM...`);
        const { optimizedStops, method } = await batchService.optimizeRouteWithOsrm(unoptimizedStops);
        console.log(`[${requestId}] Route optimization method: ${method}`);

        // Calculate arrival times
        const startTime = new Date(tomorrowDate);
        startTime.setHours(9, 0, 0, 0);
        const stopsWithTimes = await batchService.calculateEstimatedArrivalsWithOsrm(optimizedStops, startTime);

        // Add sequence numbers
        const batchStops = stopsWithTimes.map((stop, index) => ({
          ...stop,
          sequence_number: index + 1
        }));

        // Insert batch stops
        const { data: createdStops, error: stopsError } = await supabase
          .from('batch_stops')
          .insert(batchStops)
          .select();

        if (stopsError) {
          console.error(`[${requestId}] Batch stop creation error:`, stopsError);
          errors.push({ batch_id: batch.id, error: stopsError.message });
          continue;
        }

        console.log(`[${requestId}] Created ${batchStops.length} optimized stops`);

        // Generate box codes
        for (let i = 0; i < createdStops.length; i++) {
          const stop = createdStops[i];
          const boxCode = `B${nextBatchNumber}-${stop.sequence_number}`;
          
          await supabase
            .from('orders')
            .update({ box_code: boxCode })
            .eq('id', stop.order_id);
        }

        // Get detailed route
        const coordinates: [number, number][] = batchStops
          .filter(s => s.latitude && s.longitude)
          .map(s => [s.longitude!, s.latitude!]);
        
        const osrmRoute = await batchService.getOsrmRoute(coordinates);

        // Calculate total distance and duration
        let totalDistance = 0;
        let totalDuration = 0;

        if (osrmRoute) {
          totalDistance = osrmRoute.distance;
          totalDuration = osrmRoute.duration;
          console.log(`[${requestId}] Using OSRM actual route distance and duration`);
        } else {
          console.warn(`[${requestId}] OSRM route unavailable, using Haversine fallback`);
          totalDistance = batchStops.reduce((total, stop, index) => {
            if (index === 0) return 0;
            if (stop.latitude && stop.longitude && 
                batchStops[index - 1].latitude && batchStops[index - 1].longitude) {
              const dLat = (stop.latitude - batchStops[index - 1].latitude!) * Math.PI / 180;
              const dLon = (stop.longitude! - batchStops[index - 1].longitude!) * Math.PI / 180;
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(batchStops[index - 1].latitude! * Math.PI / 180) *
                Math.cos(stop.latitude * Math.PI / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              return total + (6371 * c);
            }
            return total;
          }, 0);
          totalDuration = (totalDistance / 40) * 60;
        }

        const estimatedDuration = Math.ceil(totalDuration + (batchStops.length * 10));

        // Generate route data
        const routeData: any = {
          total_distance_km: Math.round(totalDistance * 100) / 100,
          total_duration_minutes: estimatedDuration,
          stops: batchStops.map(stop => ({
            sequence: stop.sequence_number,
            address: stop.address,
            latitude: stop.latitude,
            longitude: stop.longitude,
            estimated_arrival: stop.estimated_arrival
          })),
          optimization_method: method,
          generated_at: new Date().toISOString(),
          osrm_server: Deno.env.get('OSRM_SERVER_URL') || 'https://router.project-osrm.org'
        };

        if (osrmRoute) {
          routeData.route_geometry = osrmRoute.geometry;
          routeData.legs = osrmRoute.legs.map((leg: any, index: number) => ({
            from_stop: index + 1,
            to_stop: index + 2,
            distance_km: Math.round(leg.distance * 100) / 100,
            duration_minutes: Math.round(leg.duration * 10) / 10,
            instructions: leg.steps.map((step: any) => ({
              maneuver: step.maneuver,
              instruction: step.instruction,
              distance_km: Math.round(step.distance * 100) / 100,
              duration_minutes: Math.round(step.duration * 10) / 10
            }))
          }));
        }

        // Create route entry
        await supabase
          .from('routes')
          .insert({
            delivery_batch_id: batch.id,
            driver_id: null,
            route_data: routeData,
            status: 'assigned'
          });

        // Update batch with duration
        await supabase
          .from('delivery_batches')
          .update({ estimated_duration_minutes: estimatedDuration })
          .eq('id', batch.id);

        console.log(`[${requestId}] Route optimized: ${totalDistance.toFixed(1)} km, ${estimatedDuration} min`);

        // Update orders to confirmed
        const orderIds = orders.map(o => o.id);
        await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            delivery_batch_id: batch.id
          })
          .in('id', orderIds);

        // Calculate lead farmer commission if assigned
        if (batch.lead_farmer_id) {
          const { data: leadFarmerProfile } = await supabase
            .from('profiles')
            .select('commission_rate')
            .eq('id', batch.lead_farmer_id)
            .single();

          const commissionRate = leadFarmerProfile?.commission_rate || 5.0;

          const { data: batchOrderItems } = await supabase
            .from('order_items')
            .select(`
              subtotal,
              products!inner(
                farm_profiles!inner(farmer_id)
              )
            `)
            .in('order_id', orderIds);

          let commissionableAmount = 0;
          batchOrderItems?.forEach((item: any) => {
            const farmerId = item.products?.farm_profiles?.farmer_id;
            if (farmerId && farmerId !== batch.lead_farmer_id) {
              commissionableAmount += Number(item.subtotal);
            }
          });

          const commissionAmount = commissionableAmount * (commissionRate / 100);

          if (commissionAmount > 0) {
            await supabase
              .from('payouts')
              .insert({
                recipient_id: batch.lead_farmer_id,
                recipient_type: 'lead_farmer_commission',
                amount: commissionAmount,
                status: 'pending',
                description: `Lead farmer commission (${commissionRate}%) for batch ${nextBatchNumber}`,
                order_id: orderIds[0]
              });

            console.log(`[${requestId}] Created lead farmer commission: $${commissionAmount.toFixed(2)}`);
          }
        }

        batchesCreated.push({
          batch_id: batch.id,
          batch_number: nextBatchNumber,
          zip_code: zipCode,
          order_count: orders.length,
          total_distance_km: Math.round(totalDistance * 100) / 100,
          estimated_duration_minutes: estimatedDuration
        });

        // Send notifications
        for (const order of orders) {
          try {
            await supabase.functions.invoke('send-notification', {
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
            console.error(`[${requestId}] Notification error (non-blocking):`, notifError);
          }
        }

        console.log(`[${requestId}] Batch ${batch.id} completed with ${orders.length} stops`);

      } catch (error: any) {
        console.error(`[${requestId}] Error processing ZIP ${zipCode}:`, error);
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

  console.log(`[${requestId}] ✅ Batch generation complete:`, response);

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withRateLimit(RATE_LIMITS.GENERATE_BATCHES),
  withErrorHandling,
]);

serve((req) => middlewareStack(handler)(req, {} as any));
