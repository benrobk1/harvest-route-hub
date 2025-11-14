import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createMiddlewareStack,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
} from '../_shared/middleware/index.ts';
import type { CORSContext } from '../_shared/middleware/withCORS.ts';
import type { RequestIdContext } from '../_shared/middleware/withRequestId.ts';
import type { SupabaseServiceRoleContext } from '../_shared/middleware/withSupabaseServiceRole.ts';

interface GenerateBatchesContext
  extends RequestIdContext,
    CORSContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<GenerateBatchesContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
]);

// ZIP code center coordinates fallback (NYC demo ZIPs)
function getZipCenterCoordinates(zipCode: string): { latitude: number; longitude: number } {
  const zipCenters: { [key: string]: [number, number] } = {
    '10001': [40.7506, -73.9971],
    '10002': [40.7157, -73.9860],
    '10003': [40.7320, -73.9875],
    '10004': [40.6990, -74.0177],
    '10005': [40.7056, -74.0087],
    '10006': [40.7093, -74.0120],
    '10007': [40.7135, -74.0078],
    '10009': [40.7264, -73.9779],
    '10010': [40.7392, -73.9817],
    '10011': [40.7406, -74.0008]
  };
  
  const coords = zipCenters[zipCode] || [40.7580, -73.9855]; // Default NYC center
  return { latitude: coords[0], longitude: coords[1] };
}

// GEOCODING FALLBACK CHAIN:
// 1. Mapbox API (most accurate, requires MAPBOX_PUBLIC_TOKEN)
// 2. ZIP code center (good fallback, ~1km accuracy)
// 3. Default NYC center (last resort)
// WHY: Ensures batch generation never fails due to geocoding issues.
// Geographic fallback maintains service coverage even when external APIs are down.
async function geocodeAddress(address: string, zipCode?: string, config?: any): Promise<{ latitude: number; longitude: number } | null> {
  if (!config?.mapbox?.publicToken) {
    console.warn('⚠️ MAPBOX_PUBLIC_TOKEN not configured - using ZIP-based fallback (accuracy: ~1km)');
    return zipCode ? getZipCenterCoordinates(zipCode) : null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${config.mapbox.publicToken}&limit=1`
    );
    
    if (!response.ok) {
      console.warn('Mapbox geocoding failed:', response.status, '- using ZIP fallback');
      return zipCode ? getZipCenterCoordinates(zipCode) : null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
    
    console.warn('No Mapbox results - using ZIP fallback');
    return zipCode ? getZipCenterCoordinates(zipCode) : null;
  } catch (error) {
    console.warn('Error geocoding address:', error, '- using ZIP fallback');
    return zipCode ? getZipCenterCoordinates(zipCode) : null;
  }
}

// Calculate distance between two points using Haversine formula (fallback)
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

// Get OSRM distance matrix for multiple stops
async function getOsrmDistanceMatrix(
  coordinates: [number, number][]
): Promise<{ durations: number[][]; distances: number[][] } | null> {
  const osrmServer = Deno.env.get('OSRM_SERVER_URL') || 'https://router.project-osrm.org';
  
  if (coordinates.length < 2) {
    console.warn('Need at least 2 coordinates for distance matrix');
    return null;
  }

  try {
    // Round coordinates to 6 decimal places for efficiency
    const coordString = coordinates
      .map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`)
      .join(';');

    const url = `${osrmServer}/table/v1/driving/${coordString}?annotations=distance,duration`;
    
    console.log(`Fetching OSRM distance matrix for ${coordinates.length} stops...`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error('OSRM distance matrix request failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.code !== 'Ok') {
      console.error('OSRM error:', data.code, data.message);
      return null;
    }

    // Convert durations to minutes and distances to km
    const durations = data.durations.map((row: number[]) => 
      row.map((seconds: number) => seconds / 60)
    );
    const distances = data.distances.map((row: number[]) => 
      row.map((meters: number) => meters / 1000)
    );

    return { durations, distances };
  } catch (error) {
    console.error('Error fetching OSRM distance matrix:', error);
    return null;
  }
}

// Get detailed OSRM route with turn-by-turn directions
async function getOsrmRoute(
  coordinates: [number, number][]
): Promise<any | null> {
  const osrmServer = Deno.env.get('OSRM_SERVER_URL') || 'https://router.project-osrm.org';
  
  if (coordinates.length < 2) {
    return null;
  }

  try {
    const coordString = coordinates
      .map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`)
      .join(';');

    const url = `${osrmServer}/route/v1/driving/${coordString}?overview=full&geometries=polyline&steps=true`;
    
    console.log('Fetching OSRM route with turn-by-turn directions...');
    const response = await fetch(url);

    if (!response.ok) {
      console.error('OSRM route request failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('OSRM route error:', data.code);
      return null;
    }

    const route = data.routes[0];
    return {
      distance: route.distance / 1000, // Convert to km
      duration: route.duration / 60, // Convert to minutes
      geometry: route.geometry, // Polyline for map display
      legs: route.legs.map((leg: any) => ({
        distance: leg.distance / 1000,
        duration: leg.duration / 60,
        steps: leg.steps.map((step: any) => ({
          maneuver: step.maneuver.type,
          instruction: step.maneuver.instruction || `${step.maneuver.type} ${step.name || ''}`,
          distance: step.distance / 1000,
          duration: step.duration / 60
        }))
      }))
    };
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    return null;
  }
}

// 2-opt algorithm to improve route
function twoOptImprove(route: any[], distanceMatrix: number[][]): any[] {
  if (route.length < 4) return route;

  let improved = true;
  let bestRoute = [...route];

  while (improved) {
    improved = false;
    
    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length - 1; j++) {
        // Calculate current distance
        const currentDist = 
          distanceMatrix[i - 1][i] +
          distanceMatrix[j][j + 1];
        
        // Calculate distance if we reverse the segment
        const newDist = 
          distanceMatrix[i - 1][j] +
          distanceMatrix[i][j + 1];
        
        if (newDist < currentDist) {
          // Reverse the segment between i and j
          const newRoute = [
            ...bestRoute.slice(0, i),
            ...bestRoute.slice(i, j + 1).reverse(),
            ...bestRoute.slice(j + 1)
          ];
          bestRoute = newRoute;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
}

// OSRM-based route optimization with 2-opt improvement
async function optimizeRouteWithOsrm(stops: any[]): Promise<{
  optimizedStops: any[];
  method: string;
  distanceMatrix?: number[][];
}> {
  if (stops.length <= 1) {
    return { optimizedStops: stops, method: 'single_stop' };
  }

  // Extract valid coordinates
  const validStops = stops.filter(s => s.latitude && s.longitude);
  
  if (validStops.length !== stops.length) {
    console.warn(`${stops.length - validStops.length} stops missing coordinates, using fallback`);
  }

  if (validStops.length === 0) {
    return { optimizedStops: stops, method: 'no_coordinates' };
  }

  // Try OSRM first
  const coordinates: [number, number][] = validStops.map(s => [s.longitude, s.latitude]);
  const matrixResult = await getOsrmDistanceMatrix(coordinates);

  if (!matrixResult) {
    console.warn('OSRM unavailable, falling back to Haversine');
    // Fallback to old nearest-neighbor with Haversine
    return { optimizedStops: optimizeRouteFallback(stops), method: 'haversine_fallback' };
  }

  const { distances } = matrixResult;

  // Nearest-neighbor using OSRM distances
  const optimized = [];
  const remaining = [...validStops];
  const indices: number[] = validStops.map((_, i) => i);
  
  let currentIndex = 0;
  optimized.push(remaining.shift()!);
  indices.shift();

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = distances[currentIndex][indices[i]];
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    currentIndex = indices.splice(nearestIndex, 1)[0];
    optimized.push(remaining.splice(nearestIndex, 1)[0]);
  }

  // Apply 2-opt improvement
  console.log('Applying 2-opt optimization...');
  const improvedRoute = twoOptImprove(optimized, distances);

  return { 
    optimizedStops: improvedRoute, 
    method: 'osrm_with_2opt',
    distanceMatrix: distances
  };
}

// Fallback nearest-neighbor using Haversine or ZIP-based sorting
function optimizeRouteFallback(stops: any[]): any[] {
  if (stops.length <= 1) return stops;

  // Sort by ZIP code first, then by street address
  const sorted = [...stops].sort((a, b) => {
    // Extract ZIP from address if available
    const zipA = a.address?.match(/\d{5}/)?.[0] || '';
    const zipB = b.address?.match(/\d{5}/)?.[0] || '';
    
    if (zipA !== zipB) {
      return zipA.localeCompare(zipB);
    }
    
    // Within same ZIP, sort by street address
    return (a.address || '').localeCompare(b.address || '');
  });

  // Then apply nearest-neighbor if coordinates available
  const optimized = [];
  const remaining = [...sorted];
  
  let current = remaining.shift()!;
  optimized.push(current);

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
      } else {
        // If no coordinates, just use next in ZIP-sorted order
        nearestIndex = i;
        break;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }

  console.log('Using ZIP-based routing fallback');
  return optimized;
}

// Calculate estimated arrival times with OSRM route data
async function calculateEstimatedArrivalsWithOsrm(
  stops: any[], 
  startTime: Date
): Promise<any[]> {
  const stopDurationMinutes = 10;
  
  // Try to get OSRM route for accurate times
  const coordinates: [number, number][] = stops
    .filter(s => s.latitude && s.longitude)
    .map(s => [s.longitude, s.latitude]);

  const osrmRoute = await getOsrmRoute(coordinates);

  if (osrmRoute && osrmRoute.legs) {
    // Use OSRM's actual travel times
    let currentTime = new Date(startTime);
    
    return stops.map((stop, index) => {
      if (index > 0 && osrmRoute.legs[index - 1]) {
        const travelMinutes = osrmRoute.legs[index - 1].duration;
        currentTime = new Date(currentTime.getTime() + (travelMinutes + stopDurationMinutes) * 60000);
      }
      
      return {
        ...stop,
        estimated_arrival: currentTime.toISOString()
      };
    });
  }

  // Fallback to Haversine-based calculation
  console.warn('Using fallback time calculation with Haversine');
  const avgSpeedKmh = 40;
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


const handler = stack(async (_req, ctx) => {
  const supabaseClient = ctx.supabase;
  const corsHeaders = ctx.corsHeaders;
  const requestId = ctx.requestId;
  const config = ctx.config;

  try {
    console.log(`[${requestId}] [GENERATE-BATCHES] Starting batch generation...`);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    console.log(`[${requestId}] [GENERATE-BATCHES] Processing orders for delivery date: ${tomorrowDate}`);

    const { data: pendingOrders, error: ordersError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        consumer_id,
        total_amount,
        profiles (
          zip_code,
          delivery_address,
          latitude,
          longitude
        )
      `)
      .eq('status', 'pending')
      .eq('delivery_date', tomorrowDate);

    if (ordersError) {
      console.error(`[${requestId}] [GENERATE-BATCHES] Error fetching pending orders:`, ordersError);
      throw ordersError;
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log(`[${requestId}] [GENERATE-BATCHES] No pending orders found for tomorrow.`);
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending orders for tomorrow',
        delivery_date: tomorrowDate,
        batches_created: 0,
        total_orders_processed: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] [GENERATE-BATCHES] Found ${pendingOrders.length} pending orders for tomorrow.`);

    const ordersByZip = new Map<string, any[]>();
    for (const order of pendingOrders) {
      const profile = order.profiles as any;
      const zipCode = profile?.zip_code || 'unknown';
      if (!ordersByZip.has(zipCode)) {
        ordersByZip.set(zipCode, []);
      }
      ordersByZip.get(zipCode)!.push(order);
    }

    console.log(`[${requestId}] [GENERATE-BATCHES] Processing ${ordersByZip.size} ZIP codes.`);

    const batchesCreated: any[] = [];
    const errors: any[] = [];

    for (const [zipCode, orders] of ordersByZip.entries()) {
      try {
        console.log(`[${requestId}] [GENERATE-BATCHES] Processing ZIP ${zipCode} with ${orders.length} orders...`);

        if (zipCode === 'unknown') {
          errors.push({ zipCode, error: 'Missing ZIP code in profile' });
          continue;
        }

        const geocodedOrders = await Promise.all(orders.map(async (order) => {
          const profile = order.profiles as any;
          const address = profile?.delivery_address || 'Address not provided';

          const geocoded = await geocodeAddress(
            address,
            profile?.zip_code,
            config
          );

          if (!geocoded) {
            console.warn(`[${requestId}] [GENERATE-BATCHES] Geocoding failed for order ${order.id}, using existing coordinates`);
            const fallback = getZipCenterCoordinates(profile?.zip_code || '10001');
            return {
              ...order,
              address,
              latitude: profile?.latitude ?? fallback.latitude,
              longitude: profile?.longitude ?? fallback.longitude
            };
          }

          return {
            ...order,
            address,
            latitude: geocoded.latitude,
            longitude: geocoded.longitude
          };
        }));

        console.log(`[${requestId}] [GENERATE-BATCHES] Geocoded ${geocodedOrders.length} orders for ZIP ${zipCode}.`);

        const { data: existingBatches } = await supabaseClient
          .from('delivery_batches')
          .select('batch_number')
          .eq('delivery_date', tomorrowDate)
          .order('batch_number', { ascending: false })
          .limit(1);

        const nextBatchNumber = existingBatches && existingBatches.length > 0
          ? existingBatches[0].batch_number + 1
          : 1;

        const { data: batch, error: batchError } = await supabaseClient
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
          console.error(`[${requestId}] [GENERATE-BATCHES] Batch creation error:`, batchError);
          errors.push({ zipCode, error: batchError?.message });
          continue;
        }

        console.log(`[${requestId}] [GENERATE-BATCHES] Batch ${batch.id} created with number ${nextBatchNumber}`);

        const unoptimizedStops = geocodedOrders.map((order) => ({
          delivery_batch_id: batch.id,
          order_id: order.id,
          address: order.address,
          latitude: order.latitude,
          longitude: order.longitude,
          status: 'pending'
        }));

        console.log(`[${requestId}] [GENERATE-BATCHES] Optimizing route with OSRM...`);
        const { optimizedStops, method } = await optimizeRouteWithOsrm(unoptimizedStops);
        console.log(`[${requestId}] [GENERATE-BATCHES] Route optimization method: ${method}`);

        const startTime = new Date(tomorrowDate);
        startTime.setHours(9, 0, 0, 0);
        const stopsWithTimes = await calculateEstimatedArrivalsWithOsrm(optimizedStops, startTime);

        const batchStops = stopsWithTimes.map((stop, index) => ({
          ...stop,
          sequence_number: index + 1
        }));

        const { data: createdStops, error: stopsError } = await supabaseClient
          .from('batch_stops')
          .insert(batchStops)
          .select();

        if (stopsError) {
          console.error(`[${requestId}] [GENERATE-BATCHES] Batch stop creation error:`, stopsError);
          errors.push({ batch_id: batch.id, error: stopsError.message });
          continue;
        }

        console.log(`[${requestId}] [GENERATE-BATCHES] Created ${batchStops.length} optimized stops`);

        for (const stop of createdStops ?? []) {
          const boxCode = `B${nextBatchNumber}-${stop.sequence_number}`;
          await supabaseClient
            .from('orders')
            .update({ box_code: boxCode })
            .eq('id', stop.order_id);
        }

        const coordinates: [number, number][] = batchStops
          .filter(s => s.latitude && s.longitude)
          .map(s => [s.longitude, s.latitude]);

        const osrmRoute = await getOsrmRoute(coordinates);

        let totalDistance = 0;
        let totalDuration = 0;

        if (osrmRoute) {
          totalDistance = osrmRoute.distance;
          totalDuration = osrmRoute.duration;
          console.log(`[${requestId}] [GENERATE-BATCHES] Using OSRM actual route distance and duration`);
        } else {
          console.warn(`[${requestId}] [GENERATE-BATCHES] OSRM route unavailable, using Haversine fallback`);
          totalDistance = batchStops.reduce((total, stop, index) => {
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
          totalDuration = (totalDistance / 40) * 60;
        }

        const estimatedDuration = Math.ceil(totalDuration + (batchStops.length * 10));

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
          routeData.turn_by_turn_directions = osrmRoute.legs.flatMap((leg: any) =>
            leg.steps.map((step: any) => step.instruction)
          );
        }

        const { error: routeError } = await supabaseClient
          .from('routes')
          .insert({
            delivery_batch_id: batch.id,
            driver_id: null,
            route_data: routeData,
            status: 'assigned'
          });

        if (routeError) {
          console.error(`[${requestId}] [GENERATE-BATCHES] Route creation error:`, routeError);
          errors.push({ batch_id: batch.id, error: routeError.message });
        }

        await supabaseClient
          .from('delivery_batches')
          .update({ estimated_duration_minutes: estimatedDuration })
          .eq('id', batch.id);

        console.log(`[${requestId}] [GENERATE-BATCHES] Route optimized: ${totalDistance.toFixed(1)} km, ${estimatedDuration} minutes`);

        const orderIds = orders.map(o => o.id);
        const { error: updateError } = await supabaseClient
          .from('orders')
          .update({
            status: 'confirmed',
            delivery_batch_id: batch.id
          })
          .in('id', orderIds);

        if (updateError) {
          console.error(`[${requestId}] [GENERATE-BATCHES] Order update error:`, updateError);
          errors.push({ batch_id: batch.id, error: updateError.message });
        }

        // Note: Lead farmer commission calculation is handled by the lead-farmer 
        // assignment process, not here. Batches are created with lead_farmer_id: null
        // and commission is computed only after a lead farmer is actually assigned.

        batchesCreated.push({
          batch_id: batch.id,
          batch_number: nextBatchNumber,
          zip_code: zipCode,
          order_count: orders.length,
          total_distance_km: Math.round(totalDistance * 100) / 100,
          estimated_duration_minutes: estimatedDuration
        });

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
            console.error(`[${requestId}] [GENERATE-BATCHES] Notification error (non-blocking):`, notifError);
          }
        }

        console.log(`[${requestId}] [GENERATE-BATCHES] Batch ${batch.id} completed with ${orders.length} stops`);

      } catch (error: any) {
        console.error(`[${requestId}] [GENERATE-BATCHES] Error processing ZIP ${zipCode}:`, error);
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

    console.log(`[${requestId}] [GENERATE-BATCHES] Batch generation complete`, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${requestId}] [GENERATE-BATCHES] Batch generation error:`, error);
    return new Response(JSON.stringify({
      error: 'SERVER_ERROR',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

serve((req) => {
  const initialContext: Partial<GenerateBatchesContext> = {};

  return handler(req, initialContext);
});
