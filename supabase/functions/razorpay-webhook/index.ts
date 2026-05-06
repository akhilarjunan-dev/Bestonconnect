import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// Use webhook secret for signature verification (more secure than key secret)
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

// In-memory cache for processed events (to handle retries within same function instance)
const processedEvents = new Set<string>();
const MAX_CACHE_SIZE = 1000;

// Verify Razorpay webhook signature using the webhook secret
async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(RAZORPAY_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    );
    
    const generatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return generatedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Check if this event has already been processed (idempotency)
async function isEventProcessed(supabase: any, eventId: string): Promise<boolean> {
  // First check in-memory cache
  if (processedEvents.has(eventId)) {
    console.log('Event already processed (in-memory cache):', eventId);
    return true;
  }

  // Check webhook_events table for persistent idempotency
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existingEvent) {
    console.log('Event already processed (webhook_events table):', eventId);
    processedEvents.add(eventId); // Add to cache for faster subsequent checks
    return true;
  }

  // Also check orders table as fallback
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .or(`payment_id.eq.${eventId},order_id.eq.${eventId}`)
    .limit(1)
    .maybeSingle();

  if (existingOrder) {
    console.log('Event already processed (orders table check):', eventId);
    return true;
  }

  return false;
}

// Record webhook event in database for auditing and idempotency
async function recordWebhookEvent(
  supabase: any, 
  eventId: string, 
  eventType: string, 
  payload: any, 
  status: 'processed' | 'failed' = 'processed',
  errorMessage?: string
) {
  try {
    const { error } = await supabase
      .from('webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: payload,
        status: status,
        error_message: errorMessage || null
      });

    if (error) {
      console.error('Error recording webhook event:', error);
    } else {
      console.log('Webhook event recorded:', eventId, eventType, status);
    }

    // Add to in-memory cache
    if (processedEvents.size >= MAX_CACHE_SIZE) {
      const entries = Array.from(processedEvents);
      entries.slice(0, MAX_CACHE_SIZE / 2).forEach(e => processedEvents.delete(e));
    }
    processedEvents.add(eventId);
  } catch (err) {
    console.error('Failed to record webhook event:', err);
  }
}

// Send notification to buyer about order confirmation
async function sendBuyerOrderNotification(supabase: any, userId: string | null, buyerEmail: string, productName: string, orderId: string, isDigital: boolean) {
  if (!userId) {
    // For guest checkout, we can't send in-app notifications
    console.log('Guest order - skipping in-app notification for:', buyerEmail);
    return;
  }

  const statusMessage = isDigital 
    ? 'Your digital product is ready for download!'
    : 'Your order has been confirmed and will be shipped soon.';

  await supabase.from('notifications').insert({
    user_id: userId,
    title: '✅ Order Confirmed!',
    message: `Your order for "${productName}" has been confirmed. ${statusMessage}`,
    type: 'success',
    metadata: { order_id: orderId, product_name: productName, is_digital: isDigital }
  });

  console.log('Order notification sent to user:', userId);
}

// Helper function to get daily sales tier based on promoter's daily sales count
async function getDailySalesTier(supabase: any, promoterId: string): Promise<{
  tierName: string;
  minSales: number;
  maxSales: number | null;
  commissionPercent: number;
  dailySalesCount: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  
  const { count: dailySalesCount, error: countError } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('promoter_id', promoterId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lte('created_at', `${today}T23:59:59.999Z`);

  if (countError) {
    console.error('Error counting daily sales:', countError);
  }

  const salesCountIncludingThis = (dailySalesCount || 0) + 1;
  console.log(`Promoter ${promoterId} daily sales count (including this): ${salesCountIncludingThis}`);

  const { data: tiers, error: tierError } = await supabase
    .from('daily_sales_tiers')
    .select('*')
    .eq('is_active', true)
    .lte('min_sales', salesCountIncludingThis)
    .order('min_sales', { ascending: false });

  if (tierError) {
    console.error('Error fetching daily sales tiers:', tierError);
  }

  let applicableTier = null;
  for (const tier of (tiers || [])) {
    if (tier.max_sales === null || salesCountIncludingThis <= tier.max_sales) {
      applicableTier = tier;
      break;
    }
  }

  if (!applicableTier) {
    const { data: defaultTier } = await supabase
      .from('daily_sales_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_sales', { ascending: true })
      .limit(1)
      .single();
    
    applicableTier = defaultTier || {
      tier_name: 'Tier 1',
      min_sales: 1,
      max_sales: 5,
      commission_percent: 10
    };
  }

  console.log(`Applicable tier for ${salesCountIncludingThis} sales:`, applicableTier.tier_name, `(${applicableTier.commission_percent}%)`);

  return {
    tierName: applicableTier.tier_name,
    minSales: applicableTier.min_sales,
    maxSales: applicableTier.max_sales,
    commissionPercent: Number(applicableTier.commission_percent),
    dailySalesCount: salesCountIncludingThis
  };
}

serve(async (req) => {
  // Only accept POST for webhooks
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      console.error('Missing webhook signature');
      return new Response('Missing signature', { status: 401 });
    }

    // Verify the webhook signature using webhook secret
    const isValid = await verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.error('Invalid webhook signature - ensure RAZORPAY_WEBHOOK_SECRET is correctly configured');
      return new Response('Invalid signature', { status: 401 });
    }

    console.log('Webhook signature verified successfully using webhook secret');

    const payload = JSON.parse(body);
    const event = payload.event;
    const eventId = payload.payload?.payment?.entity?.id || payload.payload?.order?.entity?.id;
    const paymentEntity = payload.payload?.payment?.entity;

    console.log('Received Razorpay webhook event:', event, 'Event ID:', eventId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency check - skip if already processed
    if (eventId && await isEventProcessed(supabase, eventId)) {
      console.log('Skipping duplicate webhook event:', eventId);
      return new Response(JSON.stringify({ received: true, status: 'already_processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle payment.captured event (successful payment)
    if (event === 'payment.captured') {
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount / 100; // Convert from paise
      const notes = paymentEntity?.notes || {};

      console.log('Payment captured:', { orderId, paymentId, amount, notes });

      // Check if this is a subscription payment
      if (notes.subscription_type === 'premium_promoter') {
        await handleSubscriptionPayment(supabase, paymentEntity, notes);
      } else {
        // Handle regular order payment
        await handleOrderPayment(supabase, paymentEntity, notes);
      }

      // Record event as processed in webhook_events table
      if (eventId) {
        await recordWebhookEvent(supabase, eventId, event, payload, 'processed');
      }
    }

    // Handle payment.failed event
    if (event === 'payment.failed') {
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const errorReason = paymentEntity?.error_reason || 'Unknown error';

      console.log('Payment failed:', { orderId, paymentId, errorReason });

      // Update any pending orders with this order_id to failed status
      await supabase
        .from('orders')
        .update({ status: 'payment_failed', cancellation_reason: errorReason })
        .eq('order_id', orderId)
        .eq('status', 'pending_payment');

      // Record failed payment event
      if (eventId) {
        await recordWebhookEvent(supabase, eventId, event, payload, 'processed', errorReason);
      }
    }

    // Handle order.paid event
    if (event === 'order.paid') {
      const orderEntity = payload.payload?.order?.entity;
      const orderId = orderEntity?.id;
      const notes = orderEntity?.notes || {};

      console.log('Order paid:', { orderId, notes });

      // Check for any pending_payment orders and update them
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .eq('status', 'pending_payment');

      if (pendingOrders && pendingOrders.length > 0) {
        for (const order of pendingOrders) {
          await supabase
            .from('orders')
            .update({ 
              status: order.is_digital ? 'delivered' : 'pending',
              delivered_at: order.is_digital ? new Date().toISOString() : null
            })
            .eq('id', order.id);
          
          console.log('Updated order status:', order.id);
        }
      }

      // Record event
      if (orderId) {
        await recordWebhookEvent(supabase, orderId, event, payload, 'processed');
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook processing error:', errorMessage);
    
    // Return 200 to acknowledge receipt (avoid Razorpay retries for processing errors)
    return new Response(JSON.stringify({ error: errorMessage, received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Handle subscription payment from webhook
async function handleSubscriptionPayment(supabase: any, paymentEntity: any, notes: any) {
  const userId = notes.user_id;
  const planType = notes.plan_type || 'monthly';
  const paymentId = paymentEntity.id;
  const orderId = paymentEntity.order_id;
  const amount = paymentEntity.amount / 100;

  console.log('Processing subscription payment via webhook:', { userId, planType, paymentId });

  // Check if subscription already exists for this payment
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();

  if (existingSub) {
    console.log('Subscription already exists for this payment:', existingSub.id);
    return;
  }

  // Calculate expiry
  const durationDays = planType === 'annual' ? 365 : 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  // Create subscription record
  const { data: subscriptionData, error: subError } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_type: planType,
      status: 'active',
      auto_renew: false,
      amount,
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      expires_at: expiresAt.toISOString(),
      next_billing_date: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (subError) {
    console.error('Failed to create subscription via webhook:', subError);
    return;
  }

  console.log('Subscription created via webhook:', subscriptionData.id);

  // Update user profile to premium tier
  await supabase
    .from('profiles')
    .update({ promoter_tier: 'premium' })
    .eq('id', userId);

  // Handle promoter application and role
  const { data: existingApp } = await supabase
    .from('promoter_applications')
    .select('id, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingApp) {
    await supabase
      .from('promoter_applications')
      .update({ 
        tier: 'premium',
        status: 'approved',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', existingApp.id);
  } else {
    await supabase
      .from('promoter_applications')
      .insert({
        user_id: userId,
        tier: 'premium',
        status: 'approved',
        reviewed_at: new Date().toISOString()
      });
  }

  // Add promoter role
  await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'promoter' }, { onConflict: 'user_id,role' });

  // Handle referral commission if referral code was used
  const referralCode = notes.referral_code;
  if (referralCode) {
    await handleReferralCommission(supabase, userId, referralCode, amount, subscriptionData.id);
  }

  // Send notification to user
  await supabase.from('notifications').insert({
    user_id: userId,
    title: '🎉 Premium Subscription Activated!',
    message: `Your premium subscription is now active. Enjoy ${planType === 'annual' ? 'a year' : 'a month'} of premium benefits!`,
    type: 'success',
  });

  console.log('Subscription payment processed successfully via webhook');
}

// Handle regular order payment from webhook
async function handleOrderPayment(supabase: any, paymentEntity: any, notes: any) {
  const paymentId = paymentEntity.id;
  const orderId = paymentEntity.order_id;
  const buyerEmail = notes.buyer_email;
  const userId = notes.user_id || null;

  console.log('Processing order payment via webhook:', { orderId, paymentId, buyerEmail, userId });

  // Check if orders already exist for this payment
  const { data: existingOrders, error: checkError } = await supabase
    .from('orders')
    .select('id, product_id, is_digital')
    .eq('payment_id', paymentId);

  if (existingOrders && existingOrders.length > 0) {
    console.log('Orders already exist for this payment, updating status');
    
    // Update all orders with this payment_id to confirmed status
    for (const order of existingOrders) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('is_digital, status, product_id')
        .eq('id', order.id)
        .single();

      if (orderData && orderData.status === 'pending_payment') {
        await supabase
          .from('orders')
          .update({ 
            status: orderData.is_digital ? 'delivered' : 'pending',
            delivered_at: orderData.is_digital ? new Date().toISOString() : null
          })
          .eq('id', order.id);

        // Send notification to buyer
        if (userId) {
          const { data: product } = await supabase
            .from('products')
            .select('name')
            .eq('id', orderData.product_id)
            .single();
          
          await sendBuyerOrderNotification(supabase, userId, buyerEmail, product?.name || 'Product', order.id, orderData.is_digital);
        }
      }
    }
    return;
  }

  // If no orders exist, check if we have cart data in notes
  const cartData = notes.cart_data;
  if (cartData) {
    try {
      const items = typeof cartData === 'string' ? JSON.parse(cartData) : cartData;
      const createdOrderIds: string[] = [];
      
      for (const item of items) {
        // Create order
        const { data: orderRecord, error: orderError } = await supabase
          .from('orders')
          .insert({
            product_id: item.product_id,
            buyer_email: buyerEmail,
            buyer_name: notes.buyer_name || null,
            user_id: userId || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.total_amount,
            delivery_address: item.delivery_address || null,
            is_digital: item.is_digital,
            status: item.is_digital ? 'delivered' : 'pending',
            payment_id: paymentId,
            order_id: orderId,
            promoter_id: item.promoter_id || null,
            referral_link_id: item.referral_link_id || null,
            delivered_at: item.is_digital ? new Date().toISOString() : null
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order via webhook:', orderError);
          continue;
        }

        console.log('Order created via webhook:', orderRecord.id);
        
        // Track physical orders for Delhivery auto-shipment
        if (!item.is_digital) {
          createdOrderIds.push(orderRecord.id);
        }

        // Fetch product name for notification
        const { data: product } = await supabase
          .from('products')
          .select('name, vendor_id, commission_rate, price, promoter_code_discount, platform_commission')
          .eq('id', item.product_id)
          .single();

        // Send notification to buyer about successful order
        const productName = product?.name || item.product_name || 'Product';
        await sendBuyerOrderNotification(supabase, userId, buyerEmail, productName, orderRecord.id, item.is_digital);

        // Send order placed email to admin, manager, and vendor
        await sendOrderPlacedAlert(supabase, {
          order_id: orderRecord.id,
          product_name: productName,
          buyer_name: notes.buyer_name || null,
          buyer_email: buyerEmail,
          quantity: item.quantity,
          total_amount: item.total_amount,
          payment_method: 'Razorpay',
          vendor_id: item.vendor_id || product?.vendor_id || null,
        });

        // Process promoter sale if applicable
        if (item.promoter_id) {
          await processPromoterSale(supabase, item, orderRecord.id, paymentId);
        } else if (product?.vendor_id) {
          // No promoter — deduct all commissions from product price for vendor earning
          const productPrice = Number(product.price) * item.quantity;
          const shopperDiscountRate = Number(product.promoter_code_discount || 0);
          const promoterCommissionRate = Number(product.commission_rate || 0);
          const platformCommissionRate = Number(product.platform_commission || 0);
          const totalDeductionRate = shopperDiscountRate + promoterCommissionRate + platformCommissionRate;
          const totalDeduction = (totalDeductionRate / 100) * productPrice;
          const vendorNet = productPrice - totalDeduction;
          
          await supabase
            .from('vendor_earnings')
            .insert({
              vendor_id: product.vendor_id,
              order_id: orderRecord.id,
              product_id: item.product_id,
              total_amount: productPrice,
              commission_deducted: totalDeduction,
              net_earning: Math.max(0, vendorNet),
              status: item.is_digital ? 'completed' : 'pending'
            });
          console.log('Vendor earning created (no promoter) for vendor:', product.vendor_id, 'Net:', vendorNet);
        }
      }
      
      // Auto-create Delhivery shipments for physical orders if enabled
      if (createdOrderIds.length > 0) {
        await autoCreateDelhiveryShipments(supabase, createdOrderIds);
      }
      
    } catch (parseError) {
      console.error('Error parsing cart data:', parseError);
    }
  }

  console.log('Order payment processed via webhook');
}

// Auto-create Delhivery shipments for physical orders
async function autoCreateDelhiveryShipments(supabase: any, orderIds: string[]) {
  try {
    // Check if auto-create is enabled
    const { data: autoCreateSetting } = await supabase
      .from('delhivery_settings')
      .select('setting_value')
      .eq('setting_key', 'auto_create_shipment')
      .maybeSingle();

    const isAutoCreateEnabled = autoCreateSetting?.setting_value?.enabled === true;
    
    if (!isAutoCreateEnabled) {
      console.log('Auto-create Delhivery shipments is disabled');
      return;
    }

    console.log('Auto-creating Delhivery shipments for orders:', orderIds);

    // Get Delhivery API credentials
    const DELHIVERY_API_KEY = Deno.env.get('DELHIVERY_API_KEY');
    const DELHIVERY_CLIENT_NAME = Deno.env.get('DELHIVERY_CLIENT_NAME');

    if (!DELHIVERY_API_KEY || !DELHIVERY_CLIENT_NAME) {
      console.log('Delhivery API credentials not configured');
      return;
    }

    // Get API mode setting
    const { data: modeSetting } = await supabase
      .from('delhivery_settings')
      .select('setting_value')
      .eq('setting_key', 'api_mode')
      .maybeSingle();

    const isProduction = modeSetting?.setting_value?.mode === 'production';
    const baseUrl = isProduction 
      ? 'https://track.delhivery.com' 
      : 'https://staging-express.delhivery.com';

    // Get default pickup location
    const { data: pickupSetting } = await supabase
      .from('delhivery_settings')
      .select('setting_value')
      .eq('setting_key', 'default_pickup_location')
      .maybeSingle();

    const defaultPickup = pickupSetting?.setting_value;

    // Process each order
    for (const orderId of orderIds) {
      try {
        // Get order details
        const { data: order } = await supabase
          .from('orders')
          .select(`
            *,
            products:product_id (
              name,
              vendor_id,
              weight_grams
            )
          `)
          .eq('id', orderId)
          .single();

        if (!order || !order.delivery_address) {
          console.log(`Skipping order ${orderId} - no delivery address`);
          continue;
        }

        // Already has waybill
        if (order.delhivery_waybill) {
          console.log(`Order ${orderId} already has waybill: ${order.delhivery_waybill}`);
          continue;
        }

        // Get pickup address - try vendor profile first, then default
        let pickupAddress = defaultPickup;
        let warehouseName = DELHIVERY_CLIENT_NAME;
        
        if (order.products?.vendor_id) {
          const { data: vendorProfile } = await supabase
            .from('vendor_profiles')
            .select('*')
            .eq('user_id', order.products.vendor_id)
            .maybeSingle();

          if (vendorProfile) {
            pickupAddress = {
              name: vendorProfile.business_name,
              phone: vendorProfile.pickup_phone,
              address: vendorProfile.pickup_address,
              city: vendorProfile.pickup_city,
              state: vendorProfile.pickup_state,
              pincode: vendorProfile.pickup_pincode
            };
            warehouseName = vendorProfile.business_name.trim().substring(0, 50);
          }
        }

        if (!pickupAddress) {
          console.log(`No pickup address for order ${orderId}`);
          continue;
        }

        // Register warehouse in Delhivery (idempotent)
        try {
          const whResponse = await fetch(`${baseUrl}/api/backend/clientwarehouse/create/`, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${DELHIVERY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: warehouseName,
              phone: pickupAddress.phone,
              city: pickupAddress.city,
              pin: pickupAddress.pincode,
              address: pickupAddress.address,
              country: 'India',
              state: pickupAddress.state,
              registered_name: pickupAddress.name,
              return_address: pickupAddress.address,
              return_pin: pickupAddress.pincode,
              return_city: pickupAddress.city,
              return_state: pickupAddress.state,
              return_country: 'India',
              return_phone: pickupAddress.phone,
            }),
          });
          const whResult = await whResponse.json();
          console.log(`Warehouse registration for ${warehouseName}:`, whResult);
        } catch (whErr) {
          console.error(`Warehouse registration error (non-blocking):`, whErr);
        }

        const deliveryAddr = order.delivery_address;

        // Get product weight
        const productWeight = order.products?.weight_grams || 500;
        const totalWeight = productWeight * (order.quantity || 1);

        // Create shipment request
        const shipmentData = {
          shipments: [{
            name: deliveryAddr.name,
            add: deliveryAddr.address,
            city: deliveryAddr.city,
            state: deliveryAddr.state,
            pin: deliveryAddr.pincode,
            phone: deliveryAddr.phone,
            order: orderId.substring(0, 25),
            payment_mode: 'Prepaid',
            cod_amount: 0,
            weight: totalWeight.toString(),
            shipment_width: '10',
            shipment_height: '10',
            shipment_length: '10',
            seller_name: pickupAddress.name,
            seller_add: pickupAddress.address,
            seller_city: pickupAddress.city,
            seller_state: pickupAddress.state,
            seller_pin: pickupAddress.pincode,
            seller_phone: pickupAddress.phone,
            quantity: order.quantity.toString(),
            product_desc: order.products?.name || 'Product'
          }],
          pickup_location: {
            name: warehouseName,
            add: pickupAddress.address,
            city: pickupAddress.city,
            pin: pickupAddress.pincode,
            phone: pickupAddress.phone
          }
        };

        // Call Delhivery API - MUST use form-urlencoded format
        const formBody = `format=json&data=${encodeURIComponent(JSON.stringify(shipmentData))}`;
        const response = await fetch(`${baseUrl}/api/cmu/create.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHIVERY_API_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody
        });

        const result = await response.json();
        console.log(`Delhivery response for order ${orderId}:`, result);

        if (result.packages && result.packages.length > 0) {
          const pkg = result.packages[0];
          
          if (pkg.waybill) {
            // Update order with waybill
            await supabase
              .from('orders')
              .update({
                delhivery_waybill: pkg.waybill,
                delhivery_order_id: pkg.refnum || null,
                delhivery_status: 'Manifested',
                status: 'processing',
                shipping_created_at: new Date().toISOString(),
                tracking_info: {
                  carrier: 'Delhivery',
                  tracking_number: pkg.waybill,
                  url: `https://www.delhivery.com/track/package/${pkg.waybill}`
                }
              })
              .eq('id', orderId);

            console.log(`Shipment created for order ${orderId}: ${pkg.waybill}`);
          } else if (pkg.remarks) {
            console.error(`Delhivery error for order ${orderId}:`, pkg.remarks);
          }
        }

      } catch (orderError) {
        console.error(`Error creating shipment for order ${orderId}:`, orderError);
      }
    }

  } catch (error) {
    console.error('Error in autoCreateDelhiveryShipments:', error);
  }
}

// Process promoter sale from webhook
async function processPromoterSale(supabase: any, item: any, orderId: string, paymentId: string) {
  const promoterId = item.promoter_id;

  // Get daily sales tier
  const tierInfo = await getDailySalesTier(supabase, promoterId);
  
  const baseCommission = item.total_amount * (item.commission_rate / 100);
  const finalCommission = baseCommission * (tierInfo.commissionPercent / 100);

  console.log(`Webhook commission calculation: Base ₹${baseCommission} x ${tierInfo.commissionPercent}% (${tierInfo.tierName}) = ₹${finalCommission}`);

  // Check and deduct stock
  const { data: product } = await supabase
    .from('products')
    .select('stock_quantity, is_digital, vendor_id, price, promoter_code_discount, commission_rate, platform_commission')
    .eq('id', item.product_id)
    .single();

  if (product && !product.is_digital && product.stock_quantity !== null) {
    const newStock = Math.max(0, product.stock_quantity - item.quantity);
    await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', item.product_id);
  }

  // Create sale record
  const { data: saleRecord, error: saleError } = await supabase
    .from('sales')
    .insert({
      referral_link_id: item.referral_link_id,
      product_id: item.product_id,
      promoter_id: promoterId,
      buyer_email: item.buyer_email,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.total_amount,
      commission_rate: item.commission_rate,
      commission_amount: baseCommission,
      status: 'completed'
    })
    .select()
    .single();

  if (saleError) {
    console.error('Error creating sale via webhook:', saleError);
    return;
  }

  // Fetch return period settings
  const { data: returnSettings } = await supabase
    .from('referral_commission_settings')
    .select('setting_value')
    .eq('setting_key', 'return_period_days')
    .single();

  const returnPeriod = returnSettings?.setting_value as { digital: number; physical: number } || { digital: 0, physical: 7 };
  const isDigitalProduct = item.is_digital || product?.is_digital || false;
  const returnDays = isDigitalProduct ? returnPeriod.digital : returnPeriod.physical;

  const returnWindowEnds = new Date();
  returnWindowEnds.setDate(returnWindowEnds.getDate() + returnDays);

  // Create earning record for the promoter with tier-based commission
  const earningStatus = isDigitalProduct ? 'approved' : 'pending';
  
  const { error: earningError } = await supabase
    .from('earnings')
    .insert({
      promoter_id: promoterId,
      base_amount: baseCommission,
      amount: finalCommission,
      sale_date: new Date().toISOString().split('T')[0],
      status: earningStatus,
      return_window_ends_at: returnWindowEnds.toISOString(),
      earning_type: 'direct_sale',
      formula_breakdown: {
        sale_id: saleRecord.id,
        product_id: item.product_id,
        unit_price: item.unit_price,
        quantity: item.quantity,
        commission_rate: item.commission_rate,
        base_commission: baseCommission,
        promoter_daily_sales_count: tierInfo.dailySalesCount,
        tier_name: tierInfo.tierName,
        tier_commission_percent: tierInfo.commissionPercent,
        final_commission: finalCommission,
        source: 'webhook'
      }
    });

  if (earningError) {
    console.error('Error creating earning via webhook:', earningError);
  } else {
    console.log('Earning created via webhook for promoter:', promoterId, 'Final:', finalCommission);
  }

  // Create vendor earning if product has a vendor
  if (product?.vendor_id) {
    const productPrice = Number(product.price) * item.quantity;
    const shopperDiscountRate = Number(product.promoter_code_discount || 0);
    const promoterCommissionRate = Number(product.commission_rate || 0);
    const platformCommissionRate = Number(product.platform_commission || 0);
    const totalDeductionRate = shopperDiscountRate + promoterCommissionRate + platformCommissionRate;
    const totalDeduction = (totalDeductionRate / 100) * productPrice;
    const vendorNetEarning = productPrice - totalDeduction;
    
    await supabase
      .from('vendor_earnings')
      .insert({
        vendor_id: product.vendor_id,
        order_id: orderId,
        product_id: item.product_id,
        total_amount: productPrice,
        commission_deducted: totalDeduction,
        net_earning: Math.max(0, vendorNetEarning),
        status: (item.is_digital || product.is_digital) ? 'completed' : 'pending'
      });
    console.log('Vendor earning created via webhook for vendor:', product.vendor_id, 'Net:', vendorNetEarning);
  }

  console.log('Sale and earning created via webhook for promoter:', promoterId);

  // Handle referrer commission
  const { data: referralData } = await supabase
    .from('promoter_referrals')
    .select('referrer_promoter_id')
    .eq('referred_promoter_id', promoterId)
    .maybeSingle();

  if (referralData) {
    const { data: refSettings } = await supabase
      .from('referral_commission_settings')
      .select('setting_value')
      .eq('setting_key', 'sales_referral_percent')
      .single();

    const refPercent = (refSettings?.setting_value as { percent: number })?.percent || 5;
    const refCommission = finalCommission * (refPercent / 100);
    
    // Referral earnings are auto-approved since they're tied to the original sale
    const referralEarningStatus = isDigitalProduct ? 'approved' : 'approved';

    await supabase
      .from('earnings')
      .insert({
        promoter_id: referralData.referrer_promoter_id,
        base_amount: refCommission,
        amount: refCommission,
        sale_date: new Date().toISOString().split('T')[0],
        status: referralEarningStatus,
        return_window_ends_at: returnWindowEnds.toISOString(),
        earning_type: 'sales_referral',
        referral_source_promoter_id: promoterId,
        formula_breakdown: {
          source_sale_id: saleRecord.id,
          referred_promoter_id: promoterId,
          original_commission: finalCommission,
          referral_percent: refPercent,
          source: 'webhook'
        }
      });

    console.log('Referral commission credited via webhook to:', referralData.referrer_promoter_id);
  }
}

// Handle referral commission for subscription
async function handleReferralCommission(supabase: any, userId: string, referralCode: string, amount: number, subscriptionId: string) {
  const cleanedCode = referralCode.trim().toUpperCase();
  
  const { data: referralLink } = await supabase
    .from('referral_links')
    .select('promoter_id')
    .ilike('link_code', cleanedCode)
    .maybeSingle();

  if (!referralLink) {
    console.log('No referrer found for code:', referralCode);
    return;
  }

  const referrerPromoterId = referralLink.promoter_id;

  // Create referral relationship
  await supabase
    .from('promoter_referrals')
    .insert({
      referred_promoter_id: userId,
      referrer_promoter_id: referrerPromoterId,
      referral_code: cleanedCode,
      tier_at_referral: 'premium',
      current_tier: 'premium'
    });

  // Get referral commission percentage
  const { data: refSettings } = await supabase
    .from('referral_commission_settings')
    .select('setting_value')
    .eq('setting_key', 'subscription_referral_percent')
    .single();

  const refPercent = (refSettings?.setting_value as { percent: number })?.percent || 10;
  const refCommission = amount * (refPercent / 100);

  // Create earning for referrer
  await supabase
    .from('earnings')
    .insert({
      promoter_id: referrerPromoterId,
      base_amount: refCommission,
      amount: refCommission,
      sale_date: new Date().toISOString().split('T')[0],
      status: 'approved',
      earning_type: 'subscription_referral',
      referral_source_promoter_id: userId,
      referral_source_subscription_id: subscriptionId,
      formula_breakdown: {
        type: 'subscription_referral',
        referred_user_id: userId,
        subscription_amount: amount,
        referral_percent: refPercent,
        source: 'webhook'
      }
    });

  console.log('Referral commission credited via webhook to:', referrerPromoterId);
}

// Send order placed email alert to admin, manager, and vendor
async function sendOrderPlacedAlert(supabase: any, orderInfo: {
  order_id: string;
  product_name: string;
  buyer_name: string | null;
  buyer_email: string;
  quantity: number;
  total_amount: number;
  payment_method: string;
  vendor_id: string | null;
}) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        type: 'order_placed_alert',
        data: orderInfo,
      }),
    });

    const result = await response.json();
    console.log('Order placed alert response:', result);
  } catch (error) {
    console.error('Failed to send order placed alert (non-blocking):', error);
  }
}
