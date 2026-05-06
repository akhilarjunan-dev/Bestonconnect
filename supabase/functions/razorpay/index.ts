import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Live keys (default)
const RAZORPAY_KEY_ID_LIVE = Deno.env.get('RAZORPAY_KEY_ID')!
const RAZORPAY_KEY_SECRET_LIVE = Deno.env.get('RAZORPAY_KEY_SECRET')!

// Test keys (optional)
const RAZORPAY_KEY_ID_TEST = Deno.env.get('RAZORPAY_KEY_ID_TEST') || RAZORPAY_KEY_ID_LIVE
const RAZORPAY_KEY_SECRET_TEST = Deno.env.get('RAZORPAY_KEY_SECRET_TEST') || RAZORPAY_KEY_SECRET_LIVE

// Helper to get the correct keys based on test mode setting
async function getRazorpayKeys(): Promise<{ keyId: string; keySecret: string; isTestMode: boolean }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Check if test mode is enabled in settings
  const { data: setting } = await supabase
    .from('subscription_settings')
    .select('setting_value')
    .eq('setting_key', 'razorpay_test_mode')
    .maybeSingle()
  
  const isTestMode = !!(setting?.setting_value as { enabled?: boolean })?.enabled
  
  console.log(`Razorpay mode: ${isTestMode ? 'TEST' : 'LIVE'}`)
  
  if (isTestMode) {
    return {
      keyId: RAZORPAY_KEY_ID_TEST,
      keySecret: RAZORPAY_KEY_SECRET_TEST,
      isTestMode: true
    }
  }
  
  return {
    keyId: RAZORPAY_KEY_ID_LIVE,
    keySecret: RAZORPAY_KEY_SECRET_LIVE,
    isTestMode: false
  }
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );
  
  const hexArray = encodeHex(new Uint8Array(signatureBuffer));
  const generatedSignature = new TextDecoder().decode(hexArray);
  return generatedSignature === signature;
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
  
  // Count promoter's sales today (before this sale)
  const { count: dailySalesCount, error: countError } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('promoter_id', promoterId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lte('created_at', `${today}T23:59:59.999Z`);

  if (countError) {
    console.error('Error counting daily sales:', countError);
  }

  // Include this sale in the count
  const salesCountIncludingThis = (dailySalesCount || 0) + 1;
  console.log(`Promoter ${promoterId} daily sales count (including this): ${salesCountIncludingThis}`);

  // Get applicable tier based on sales count
  const { data: tiers, error: tierError } = await supabase
    .from('daily_sales_tiers')
    .select('*')
    .eq('is_active', true)
    .lte('min_sales', salesCountIncludingThis)
    .order('min_sales', { ascending: false });

  if (tierError) {
    console.error('Error fetching daily sales tiers:', tierError);
  }

  // Find the tier where sales count is within range
  let applicableTier = null;
  for (const tier of (tiers || [])) {
    if (tier.max_sales === null || salesCountIncludingThis <= tier.max_sales) {
      applicableTier = tier;
      break;
    }
  }

  // Default tier if none found
  if (!applicableTier) {
    // Get the first tier as default
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, ...data } = await req.json()

    if (action === 'create_order') {
      const { amount, currency = 'INR', receipt, notes } = data

      console.log('Creating Razorpay order:', { amount, currency, receipt })

      // Get the correct keys based on test mode setting
      const { keyId, keySecret, isTestMode } = await getRazorpayKeys()
      
      const auth = btoa(`${keyId}:${keySecret}`)
      
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency,
          receipt,
          notes,
        }),
      })

      const order = await response.json()
      
      if (!response.ok) {
        console.error('Razorpay order creation failed:', order)
        throw new Error(order.error?.description || 'Failed to create order')
      }

      console.log('Razorpay order created:', order.id, isTestMode ? '(TEST MODE)' : '(LIVE)')

      return new Response(
        JSON.stringify({ 
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: keyId,
          test_mode: isTestMode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'verify_payment') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, sale_data, order_data } = data

      console.log('Verifying payment:', { razorpay_order_id, razorpay_payment_id })

      // Get the correct keys for verification
      const { keySecret } = await getRazorpayKeys()
      
      const body = razorpay_order_id + "|" + razorpay_payment_id
      const isValid = await verifySignature(body, razorpay_signature, keySecret)

      if (!isValid) {
        console.error('Signature verification failed')
        return new Response(
          JSON.stringify({ error: 'Invalid payment signature', verified: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Payment verified successfully')

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Create order record first (always, even without promoter code)
      if (order_data) {
        // Normalize buyer_email to lowercase for consistent matching
        const normalizedBuyerEmail = order_data.buyer_email?.toLowerCase()?.trim() || '';
        
        console.log('Creating order record:', { ...order_data, buyer_email: normalizedBuyerEmail })
        const { data: orderRecord, error: orderError } = await supabase
          .from('orders')
          .insert({
            product_id: order_data.product_id,
            buyer_email: normalizedBuyerEmail,
            buyer_name: order_data.buyer_name || null,
            user_id: order_data.user_id || null,
            quantity: order_data.quantity,
            unit_price: order_data.unit_price,
            total_amount: order_data.total_amount,
            delivery_address: order_data.delivery_address || null,
            is_digital: order_data.is_digital,
            status: order_data.is_digital ? 'delivered' : 'pending',
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            promoter_id: order_data.promoter_id || null,
            referral_link_id: order_data.referral_link_id || null,
            delivered_at: order_data.is_digital ? new Date().toISOString() : null
          })
          .select()
          .single()

        if (orderError) {
          console.error('Error creating order:', orderError)
          // Don't throw here, continue with the rest but log the error
        } else {
          console.log('Order created successfully:', orderRecord?.id)
          
          // Create vendor earning for non-promoter direct purchases
          if (!sale_data && orderRecord) {
            const { data: orderProduct } = await supabase
              .from('products')
              .select('vendor_id, price, promoter_code_discount, commission_rate, platform_commission')
              .eq('id', order_data.product_id)
              .single();
            
            if (orderProduct?.vendor_id) {
              // For direct (non-promoter) purchases, deduct platform commission + shopper discount + promoter commission from product price
              const productPrice = Number(orderProduct.price) * (order_data.quantity || 1);
              const shopperDiscountRate = Number(orderProduct.promoter_code_discount || 0);
              const promoterCommissionRate = Number(orderProduct.commission_rate || 0);
              const platformCommissionRate = Number(orderProduct.platform_commission || 0);
              const totalDeductionRate = shopperDiscountRate + promoterCommissionRate + platformCommissionRate;
              const totalDeduction = (totalDeductionRate / 100) * productPrice;
              const vendorNet = productPrice - totalDeduction;
              
              await supabase
                .from('vendor_earnings')
                .insert({
                  vendor_id: orderProduct.vendor_id,
                  order_id: orderRecord.id,
                  product_id: order_data.product_id,
                  total_amount: productPrice,
                  commission_deducted: totalDeduction,
                  net_earning: Math.max(0, vendorNet),
                  status: order_data.is_digital ? 'completed' : 'pending'
                });
              console.log('Vendor earning created (direct purchase) for vendor:', orderProduct.vendor_id, 'Net:', vendorNet);
            }
          }
        }
      }

      if (sale_data) {
        const { 
          referral_link_id, 
          product_id, 
          promoter_id, 
          buyer_email, 
          quantity, 
          unit_price, 
          total_amount, 
          original_amount,
          discount_amount,
          discount_percent,
          commission_rate, 
          commission_amount, // This is the BASE commission from product
          is_digital,
          promoter_code_used 
        } = sale_data

        console.log('Processing sale with promoter code:', { promoter_code_used, discount_amount, discount_percent })

        // Get daily sales tier for this promoter
        const tierInfo = await getDailySalesTier(supabase, promoter_id);
        
        // Calculate final commission based on daily sales tier
        const baseCommission = Number(commission_amount);
        const tierPercent = tierInfo.commissionPercent;
        const finalCommission = baseCommission * (tierPercent / 100);
        
        console.log(`Commission calculation: Base ₹${baseCommission} x ${tierPercent}% (${tierInfo.tierName}) = ₹${finalCommission}`);

        // Check and deduct stock
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity, is_digital')
          .eq('id', product_id)
          .single()

        if (product && !product.is_digital && product.stock_quantity !== null) {
          const newStock = Math.max(0, product.stock_quantity - quantity)
          
          const { error: stockError } = await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', product_id)

          if (stockError) {
            console.error('Error deducting stock:', stockError)
          } else {
            console.log(`Stock deducted for product ${product_id}: ${product.stock_quantity} -> ${newStock}`)
          }
        }

        // Record the sale with discount info
        const { data: saleRecord, error: saleError } = await supabase
          .from('sales')
          .insert({
            referral_link_id,
            product_id,
            promoter_id,
            buyer_email,
            quantity,
            unit_price,
            total_amount, // This is now the discounted amount
            commission_rate,
            commission_amount: baseCommission, // Store base commission in sales table
            status: 'completed'
          })
          .select()
          .single()

        if (saleError) {
          console.error('Error recording sale:', saleError)
          throw new Error('Failed to record sale')
        }

        console.log('Sale recorded:', saleRecord.id, 'with discount applied:', discount_amount || 0)

        // Fetch return period settings
        const { data: returnSettings } = await supabase
          .from('referral_commission_settings')
          .select('setting_value')
          .eq('setting_key', 'return_period_days')
          .single()

        const returnPeriod = returnSettings?.setting_value as { digital: number; physical: number } || { digital: 0, physical: 7 }
        const isDigitalProduct = is_digital || product?.is_digital || false
        const returnDays = isDigitalProduct ? returnPeriod.digital : returnPeriod.physical

        // Calculate return window end date
        const returnWindowEnds = new Date()
        returnWindowEnds.setDate(returnWindowEnds.getDate() + returnDays)

        // Create earning record for the promoter with tier-based commission
        const earningStatus = isDigitalProduct ? 'approved' : 'pending' // Digital products get immediate approval
        
        const formulaBreakdown = {
          sale_id: saleRecord.id,
          product_id,
          unit_price,
          quantity,
          commission_rate,
          is_digital: isDigitalProduct,
          promoter_code_used: promoter_code_used || null,
          original_amount: original_amount || total_amount,
          discount_amount: discount_amount || 0,
          discount_percent: discount_percent || 0,
          final_amount: total_amount,
          // Daily sales tier information
          base_commission: baseCommission,
          promoter_daily_sales_count: tierInfo.dailySalesCount,
          tier_name: tierInfo.tierName,
          tier_min_sales: tierInfo.minSales,
          tier_max_sales: tierInfo.maxSales,
          tier_commission_percent: tierPercent,
          final_commission: finalCommission
        };

        const { error: earningError } = await supabase
          .from('earnings')
          .insert({
            promoter_id,
            base_amount: baseCommission,
            amount: finalCommission, // Final commission after tier calculation
            sale_date: new Date().toISOString().split('T')[0],
            status: earningStatus,
            return_window_ends_at: returnWindowEnds.toISOString(),
            earning_type: 'direct_sale',
            formula_breakdown: formulaBreakdown
          })

        if (earningError) {
          console.error('Error creating earning:', earningError)
        } else {
          console.log('Earning created for promoter:', promoter_id, 
            'Base:', baseCommission, 
            'Tier:', tierInfo.tierName, 
            `(${tierPercent}%)`,
            'Final:', finalCommission,
            'Status:', earningStatus)
        }

        // Create vendor earning for promoter-referred sale
        const { data: saleProduct } = await supabase
          .from('products')
          .select('vendor_id, price, promoter_code_discount, commission_rate, platform_commission')
          .eq('id', product_id)
          .single();
        
        if (saleProduct?.vendor_id) {
          // Find the order record we just created
          const { data: orderForVendor } = await supabase
            .from('orders')
            .select('id')
            .eq('payment_id', razorpay_payment_id)
            .eq('product_id', product_id)
            .limit(1)
            .maybeSingle();
          
          if (orderForVendor) {
            // Vendor net = product price - (shopper discount + promoter commission + platform commission)
            const productPrice = Number(saleProduct.price) * quantity;
            const shopperDiscountRate = Number(saleProduct.promoter_code_discount || 0);
            const promoterCommissionRate = Number(saleProduct.commission_rate || 0);
            const platformCommissionRate = Number(saleProduct.platform_commission || 0);
            const totalDeductionRate = shopperDiscountRate + promoterCommissionRate + platformCommissionRate;
            const totalDeduction = (totalDeductionRate / 100) * productPrice;
            const vendorNet = productPrice - totalDeduction;
            
            await supabase
              .from('vendor_earnings')
              .insert({
                vendor_id: saleProduct.vendor_id,
                order_id: orderForVendor.id,
                product_id: product_id,
                total_amount: productPrice,
                commission_deducted: totalDeduction,
                net_earning: Math.max(0, vendorNet),
                status: is_digital ? 'completed' : 'pending'
              });
            console.log('Vendor earning created for vendor:', saleProduct.vendor_id, 'Net:', vendorNet);
          }
        }

        // Check if promoter advanced to a new daily sales tier and send notification
        const previousSalesCount = tierInfo.dailySalesCount - 1;
        if (previousSalesCount > 0) {
          // Get the tier that was active for the previous sale count
          const { data: prevTiers } = await supabase
            .from('daily_sales_tiers')
            .select('*')
            .eq('is_active', true)
            .lte('min_sales', previousSalesCount)
            .order('min_sales', { ascending: false });

          let previousTier = null;
          for (const tier of (prevTiers || [])) {
            if (tier.max_sales === null || previousSalesCount <= tier.max_sales) {
              previousTier = tier;
              break;
            }
          }

          // If tier changed, send a celebration notification
          if (previousTier && previousTier.tier_name !== tierInfo.tierName) {
            await supabase
              .from('notifications')
              .insert({
                user_id: promoter_id,
                title: `🎉 Tier Upgrade! You're now in ${tierInfo.tierName}!`,
                message: `Congratulations! You've made ${tierInfo.dailySalesCount} sales today and advanced to ${tierInfo.tierName}! You now earn ${tierInfo.commissionPercent}% of product commissions. Keep up the amazing work!`,
                type: 'success',
                metadata: {
                  tier_name: tierInfo.tierName,
                  commission_percent: tierInfo.commissionPercent,
                  daily_sales: tierInfo.dailySalesCount,
                  previous_tier: previousTier.tier_name
                }
              });
            console.log(`Tier advancement notification sent to ${promoter_id}: ${previousTier.tier_name} -> ${tierInfo.tierName}`);
          }
        }

        // Check if promoter has a referrer and credit referral commission
        const { data: referralData } = await supabase
          .from('promoter_referrals')
          .select('referrer_promoter_id')
          .eq('referred_promoter_id', promoter_id)
          .maybeSingle()

        if (referralData) {
          // Get sales referral percentage
          const { data: refSettings } = await supabase
            .from('referral_commission_settings')
            .select('setting_value')
            .eq('setting_key', 'sales_referral_percent')
            .single()

          const refPercent = (refSettings?.setting_value as { percent: number })?.percent || 5
          const refCommission = finalCommission * (refPercent / 100) // Referral commission based on final commission

          // Create referral earning for the referrer
          await supabase
            .from('earnings')
            .insert({
              promoter_id: referralData.referrer_promoter_id,
              base_amount: refCommission,
              amount: refCommission,
              sale_date: new Date().toISOString().split('T')[0],
              status: earningStatus, // Same status as the original sale
              return_window_ends_at: returnWindowEnds.toISOString(),
              earning_type: 'sales_referral',
              referral_source_promoter_id: promoter_id,
              formula_breakdown: {
                source_sale_id: saleRecord.id,
                referred_promoter_id: promoter_id,
                original_commission: finalCommission,
                referral_percent: refPercent,
                tier_info: {
                  tier_name: tierInfo.tierName,
                  daily_sales: tierInfo.dailySalesCount,
                  tier_percent: tierPercent
                }
              }
            })

          console.log('Referral commission credited to:', referralData.referrer_promoter_id, 'amount:', refCommission)
        }

        // Update referral link conversions
        if (referral_link_id) {
          await supabase
            .from('referral_links')
            .update({ conversions: supabase.rpc('increment', { row_id: referral_link_id }) })
            .eq('id', referral_link_id)
        }

        return new Response(
          JSON.stringify({ 
            verified: true, 
            sale_id: saleRecord.id,
            payment_id: razorpay_payment_id,
            commission: {
              base: baseCommission,
              tier: tierInfo.tierName,
              tierPercent: tierPercent,
              final: finalCommission,
              dailySales: tierInfo.dailySalesCount
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ verified: true, payment_id: razorpay_payment_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Razorpay function error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})