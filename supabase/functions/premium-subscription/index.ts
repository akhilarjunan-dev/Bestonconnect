import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateBillingToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let i = 0; i < 8; i++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(seg);
  }
  return segments.join('-');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, user_id, plan_type, razorpay_payment_id, razorpay_order_id, razorpay_signature, referral_code, subscription_for } = body;

    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const subFor = subscription_for || 'promoter';

    if (action === 'create_order') {
      // Determine pricing key based on role
      const pricingKey = subFor === 'vendor' ? 'showcase_pricing' : 'premium_pricing';
      
      const { data: settingsData } = await supabase
        .from('subscription_settings')
        .select('setting_value')
        .eq('setting_key', pricingKey)
        .single();

      const pricing = settingsData?.setting_value as { monthly: number; annual: number } || { monthly: 999, annual: 9990 };
      const amount = plan_type === 'annual' ? pricing.annual : pricing.monthly;
      const amountInPaise = amount * 100;

      const shortReceipt = `${subFor === 'vendor' ? 'vnd' : 'prem'}_${Date.now().toString(36)}`;
      console.log('Creating order with receipt:', shortReceipt, 'for user:', user_id, 'role:', subFor);

      const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: shortReceipt,
          notes: {
            user_id,
            plan_type,
            subscription_type: subFor === 'vendor' ? 'vendor_showcase' : 'premium_promoter',
            referral_code: referral_code || null,
          },
        }),
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('Razorpay order creation failed:', errorText);
        throw new Error('Failed to create Razorpay order');
      }

      const order = await orderResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          amount: amountInPaise,
          currency: 'INR',
          key_id: RAZORPAY_KEY_ID,
          plan_type,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify_payment') {
      const verifyPlanType = body.plan_type || plan_type || 'monthly';
      
      // Verify Razorpay signature
      const signBody = razorpay_order_id + '|' + razorpay_payment_id;
      const crypto = await import('https://deno.land/std@0.168.0/crypto/mod.ts');
      
      const key = new TextEncoder().encode(RAZORPAY_KEY_SECRET);
      const data = new TextEncoder().encode(signBody);
      
      const hmacKey = await crypto.crypto.subtle.importKey(
        'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      
      const signature = await crypto.crypto.subtle.sign('HMAC', hmacKey, data);
      const generatedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (generatedSignature !== razorpay_signature) {
        console.error('Payment signature verification failed');
        return new Response(
          JSON.stringify({ success: false, error: 'Payment verification failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log('Payment verified for user:', user_id, 'role:', subFor);

      // Generate unique billing token for this period
      const billingToken = generateBillingToken();
      const durationDays = verifyPlanType === 'annual' ? 365 : 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
      const tokenExpiresAt = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000); // Token valid 1 day after expiry for grace

      // Determine pricing
      const pricingKey = subFor === 'vendor' ? 'showcase_pricing' : 'premium_pricing';
      const { data: settingsData } = await supabase
        .from('subscription_settings')
        .select('setting_value')
        .eq('setting_key', pricingKey)
        .single();
      
      const pricing = settingsData?.setting_value as { monthly: number; annual: number } || { monthly: 999, annual: 9990 };
      const amount = verifyPlanType === 'annual' ? pricing.annual : pricing.monthly;

      if (subFor === 'vendor') {
        // Handle vendor showcase subscription
        const { data: shop } = await supabase
          .from('showcase_shops')
          .select('id')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (shop) {
          await supabase
            .from('showcase_shops')
            .update({
              is_premium: true,
              is_active: true,
              subscription_plan_type: verifyPlanType,
              subscription_expires_at: expiresAt.toISOString(),
              subscription_auto_renew: false,
              premium_paid_at: new Date().toISOString(),
              razorpay_payment_id,
              razorpay_order_id,
              billing_token: billingToken,
              billing_token_expires_at: tokenExpiresAt.toISOString(),
              auto_pay_failed: false,
              auto_pay_failed_at: null,
            })
            .eq('id', shop.id);
        }

        // Send notification
        await supabase.from('notifications').insert({
          user_id,
          title: 'Vendor Subscription Activated!',
          message: `Your ${verifyPlanType} vendor shop subscription is now active until ${expiresAt.toLocaleDateString()}.`,
          type: 'success',
          metadata: { billing_token: billingToken, expires_at: expiresAt.toISOString() }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Vendor subscription activated', billing_token: billingToken }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle promoter subscription
      // Expire any existing active subscriptions first
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', user_id)
        .eq('status', 'active');

      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          user_id,
          plan_type: verifyPlanType,
          status: 'active',
          auto_renew: false,
          amount,
          razorpay_payment_id,
          razorpay_order_id,
          expires_at: expiresAt.toISOString(),
          next_billing_date: expiresAt.toISOString(),
          billing_token: billingToken,
          billing_token_expires_at: tokenExpiresAt.toISOString(),
          auto_pay_failed: false,
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error('Failed to create subscription:', subscriptionError);
        throw new Error('Failed to create subscription record');
      }

      // Update user profile to premium tier
      await supabase
        .from('profiles')
        .update({ promoter_tier: 'premium' })
        .eq('id', user_id);

      // Auto-approve as premium promoter
      const { data: existingApp } = await supabase
        .from('promoter_applications')
        .select('id, status')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingApp) {
        await supabase
          .from('promoter_applications')
          .update({ tier: 'premium', status: 'approved', reviewed_at: new Date().toISOString() })
          .eq('id', existingApp.id);
      } else {
        await supabase
          .from('promoter_applications')
          .insert({ user_id, tier: 'premium', status: 'approved', reviewed_at: new Date().toISOString() });
      }

      // Add promoter role
      await supabase
        .from('user_roles')
        .upsert({ user_id, role: 'promoter' }, { onConflict: 'user_id,role' });

      // Handle referral if referral code was provided
      if (referral_code) {
        const cleanedCode = referral_code.trim().toUpperCase();
        let referrerPromoterId: string | null = null;
        
        const { data: referralLink } = await supabase
          .from('referral_links')
          .select('promoter_id')
          .ilike('link_code', cleanedCode)
          .maybeSingle();

        if (referralLink) {
          referrerPromoterId = referralLink.promoter_id;
        } else if (cleanedCode.length === 8) {
          const { data: prefixLink } = await supabase
            .from('referral_links')
            .select('promoter_id')
            .ilike('promoter_id', `${cleanedCode.toLowerCase()}%`)
            .limit(1)
            .maybeSingle();
          if (prefixLink) referrerPromoterId = prefixLink.promoter_id;
        }

        if (referrerPromoterId) {
          await supabase.from('promoter_referrals').insert({
            referred_promoter_id: user_id,
            referrer_promoter_id: referrerPromoterId,
            referral_code: cleanedCode,
            tier_at_referral: 'premium',
            current_tier: 'premium'
          });

          const { data: refSettings } = await supabase
            .from('referral_commission_settings')
            .select('setting_value')
            .eq('setting_key', 'subscription_referral_percent')
            .single();

          const refPercent = (refSettings?.setting_value as { percent: number })?.percent || 10;
          const refCommission = amount * (refPercent / 100);

          await supabase.from('earnings').insert({
            promoter_id: referrerPromoterId,
            base_amount: refCommission,
            amount: refCommission,
            sale_date: new Date().toISOString().split('T')[0],
            status: 'approved',
            earning_type: 'subscription_referral',
            referral_source_promoter_id: user_id,
            referral_source_subscription_id: subscriptionData.id,
            formula_breakdown: {
              type: 'subscription_referral',
              referred_user_id: user_id,
              subscription_amount: amount,
              referral_percent: refPercent
            }
          });
        }
      }

      // Send notification with billing token
      await supabase.from('notifications').insert({
        user_id,
        title: 'Premium Subscription Activated!',
        message: `Your ${verifyPlanType} premium subscription is now active until ${expiresAt.toLocaleDateString()}. Your billing token: ${billingToken}`,
        type: 'success',
        metadata: { subscription_id: subscriptionData.id, billing_token: billingToken, expires_at: expiresAt.toISOString() }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Payment verified and promoter approved', billing_token: billingToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Premium subscription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
