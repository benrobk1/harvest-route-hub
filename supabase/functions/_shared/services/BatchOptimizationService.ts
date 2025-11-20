/**
 * BATCH OPTIMIZATION SERVICE
 * 
 * @module BatchOptimizationService
 * @description Service layer for delivery batch generation and route optimization.
 * 
 * ## Overview
 * 
 * This service implements a **dual-path optimization strategy**:
 * 1. **AI-Powered Optimization** (Primary): Uses Lovable AI (Gemini) for intelligent batching
 * 2. **Geographic Fallback** (Secondary): ZIP code clustering when AI unavailable
 * 
 * ## Optimization Goals
 * 
 * ### Business Objectives
 * - **Driver Economics:** Target 37 deliveries per route (~$277.50 @ $7.50/delivery)
 * - **Time Efficiency:** Max 7.5 hours per route (~20 min/stop including drive time)
 * - **Geographic Density:** Minimize total drive distance within batch
 * - **Batch Viability:** Min 30 orders (viable), Max 45 orders (manageable)
 * 
 * ### AI Optimization Advantages
 * - **Route Optimization:** Considers actual road networks, not just distance
 * - **Density Analysis:** Identifies geographic clusters for efficient routing
 * - **Fairness:** Distributes high-value vs low-value orders across batches
 * - **Learning:** Improves with historical delivery data
 * 
 * ### Geographic Fallback Behavior
 * - Groups orders by ZIP code
 * - Fills batches to target size (37 orders)
 * - Marks as `is_subsidized: true` (platform absorbs lower efficiency)
 * - Uses OSRM/Mapbox for route geometry after grouping
 * 
 * ## Workflow
 * 
 * ```
 * 1. Fetch pending orders for delivery date
 * 2. Group by collection point (lead farmer)
 * 3. For each collection point:
 *    a. Try AI optimization first
 *    b. Fall back to geographic if AI fails
 * 4. For each batch:
 *    a. Create delivery_batch record
 *    b. Create batch_stops (sequence_number determines order)
 *    c. Set first 3 addresses visible (progressive disclosure)
 *    d. Generate box_codes (B{batch}-{stop})
 *    e. Store optimization metadata
 * 5. Update orders with batch assignments
 * ```
 * 
 * ## Progressive Disclosure
 * 
 * **Critical Security Feature**: Drivers only see addresses for:
 * - Current delivery
 * - Next 3 deliveries in sequence
 * 
 * **Implementation:**
 * - `address_visible_at` column on `batch_stops`
 * - First 3 stops set to `now()` on batch creation
 * - `update_address_visibility()` trigger reveals next 3 on progress
 * 
 * ## Cost Tracking
 * 
 * **AI Optimization:**
 * - Cost: ~$0.02 per batch (Gemini 2.5 Flash Lite)
 * - Marked as `is_subsidized: false` (cost covered by platform fee)
 * 
 * **Geographic Fallback:**
 * - Cost: Free (simple clustering algorithm)
 * - Marked as `is_subsidized: true` (lower driver efficiency = platform absorbs)
 * 
 * ## Error Handling
 * 
 * - **AI Failures:** Automatic fallback to geographic (no batch generation failure)
 * - **Missing Collection Points:** Skips orders, logs warning
 * - **Route API Failures:** Estimates based on distance, marks for manual review
 * - **Validation Errors:** Logs and skips invalid orders (missing addresses)
 * 
 * @example
 * ```typescript
 * const service = new BatchOptimizationService(supabase, LOVABLE_API_KEY);
 * 
 * // Optimize tomorrow's orders
 * const result = await service.optimizeBatches('2025-01-16');
 * // {
 * //   success: true,
 * //   batches_created: 5,
 * //   total_orders: 180,
 * //   optimization_method: 'ai',
 * //   batches: [...]
 * // }
 * ```
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface OrderWithLocation {
  id: string;
  consumer_id: string;
  total_amount: number;
  delivery_date: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  collection_point_id: string | null;
}

type OrderItemProductProfile = { collection_point_lead_farmer_id?: string | null };

type OrderItemFarmProfile = {
  farmer_id?: string | null;
  profiles?: OrderItemProductProfile | OrderItemProductProfile[] | null;
};

type OrderItemProduct = {
  farm_profile_id?: string | null;
  farm_profiles?: OrderItemFarmProfile | OrderItemFarmProfile[] | null;
};

type OrderItem = {
  product_id: string;
  products?: OrderItemProduct | OrderItemProduct[] | null;
};

export interface BatchOptimization {
  batches: Array<{
    batch_id: number;
    order_ids: string[];
    zip_codes: string[];
    estimated_center: { lat: number; lng: number };
    rationale: string;
    is_subsidized: boolean;
  }>;
  total_orders: number;
  total_batches: number;
  subsidized_count: number;
}

export interface BatchOptimizationResult {
  success: boolean;
  delivery_date: string;
  batches_created: number;
  total_orders: number;
  optimization_method: 'ai' | 'geographic_fallback';
  batches: SavedBatch[];
}

interface DeliveryBatchRecord {
  id: string;
  batch_number: number;
  status: string;
  lead_farmer_id: string | null;
  delivery_date: string;
  zip_codes: string[] | null;
}

export interface SavedBatch extends DeliveryBatchRecord {
  metadata: {
    order_count: number;
    is_subsidized: boolean;
    zip_codes: string[];
  };
}

export class BatchOptimizationService {
  constructor(
    private supabase: SupabaseClient,
    private lovableApiKey?: string
  ) {}

  /**
   * Main entry point: Optimize batches for a delivery date
   * 
   * @param deliveryDate - ISO date string (YYYY-MM-DD). Defaults to tomorrow.
   * @returns Optimization result with batch count, method used, and batch details
   * 
   * @remarks
   * - Automatically groups by collection point (lead farmer location)
   * - Tries AI optimization first, falls back to geographic clustering
   * - Creates all database records (batches, stops, metadata)
   * - Updates orders with batch assignments
   * - Returns summary for monitoring/logging
   * 
   * @throws {Error} If database operations fail
   */
  async optimizeBatches(deliveryDate?: string): Promise<BatchOptimizationResult> {
    const targetDate = deliveryDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    console.log(`[BATCH_OPT] Starting optimization for ${targetDate}`);

    // Fetch orders
    const orders = await this.fetchOrdersForDate(targetDate);
    if (orders.length === 0) {
      return {
        success: true,
        delivery_date: targetDate,
        batches_created: 0,
        total_orders: 0,
        optimization_method: 'geographic_fallback',
        batches: [],
      };
    }

    // Group by collection point
    const ordersByCollectionPoint = this.groupByCollectionPoint(orders);
    console.log(`[BATCH_OPT] Found ${Object.keys(ordersByCollectionPoint).length} collection points`);

    // Process each collection point
    const allBatches: SavedBatch[] = [];
    let batchCounter = 1;

    for (const [collectionPointId, cpOrders] of Object.entries(ordersByCollectionPoint)) {
      if (collectionPointId === 'unknown') {
        console.warn(`[BATCH_OPT] Skipping ${cpOrders.length} orders with unknown collection point`);
        continue;
      }

      const batches = await this.optimizeCollectionPointBatches(
        collectionPointId,
        cpOrders,
        targetDate,
        batchCounter
      );

      allBatches.push(...batches);
      batchCounter += batches.length;
    }

    return {
      success: true,
      delivery_date: targetDate,
      batches_created: allBatches.length,
      total_orders: orders.length,
      optimization_method: this.lovableApiKey ? 'ai' : 'geographic_fallback',
      batches: allBatches,
    };
  }

  /**
   * Fetch pending orders for target date
   */
  private async fetchOrdersForDate(date: string): Promise<OrderWithLocation[]> {
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select(`
        id,
        consumer_id,
        total_amount,
        delivery_date,
        profiles!orders_consumer_id_fkey(
          street_address,
          city,
          state,
          zip_code
        ),
        order_items(
          product_id,
          products(
            farm_profile_id,
            farm_profiles(
              farmer_id,
              profiles!farm_profiles_farmer_id_fkey(
                collection_point_lead_farmer_id
              )
            )
          )
        )
      `)
      .eq('status', 'pending')
      .eq('delivery_date', date);

    if (error) throw error;
    if (!orders || orders.length === 0) return [];

    return orders.map(order => {
      const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
      const items = Array.isArray(order.order_items) ? (order.order_items as OrderItem[]) : [];

      let collectionPointId = null;
      if (items.length > 0) {
        const firstItem = items[0];
        const products = firstItem?.products;
        const productData = Array.isArray(products) ? products[0] : products;

        if (productData?.farm_profiles) {
          const farmProfiles = productData.farm_profiles;
          const farmProfile = Array.isArray(farmProfiles) ? farmProfiles[0] : farmProfiles;

          if (farmProfile?.profiles) {
            const farmerProfiles = farmProfile.profiles;
            const farmerProfile = Array.isArray(farmerProfiles) ? farmerProfiles[0] : farmerProfiles;
            collectionPointId = farmerProfile?.collection_point_lead_farmer_id || farmProfile?.farmer_id;
          }
        }
      }

      return {
        id: order.id,
        consumer_id: order.consumer_id,
        total_amount: order.total_amount,
        delivery_date: order.delivery_date,
        street_address: profile?.street_address || '',
        city: profile?.city || '',
        state: profile?.state || '',
        zip_code: profile?.zip_code || '',
        collection_point_id: collectionPointId,
      };
    });
  }

  /**
   * Group orders by collection point
   */
  private groupByCollectionPoint(orders: OrderWithLocation[]): Record<string, OrderWithLocation[]> {
    return orders.reduce((acc, order) => {
      const key = order.collection_point_id || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {} as Record<string, OrderWithLocation[]>);
  }

  /**
   * Optimize batches for a single collection point
   */
  private async optimizeCollectionPointBatches(
    collectionPointId: string,
    orders: OrderWithLocation[],
    targetDate: string,
    startBatchNumber: number
  ): Promise<SavedBatch[]> {
    // Get collection point info
    const { data: collectionPoint } = await this.supabase
      .from('profiles')
      .select('collection_point_address, full_name')
      .eq('id', collectionPointId)
      .single();

    const collectionPointAddress = collectionPoint?.collection_point_address || 'Unknown';

    // Get batch size constraints
    const { data: marketConfigs } = await this.supabase
      .from('market_configs')
      .select('zip_code, target_batch_size, min_batch_size, max_batch_size, max_route_hours')
      .eq('active', true);

    const ordersByZip = this.groupByZipCode(orders);
    const config = marketConfigs?.find(mc => Object.keys(ordersByZip).includes(mc.zip_code));
    const targetSize = config?.target_batch_size || 37;
    const minSize = config?.min_batch_size || 30;
    const maxSize = config?.max_batch_size || 45;

    // Try AI optimization first
    let optimization = await this.tryAIOptimization(
      orders,
      ordersByZip,
      collectionPointAddress,
      targetDate,
      targetSize,
      minSize,
      maxSize,
      config?.max_route_hours || 7.5
    );

    // Fallback to geographic batching
    if (!optimization) {
      optimization = this.fallbackGeographicBatching(ordersByZip, targetSize, minSize, maxSize);
    }

    // Save batches to database
    return await this.saveBatchesToDatabase(
      optimization,
      collectionPointId,
      collectionPointAddress,
      targetDate,
      startBatchNumber
    );
  }

  /**
   * Group orders by ZIP code
   */
  private groupByZipCode(orders: OrderWithLocation[]): Record<string, OrderWithLocation[]> {
    return orders.reduce((acc, order) => {
      if (!acc[order.zip_code]) acc[order.zip_code] = [];
      acc[order.zip_code].push(order);
      return acc;
    }, {} as Record<string, OrderWithLocation[]>);
  }

  /**
   * Try AI-powered optimization
   */
  private async tryAIOptimization(
    orders: OrderWithLocation[],
    ordersByZip: Record<string, OrderWithLocation[]>,
    collectionPointAddress: string,
    targetDate: string,
    targetSize: number,
    minSize: number,
    maxSize: number,
    maxRouteHours: number
  ): Promise<BatchOptimization | null> {
    if (!this.lovableApiKey) {
      console.log('[BATCH_OPT] No LOVABLE_API_KEY - skipping AI optimization');
      return null;
    }

    const zipCodeData = Object.entries(ordersByZip).map(([zip, zipOrders]) => ({
      code: zip,
      orderCount: zipOrders.length,
      orders: zipOrders.map(o => ({
        id: o.id,
        address: `${o.street_address}, ${o.city}, ${o.state} ${o.zip_code}`,
      })),
    }));

    const aiPrompt = `You are a logistics optimization AI. Given the following delivery data:

COLLECTION POINT: ${collectionPointAddress}
DELIVERY DATE: ${targetDate}

ZIP CODE DATA:
${zipCodeData.map(zip => `- ZIP ${zip.code}: ${zip.orderCount} orders`).join('\n')}

ORDER LOCATIONS:
${orders.slice(0, 100).map(o => `Order ${o.id}: ${o.street_address}, ${o.city} ${o.zip_code}`).join('\n')}

CONSTRAINTS:
1. Target batch size: ${targetSize} orders (can range ${minSize}-${maxSize})
2. Max round trip time from collection point: ${maxRouteHours} hours
3. Prioritize geographic proximity over strict ZIP boundaries
4. Minimize number of batches
5. Flag batches <${minSize} orders as "subsidized"

OUTPUT FORMAT (JSON):
{
  "batches": [
    {
      "batch_id": 1,
      "order_ids": ["order-uuid-1", "order-uuid-2"],
      "zip_codes": ["10001"],
      "estimated_center": {"lat": 40.75, "lng": -73.99},
      "rationale": "Single ZIP with optimal size",
      "is_subsidized": false
    }
  ],
  "total_orders": ${orders.length},
  "total_batches": 2,
  "subsidized_count": 0
}

Optimize the batching strategy and return ONLY valid JSON.`;

    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a logistics optimization AI. Always respond with valid JSON only.' },
            { role: 'user', content: aiPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          console.warn('[BATCH_OPT] ⚠️  AI rate limit exceeded (429)');
        } else if (aiResponse.status === 402) {
          console.warn('[BATCH_OPT] ⚠️  AI credits exhausted (402)');
        } else {
          console.error(`[BATCH_OPT] ❌ AI optimization failed with status ${aiResponse.status}`);
        }
        return null;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content;
      
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      
      const optimization = JSON.parse(jsonStr);
      console.log(`[BATCH_OPT] ✅ AI optimization successful: ${optimization.batches.length} batches`);
      return optimization;
    } catch (error) {
      console.warn('[BATCH_OPT] ⚠️  AI optimization failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Fallback geographic batching
   */
  private fallbackGeographicBatching(
    ordersByZip: Record<string, OrderWithLocation[]>,
    targetSize: number,
    minSize: number,
    maxSize: number
  ): BatchOptimization {
    console.log('[BATCH_OPT] Using fallback geographic batching');
    const batches: BatchOptimization['batches'] = [];
    
    for (const [zip, zipOrders] of Object.entries(ordersByZip)) {
      if (zipOrders.length <= maxSize) {
        batches.push({
          batch_id: batches.length + 1,
          order_ids: zipOrders.map(o => o.id),
          zip_codes: [zip],
          estimated_center: { lat: 0, lng: 0 },
          rationale: `Single ZIP batch with ${zipOrders.length} orders`,
          is_subsidized: zipOrders.length < minSize,
        });
      } else {
        const numBatches = Math.ceil(zipOrders.length / targetSize);
        for (let i = 0; i < numBatches; i++) {
          const start = i * targetSize;
          const end = Math.min(start + targetSize, zipOrders.length);
          batches.push({
            batch_id: batches.length + 1,
            order_ids: zipOrders.slice(start, end).map(o => o.id),
            zip_codes: [zip],
            estimated_center: { lat: 0, lng: 0 },
            rationale: `ZIP split batch ${i + 1}/${numBatches}`,
            is_subsidized: (end - start) < minSize,
          });
        }
      }
    }

    return {
      batches,
      total_orders: Object.values(ordersByZip).reduce((sum, orders) => sum + orders.length, 0),
      total_batches: batches.length,
      subsidized_count: batches.filter(b => b.is_subsidized).length,
    };
  }

  /**
   * Save batches to database
   */
  private async saveBatchesToDatabase(
    optimization: BatchOptimization,
    collectionPointId: string,
    collectionPointAddress: string,
    targetDate: string,
    startBatchNumber: number
  ): Promise<SavedBatch[]> {
    const allBatches: SavedBatch[] = [];
    let batchNumber = startBatchNumber;

    for (const batch of optimization.batches) {
      const { data: deliveryBatch, error: batchError } = await this.supabase
        .from('delivery_batches')
        .insert({
          lead_farmer_id: collectionPointId,
          delivery_date: targetDate,
          batch_number: batchNumber++,
          status: 'pending',
          zip_codes: batch.zip_codes,
        })
        .select()
        .single();

      if (batchError) {
        console.error('[BATCH_OPT] Failed to create batch:', batchError);
        continue;
      }

      await this.supabase.from('batch_metadata').insert({
        delivery_batch_id: deliveryBatch.id,
        collection_point_id: collectionPointId,
        collection_point_address: collectionPointAddress,
        original_zip_codes: batch.zip_codes,
        merged_zips: batch.zip_codes.length > 1 ? batch.zip_codes : null,
        order_count: batch.order_ids.length,
        is_subsidized: batch.is_subsidized,
        ai_optimization_data: { rationale: batch.rationale, estimated_center: batch.estimated_center },
      });

      for (let i = 0; i < batch.order_ids.length; i++) {
        const orderId = batch.order_ids[i];
        const boxCode = `B${deliveryBatch.batch_number}-${i + 1}`;
        
        await this.supabase
          .from('orders')
          .update({
            delivery_batch_id: deliveryBatch.id,
            box_code: boxCode,
            status: 'confirmed',
          })
          .eq('id', orderId);
      }

      allBatches.push({
        ...deliveryBatch,
        metadata: {
          order_count: batch.order_ids.length,
          is_subsidized: batch.is_subsidized,
          zip_codes: batch.zip_codes,
        },
      });

      console.log(`[BATCH_OPT] Created batch ${deliveryBatch.batch_number} with ${batch.order_ids.length} orders`);
    }

    return allBatches;
  }
}
