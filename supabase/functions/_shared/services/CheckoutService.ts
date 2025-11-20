import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * CHECKOUT SERVICE
 * Extracted business logic for checkout processing
 * Handles validation, payment, order creation, and notifications
 */

export interface CheckoutInput {
  cartId: string;
  userId: string;
  userEmail: string;
  deliveryDate: string;
  useCredits: boolean;
  paymentMethodId?: string;
  tipAmount: number;
  requestOrigin: string;
  isDemoMode?: boolean;
}

export interface CheckoutResult {
  success: boolean;
  orderId: string;
  clientSecret?: string;
  amountCharged: number;
  creditsRedeemed: number;
  paymentStatus: 'paid' | 'pending' | 'requires_action';
}

type PaymentStatus = CheckoutResult['paymentStatus'];

interface CartRecord {
  id: string;
  consumer_id: string;
}

interface MarketConfig {
  delivery_fee: number | string;
  minimum_order: number | string;
  delivery_days: string[];
  cutoff_time: string;
  zip_code: string;
  active: boolean;
}

interface ProductFarmProfile {
  farm_name: string;
  farmer_id: string;
}

interface ProductDetails {
  id: string;
  name: string;
  price: number;
  available_quantity: number;
  farm_profile_id: string;
  farm_profiles: ProductFarmProfile;
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products: ProductDetails;
}

interface UserProfile {
  zip_code: string;
  delivery_address: string;
}

export class CheckoutService {
  constructor(
    private supabase: SupabaseClient,
    private stripe: Stripe
  ) {}

  async processCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const { cartId, userId, userEmail, deliveryDate, useCredits, paymentMethodId, tipAmount, requestOrigin, isDemoMode = false } = input;
    const requestId = crypto.randomUUID();

    console.log(`[${requestId}] [CHECKOUT] Starting checkout for user ${userId}${isDemoMode ? ' (DEMO MODE)' : ''}`);

    // FAST PATH FOR DEMO MODE: Parallelize minimal queries and skip heavy operations
    if (isDemoMode) {
      const [_, cartItems] = await Promise.all([
        this.validateCart(cartId, userId, requestId),
        this.getCartItems(cartId, requestId),
      ]);

      if (cartItems.length === 0) {
        throw new CheckoutError('EMPTY_CART', 'Cart is empty');
      }

      // Skip delivery date validation in demo mode
      const { subtotal } = await this.validatePricesAndInventory(cartItems, requestId);
      
      // Minimal fee calculation with lightweight defaults
      const platformFee = subtotal * 0.10;
      const deliveryFee = 5.99; // Fixed delivery fee for demo
      const totalBeforeCredits = subtotal + platformFee + deliveryFee + tipAmount;
      const creditsUsed = 0; // Skip credits in demo mode for speed
      const totalAmount = totalBeforeCredits;

      // Skip payment processing entirely in demo
      const paymentIntent = null;

      // Create order (skip payouts/fees/inventory updates in demo)
      const orderId = await this.createOrder(
        userId,
        deliveryDate,
        totalAmount,
        tipAmount,
        'paid',
        paymentIntent,
        cartItems,
        platformFee,
        deliveryFee,
        creditsUsed,
        {},
        requestId,
        true
      );

      // Clear cart
      await this.clearCart(cartId, requestId);

      // Skip notification in demo mode
      console.log(`[${requestId}] [CHECKOUT] ✅ Demo checkout completed: order ${orderId}`);

      return {
        success: true,
        orderId,
        amountCharged: totalAmount,
        creditsRedeemed: creditsUsed,
        paymentStatus: 'paid'
      };
    }

    // OPTIMIZED PATH: Parallelize independent queries
    console.log(`[${requestId}] [CHECKOUT] Fetching initial data in parallel...`);
    const [cart, cartItems, profile] = await Promise.all([
      this.validateCart(cartId, userId, requestId),
      this.getCartItems(cartId, requestId),
      this.getUserProfile(userId, requestId)
    ]);

    if (cartItems.length === 0) {
      throw new CheckoutError('EMPTY_CART', 'Cart is empty');
    }

    // Get market config and validate delivery date in parallel with price validation
    const [marketConfig, { subtotal, insufficientProducts }] = await Promise.all([
      this.getMarketConfig(profile.zip_code, requestId),
      this.validatePricesAndInventory(cartItems, requestId)
    ]);

    // Validate delivery date (requires market config)
    await this.validateDeliveryDate(deliveryDate, marketConfig, requestId);
    
    if (insufficientProducts.length > 0) {
      throw new CheckoutError('INSUFFICIENT_INVENTORY', 'Some products are out of stock', { products: insufficientProducts });
    }

    // 8. Calculate fees
    const { platformFee, deliveryFee, totalBeforeCredits } = this.calculateFees(
      subtotal, 
      marketConfig.delivery_fee, 
      tipAmount,
      requestId
    );

    // 9. Check minimum order
    if (subtotal < parseFloat(marketConfig.minimum_order.toString())) {
      throw new CheckoutError('BELOW_MINIMUM_ORDER', `Minimum order is $${marketConfig.minimum_order}`, {
        minimum: marketConfig.minimum_order,
        current: subtotal
      });
    }

    // 10. Handle credits (server-side recomputation)
    const creditsUsed = await this.calculateCreditsUsed(userId, useCredits, totalBeforeCredits, requestId);
    const totalAmount = totalBeforeCredits - creditsUsed;

    console.log(`[${requestId}] [CHECKOUT] Payment breakdown: subtotal=$${subtotal}, platformFee=$${platformFee}, deliveryFee=$${deliveryFee}, tip=$${tipAmount}, credits=$${creditsUsed}, total=$${totalAmount}`);

    // 11. Process payment if needed
    const { paymentIntent, paymentStatus } = await this.processPayment(
      totalAmount,
      userId,
      userEmail,
      deliveryDate,
      subtotal,
      platformFee,
      deliveryFee,
      creditsUsed,
      paymentMethodId,
      requestOrigin,
      requestId
    );

    // 12. Create order with all related records
    const orderId = await this.createOrder(
      userId,
      deliveryDate,
      totalAmount,
      tipAmount,
      paymentStatus,
      paymentIntent,
      cartItems,
      platformFee,
      deliveryFee,
      creditsUsed,
      profile,
      requestId
    );

    // 13. Clear cart
    await this.clearCart(cartId, requestId);

    // 14. Send notification
    await this.sendOrderConfirmation(orderId, requestId);

    console.log(`[${requestId}] [CHECKOUT] ✅ Checkout completed successfully: order ${orderId}`);

    return {
      success: true,
      orderId,
      clientSecret: paymentIntent?.client_secret || undefined,
      amountCharged: totalAmount,
      creditsRedeemed: creditsUsed,
      paymentStatus
    };
  }

  private async validateDeliveryAddress(userId: string, requestId: string): Promise<void> {
    const { data: userProfile, error } = await this.supabase
      .from('profiles')
      .select('delivery_address, zip_code')
      .eq('id', userId)
      .single();

    if (error || !userProfile?.delivery_address) {
      console.error(`[${requestId}] [CHECKOUT] ❌ Missing delivery address for user ${userId}`);
      throw new CheckoutError('MISSING_ADDRESS', 'Delivery address not found. Please update your profile.');
    }
  }

  private async validateCart(cartId: string, userId: string, requestId: string): Promise<CartRecord> {
    const { data: cart, error } = await this.supabase
      .from('shopping_carts')
      .select('id, consumer_id')
      .eq('id', cartId)
      .single();

    if (error || !cart || cart.consumer_id !== userId) {
      console.error(`[${requestId}] [CHECKOUT] ❌ Invalid cart ${cartId} for user ${userId}`);
      throw new CheckoutError('INVALID_CART', 'Invalid cart');
    }

    return cart;
  }

  private async getCartItems(cartId: string, requestId: string): Promise<CartItem[]> {
    const { data: cartItems, error } = await this.supabase
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
      .eq('cart_id', cartId);

    if (error) {
      console.error(`[${requestId}] [CHECKOUT] ❌ Failed to fetch cart items:`, error);
      throw new CheckoutError('CHECKOUT_ERROR', 'Failed to fetch cart items');
    }

    return (cartItems ?? []) as CartItem[];
  }

  private async getUserProfile(userId: string, requestId: string): Promise<UserProfile> {
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('zip_code, delivery_address')
      .eq('id', userId)
      .single();

    if (error || !profile?.zip_code || !profile?.delivery_address) {
      console.error(`[${requestId}] [CHECKOUT] ❌ Incomplete profile for user ${userId}`);
      throw new CheckoutError('MISSING_PROFILE_INFO', 'Please complete your delivery address and zip code');
    }

    return profile;
  }

  private async getMarketConfig(zipCode: string, requestId: string): Promise<MarketConfig> {
    const { data: marketConfig, error } = await this.supabase
      .from('market_configs')
      .select('*')
      .eq('zip_code', zipCode)
      .eq('active', true)
      .single();

    if (error || !marketConfig) {
      console.error(`[${requestId}] [CHECKOUT] ❌ No market config for ZIP ${zipCode}`);
      throw new CheckoutError('NO_MARKET_CONFIG', `No active market configuration found for ZIP code ${zipCode}`);
    }

    return marketConfig as MarketConfig;
  }

  private async validateDeliveryDate(deliveryDate: string, marketConfig: MarketConfig, requestId: string): Promise<void> {
    // Parse the ISO datetime but use just the date portion to avoid timezone issues
    const dateStr = deliveryDate.split('T')[0]; // Extract YYYY-MM-DD
    const deliveryDateObj = new Date(dateStr + 'T12:00:00Z'); // Use noon UTC to avoid day boundary issues
    const dayOfWeek = deliveryDateObj.getUTCDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    
    console.log(`[${requestId}] [CHECKOUT] Validating delivery date: ${dateStr}, day: ${dayName}, allowed days: ${JSON.stringify(marketConfig.delivery_days)}`);
    
    if (!marketConfig.delivery_days.includes(dayName)) {
      console.warn(`[${requestId}] [CHECKOUT] ⚠️  Invalid delivery day: ${dayName}`);
      throw new CheckoutError('INVALID_DELIVERY_DATE', `Delivery not available on ${dayName} for your area`);
    }

    // Check cutoff time
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (deliveryDateObj <= tomorrow) {
      const cutoffTime = marketConfig.cutoff_time;
      const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
      const todayCutoff = new Date(now);
      todayCutoff.setHours(cutoffHour, cutoffMinute, 0, 0);

      if (now >= todayCutoff) {
        console.warn(`[${requestId}] [CHECKOUT] ⚠️  Cutoff passed for ${deliveryDate}`);
        throw new CheckoutError('CUTOFF_PASSED', `Orders for ${deliveryDate} must be placed before ${cutoffTime}`);
      }
    }
  }

  private async validatePricesAndInventory(cartItems: CartItem[], requestId: string): Promise<{
    subtotal: number;
    insufficientProducts: string[];
  }> {
    let subtotal = 0;
    const insufficientProducts: string[] = [];

    for (const item of cartItems) {
      const product = item.products;
      
      // Validate price matches (prevent tampering)
      if (item.unit_price !== product.price) {
        console.warn(`[${requestId}] [CHECKOUT] ⚠️  Price mismatch for product ${product.id}: cart=$${item.unit_price}, actual=$${product.price}`);
      }

      // Use server-side price
      subtotal += product.price * item.quantity;

      // Check inventory
      if (product.available_quantity < item.quantity) {
        insufficientProducts.push(`${product.name} (available: ${product.available_quantity}, requested: ${item.quantity})`);
      }
    }

    return { subtotal, insufficientProducts };
  }

  private calculateFees(subtotal: number, deliveryFee: number, tipAmount: number, requestId: string) {
    const platformFeeRate = 0.10; // 10%
    const platformFee = subtotal * platformFeeRate;
    const deliveryFeeValue = parseFloat(deliveryFee.toString());
    const totalBeforeCredits = subtotal + platformFee + deliveryFeeValue + tipAmount;

    return { platformFee, deliveryFee: deliveryFeeValue, totalBeforeCredits };
  }

  private async calculateCreditsUsed(
    userId: string,
    useCredits: boolean,
    totalBeforeCredits: number,
    requestId: string
  ): Promise<number> {
    if (!useCredits) return 0;

    // Use atomic function to get current balance (prevents TOCTOU race condition)
    const { data: availableCredits, error } = await this.supabase.rpc('get_available_credits', {
      p_consumer_id: userId
    });

    if (error) {
      console.error(`[${requestId}] [CHECKOUT] Failed to get available credits:`, error);
      throw new CheckoutError('CREDITS_ERROR', `Failed to get available credits: ${error.message}`);
    }

    const creditsUsed = Math.min(availableCredits || 0, totalBeforeCredits);

    console.log(`[${requestId}] [CHECKOUT] Credits: available=$${availableCredits}, using=$${creditsUsed}`);

    return creditsUsed;
  }

  private async processPayment(
    totalAmount: number,
    userId: string,
    userEmail: string,
    deliveryDate: string,
    subtotal: number,
    platformFee: number,
    deliveryFee: number,
    creditsUsed: number,
    paymentMethodId: string | undefined,
    requestOrigin: string,
    requestId: string
  ): Promise<{ paymentIntent: Stripe.PaymentIntent | null; paymentStatus: 'paid' | 'pending' | 'requires_action' }> {
    if (totalAmount <= 0) {
      console.log(`[${requestId}] [CHECKOUT] Order fully covered by credits`);
      return { paymentIntent: null, paymentStatus: 'paid' };
    }

    console.log(`[${requestId}] [CHECKOUT] Processing Stripe payment: $${totalAmount}`);

    // Get or create Stripe customer
    const customers = await this.stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userId)
        .single();

      const customer = await this.stripe.customers.create({
        email: userEmail,
        name: profile?.full_name || undefined,
        phone: profile?.phone || undefined,
        metadata: { supabase_user_id: userId }
      });
      customerId = customer.id;
    }

    // Create payment intent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(totalAmount * 100),
      currency: 'usd',
      customer: customerId,
      metadata: {
        consumer_id: userId,
        delivery_date: deliveryDate,
        subtotal: subtotal.toFixed(2),
        platform_fee: platformFee.toFixed(2),
        delivery_fee: deliveryFee.toFixed(2),
        credits_used: creditsUsed.toFixed(2)
      },
      automatic_payment_methods: { enabled: true },
    };

    if (paymentMethodId) {
      paymentIntentParams.payment_method = paymentMethodId;
      paymentIntentParams.confirm = true;
      paymentIntentParams.return_url = `${requestOrigin}/consumer/order-tracking`;
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);
      console.log(`[${requestId}] [CHECKOUT] Payment intent created: ${paymentIntent.id} (${paymentIntent.status})`);

      const paymentStatus = paymentIntent.status === 'succeeded' 
        ? 'paid' 
        : paymentIntent.status === 'requires_action' 
          ? 'requires_action' 
          : 'pending';

      return { paymentIntent, paymentStatus };
    } catch (error: unknown) {
      const stripeError = error as Stripe.errors.StripeError;
      const message = stripeError?.message || (error instanceof Error ? error.message : 'Unknown payment error');
      console.error(`[${requestId}] [CHECKOUT] ❌ Stripe payment failed:`, message);
      throw new CheckoutError('PAYMENT_FAILED', message, { decline_code: stripeError?.decline_code });
    }
  }

  private async createOrder(
    userId: string,
    deliveryDate: string,
    totalAmount: number,
    tipAmount: number,
    paymentStatus: PaymentStatus,
    paymentIntent: Stripe.PaymentIntent | null,
    cartItems: CartItem[],
    platformFee: number,
    deliveryFee: number,
    creditsUsed: number,
    profile: UserProfile,
    requestId: string,
    isDemoMode: boolean = false
  ): Promise<string> {
    // Create order
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .insert({
        consumer_id: userId,
        delivery_date: deliveryDate,
        total_amount: totalAmount,
        tip_amount: tipAmount,
        status: paymentStatus === 'paid' ? 'confirmed' : 'pending'
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error(`[${requestId}] [CHECKOUT] ❌ Order creation failed:`, orderError);
      
      // Refund if payment succeeded
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.error(`[${requestId}] [CHECKOUT] 🚨 CRITICAL: Payment succeeded but order creation failed. Refunding...`);
        try {
          await this.stripe.refunds.create({ payment_intent: paymentIntent.id });
          console.log(`[${requestId}] [CHECKOUT] Refund initiated`);
        } catch (refundError) {
          console.error(`[${requestId}] [CHECKOUT] ❌ Refund failed:`, refundError);
        }
      }
      
      throw new CheckoutError('CHECKOUT_ERROR', 'Failed to create order');
    }

    // Store payment intent (skip in demo mode)
    if (paymentIntent && !isDemoMode) {
      await this.supabase.from('payment_intents').insert({
        stripe_payment_intent_id: paymentIntent.id,
        order_id: order.id,
        consumer_id: userId,
        amount: totalAmount,
        status: paymentIntent.status,
        payment_method: (paymentIntent.payment_method as string) || null,
        client_secret: paymentIntent.client_secret,
        metadata: paymentIntent.metadata
      });
    }

    // Create order items
    const orderItems = cartItems.map(item => {
      const product = item.products;
      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: product.price * item.quantity
      };
    });

    await this.supabase.from('order_items').insert(orderItems);

    // Fees, payouts, and inventory updates are skipped in demo mode
    if (!isDemoMode) {
      // Create transaction fees
      await this.supabase.from('transaction_fees').insert([
        {
          order_id: order.id,
          fee_type: 'platform',
          amount: platformFee,
          description: 'Platform fee (10%)'
        },
        {
          order_id: order.id,
          fee_type: 'delivery',
          amount: deliveryFee,
          description: 'Delivery fee'
        }
      ]);

      // Create payouts for farmers
      await this.createFarmerPayouts(order.id, cartItems, requestId);

      // Update inventory
      await this.updateInventory(cartItems, requestId);
    }

    // Handle credits redemption
    if (creditsUsed > 0) {
      await this.redeemCredits(userId, order.id, creditsUsed, requestId);
    }

    console.log(`[${requestId}] [CHECKOUT] Order created: ${order.id}`);
    return order.id;
  }

  private async createFarmerPayouts(orderId: string, cartItems: CartItem[], requestId: string): Promise<void> {
    const farmerPayouts = new Map<string, number>();

    for (const item of cartItems) {
      const product = item.products;
      const farmProfile = product.farm_profiles;
      const itemTotal = product.price * item.quantity;
      const farmerShare = itemTotal * 0.85; // 85%
      const leadFarmerShare = itemTotal * 0.05; // 5%

      farmerPayouts.set(farmProfile.farmer_id, (farmerPayouts.get(farmProfile.farmer_id) || 0) + farmerShare);
    }

    const payouts = Array.from(farmerPayouts.entries()).map(([farmerId, amount]) => ({
      order_id: orderId,
      recipient_id: farmerId,
      recipient_type: 'farmer',
      amount,
      description: 'Product sales',
      status: 'pending'
    }));

    if (payouts.length > 0) {
      await this.supabase.from('payouts').insert(payouts);
      console.log(`[${requestId}] [CHECKOUT] Created ${payouts.length} farmer payouts`);
    }
  }

  private async updateInventory(cartItems: CartItem[], requestId: string): Promise<void> {
    // CRITICAL FIX: Use atomic decrement to prevent inventory race conditions
    // Previously: SELECT quantity, then UPDATE quantity - item.quantity (RACE CONDITION!)
    // Now: UPDATE quantity = quantity - N (ATOMIC OPERATION)
    //
    // WHY THIS MATTERS:
    // - Scenario: Product has 10 units. Two customers buy 5 each simultaneously.
    // - OLD BUG: Both read 10, both set to 5, final inventory = 5 (should be 0!)
    // - NEW FIX: Both decrement by 5, final inventory = 0 (correct!)
    //
    // The database handles the subtraction atomically, preventing overselling.
    
    const updatePromises = cartItems.map(async item => {
      const { data, error } = await this.supabase.rpc('decrement_product_quantity', {
        product_id: item.product_id,
        decrement_by: item.quantity
      });
      
      if (error) {
        console.error(`[${requestId}] [CHECKOUT] Failed to update inventory for product ${item.product_id}:`, error);
        throw new CheckoutError('INVENTORY_ERROR', `Failed to update inventory: ${error.message}`);
      }
      
      // Check if the decrement resulted in negative inventory (overselling)
      if (data && data.new_quantity < 0) {
        console.error(`[${requestId}] [CHECKOUT] Overselling detected for product ${item.product_id}: new_quantity=${data.new_quantity}`);
        throw new CheckoutError('INSUFFICIENT_INVENTORY', `Product ${item.product_id} is out of stock`);
      }
      
      return data;
    });
    
    await Promise.all(updatePromises);
    console.log(`[${requestId}] [CHECKOUT] ✅ Atomically updated inventory for ${cartItems.length} products`);
  }

  private async redeemCredits(userId: string, orderId: string, creditsUsed: number, requestId: string): Promise<void> {
    // CRITICAL FIX: Use atomic redemption to prevent credits race condition
    // Previously: SELECT balance, then INSERT (RACE CONDITION!)
    // Now: Atomic function that validates and updates in single transaction
    //
    // WHY THIS MATTERS:
    // - Scenario: User has $50 credits. Places two $30 orders simultaneously.
    // - OLD BUG: Both read $50, both insert balance=$20, user spent $60 but only $30 deducted!
    // - NEW FIX: Atomic function ensures only one can succeed, other gets INSUFFICIENT_CREDITS error

    const { data, error } = await this.supabase.rpc('redeem_credits_atomic', {
      p_consumer_id: userId,
      p_order_id: orderId,
      p_credits_to_redeem: creditsUsed,
      p_description: 'Credits redeemed for order'
    });

    if (error) {
      // Check if it's an insufficient credits error (race condition detected!)
      if (error.code === '23514' || error.message?.includes('Insufficient credits')) {
        console.error(`[${requestId}] [CHECKOUT] ❌ Insufficient credits (race condition caught): ${error.message}`);
        throw new CheckoutError('INSUFFICIENT_CREDITS', `Insufficient credits available: ${error.message}`);
      }

      console.error(`[${requestId}] [CHECKOUT] Failed to redeem credits:`, error);
      throw new CheckoutError('CREDITS_ERROR', `Failed to redeem credits: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new CheckoutError('CREDITS_ERROR', 'Credit redemption returned no data');
    }

    const { new_balance, old_balance } = data[0];
    console.log(`[${requestId}] [CHECKOUT] ✅ Credits redeemed atomically: $${creditsUsed} (balance: $${old_balance} → $${new_balance})`);
  }

  private async clearCart(cartId: string, requestId: string): Promise<void> {
    await this.supabase.from('cart_items').delete().eq('cart_id', cartId);
    console.log(`[${requestId}] [CHECKOUT] Cart cleared: ${cartId}`);
  }

  private async sendOrderConfirmation(orderId: string, requestId: string): Promise<void> {
    try {
      await this.supabase.functions.invoke('send-notification', {
        body: {
          type: 'order_confirmation',
          order_id: orderId
        }
      });
      console.log(`[${requestId}] [CHECKOUT] Order confirmation sent for ${orderId}`);
    } catch (error) {
      console.warn(`[${requestId}] [CHECKOUT] ⚠️  Failed to send notification:`, error);
    }
  }
}

export class CheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}
