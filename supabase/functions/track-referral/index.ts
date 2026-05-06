import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Maximum commission rate cap (30%)
const MAX_COMMISSION_RATE = 30;

// Commission validity periods in days
const FREE_TIER_COMMISSION_VALIDITY_DAYS = 30; // 1 month for free tier
const PREMIUM_TIER_COMMISSION_VALIDITY_DAYS = null; // Based on subscription period

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, link_code, sale_data } = await req.json()

    if (action === 'track_click') {
      // Track referral link click
      console.log(`Tracking click for link: ${link_code}`)
      
      const { error } = await supabase.rpc('increment_referral_clicks', { link_code })
      
      if (error) {
        console.error('Error tracking click:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to track click' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'record_sale') {
      // Record a sale through referral link
      console.log(`Recording sale for link: ${link_code}`)
      
      // Get referral link details
      const { data: linkData, error: linkError } = await supabase
        .from('referral_links')
        .select('id, promoter_id, product_id')
        .eq('link_code', link_code)
        .maybeSingle()

      if (linkError || !linkData) {
        console.error('Error fetching link:', linkError)
        return new Response(
          JSON.stringify({ error: 'Invalid referral link' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get promoter profile to check tier
      const { data: promoterProfile, error: profileError } = await supabase
        .from('profiles')
        .select('promoter_tier')
        .eq('id', linkData.promoter_id)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching promoter profile:', profileError)
      }

      const promoterTier = promoterProfile?.promoter_tier || 'free'

      // Check commission validity for free tier
      if (promoterTier === 'free') {
        // Check when the referred customer was registered
        const buyerEmail = sale_data?.buyer_email
        if (buyerEmail) {
          // Check first sale from this customer to this promoter
          const { data: firstSale } = await supabase
            .from('sales')
            .select('created_at')
            .eq('promoter_id', linkData.promoter_id)
            .eq('buyer_email', buyerEmail)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (firstSale) {
            const firstSaleDate = new Date(firstSale.created_at)
            const validityEndDate = new Date(firstSaleDate)
            validityEndDate.setDate(validityEndDate.getDate() + FREE_TIER_COMMISSION_VALIDITY_DAYS)
            
            if (new Date() > validityEndDate) {
              console.log('Free tier commission validity expired for this customer')
              return new Response(
                JSON.stringify({ 
                  error: 'Commission validity expired', 
                  message: 'Free tier commission is valid only for 1 month from first customer sale. Upgrade to Premium for extended validity.' 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
        }
      } else {
        // Premium tier: check subscription validity
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('expires_at, status')
          .eq('user_id', linkData.promoter_id)
          .eq('status', 'active')
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!subscription || new Date(subscription.expires_at) < new Date()) {
          console.log('Premium subscription expired, treating as free tier')
          // Check free tier validity instead
          const buyerEmail = sale_data?.buyer_email
          if (buyerEmail) {
            const { data: firstSale } = await supabase
              .from('sales')
              .select('created_at')
              .eq('promoter_id', linkData.promoter_id)
              .eq('buyer_email', buyerEmail)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle()

            if (firstSale) {
              const firstSaleDate = new Date(firstSale.created_at)
              const validityEndDate = new Date(firstSaleDate)
              validityEndDate.setDate(validityEndDate.getDate() + FREE_TIER_COMMISSION_VALIDITY_DAYS)
              
              if (new Date() > validityEndDate) {
                console.log('Free tier commission validity expired for this customer (expired premium)')
                return new Response(
                  JSON.stringify({ 
                    error: 'Commission validity expired', 
                    message: 'Your premium subscription has expired. Free tier commission is valid only for 1 month.' 
                  }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
              }
            }
          }
        }
      }

      // Get product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, price, commission_rate')
        .eq('id', linkData.product_id)
        .single()

      if (productError || !productData) {
        console.error('Error fetching product:', productError)
        return new Response(
          JSON.stringify({ error: 'Product not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const quantity = sale_data?.quantity || 1
      const unitPrice = productData.price
      const totalAmount = unitPrice * quantity
      
      // Apply commission rate cap at 30%
      const rawCommissionRate = productData.commission_rate
      const cappedCommissionRate = Math.min(rawCommissionRate, MAX_COMMISSION_RATE)
      const commissionAmount = totalAmount * (cappedCommissionRate / 100)

      console.log(`Commission: ${rawCommissionRate}% -> capped at ${cappedCommissionRate}% = ₹${commissionAmount}`)

      // Insert sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          referral_link_id: linkData.id,
          product_id: productData.id,
          promoter_id: linkData.promoter_id,
          buyer_email: sale_data?.buyer_email || null,
          quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          commission_rate: cappedCommissionRate,
          commission_amount: commissionAmount,
          status: 'completed'
        })
        .select()
        .single()

      if (saleError) {
        console.error('Error recording sale:', saleError)
        return new Response(
          JSON.stringify({ error: 'Failed to record sale' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Sale recorded successfully:', saleData.id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          sale_id: saleData.id,
          commission_earned: commissionAmount,
          commission_rate_applied: cappedCommissionRate,
          was_capped: rawCommissionRate > MAX_COMMISSION_RATE
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})