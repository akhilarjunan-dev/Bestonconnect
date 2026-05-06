import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://bestonconnect.com';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const results = { 
      downgraded_promoters: 0, 
      downgraded_showcases: 0, 
      reminders_sent: 0,
      auto_pay_attempts: 0,
      auto_pay_success: 0,
      auto_pay_failed: 0,
      emails_sent: 0,
      tokens_invalidated: 0
    };

    // ===== 1. PROMOTER SUBSCRIPTION EXPIRY =====
    const { data: expiredSubs } = await supabase
      .from('subscriptions')
      .select('id, user_id, expires_at, plan_type, auto_renew, amount, razorpay_customer_id, billing_token')
      .eq('status', 'active')
      .lt('expires_at', now.toISOString());

    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        // Invalidate billing token immediately
        await supabase
          .from('subscriptions')
          .update({ 
            billing_token: null,
            billing_token_expires_at: null,
          })
          .eq('id', sub.id);
        results.tokens_invalidated++;

        // Try auto-pay if auto_renew is enabled and Razorpay credentials exist
        let autoPaySuccess = false;
        if (sub.auto_renew && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
          results.auto_pay_attempts++;
          try {
            // Create a new Razorpay order for auto-renewal
            const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
              },
              body: JSON.stringify({
                amount: Number(sub.amount) * 100,
                currency: 'INR',
                receipt: `auto_${Date.now().toString(36)}`,
                notes: { user_id: sub.user_id, plan_type: sub.plan_type, auto_renewal: true },
              }),
            });

            if (orderRes.ok) {
              // Auto-pay order created - but Razorpay doesn't auto-charge without Subscriptions API
              // So we mark it as needing manual payment and send notification
              console.log('Auto-renewal order created for:', sub.user_id, '- manual payment required');
            }
          } catch (e) {
            console.error('Auto-pay attempt failed for:', sub.user_id, e);
          }
        }

        if (!autoPaySuccess) {
          // Mark subscription as expired
          await supabase
            .from('subscriptions')
            .update({ 
              status: 'expired',
              auto_pay_failed: true,
              auto_pay_failed_at: now.toISOString(),
            })
            .eq('id', sub.id);

          // Check for other active subscriptions
          const { data: otherActive } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', sub.user_id)
            .eq('status', 'active')
            .neq('id', sub.id)
            .limit(1)
            .maybeSingle();

          if (!otherActive) {
            // Downgrade promoter to free tier
            await supabase
              .from('profiles')
              .update({ promoter_tier: 'free' })
              .eq('id', sub.user_id);

            // Send urgent notification
            await supabase.from('notifications').insert({
              user_id: sub.user_id,
              title: '🔒 Subscription Expired - Account Locked',
              message: 'Your premium subscription has expired and all premium features are now disabled. Please renew immediately to restore access. Your billing token has been invalidated.',
              type: 'warning',
              metadata: { subscription_id: sub.id, action: 'renew_required', locked: true }
            });

            // Send email notification if Resend is configured
            if (RESEND_API_KEY) {
              try {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('email, full_name')
                  .eq('id', sub.user_id)
                  .single();

                if (profile?.email) {
                  await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${RESEND_API_KEY}`,
                    },
                    body: JSON.stringify({
                      from: 'Bestonconnect <support@bestonconnect.com>',
                      to: [profile.email],
                      subject: '🔒 Your Subscription Has Expired - Immediate Action Required',
                      html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                          <h2 style="color: #dc2626;">⚠️ Subscription Expired</h2>
                          <p>Hi ${profile.full_name || 'there'},</p>
                          <p>Your premium ${sub.plan_type} subscription has expired. <strong>All premium features are now disabled.</strong></p>
                          <ul>
                            <li>❌ Referral links disabled</li>
                            <li>❌ Commission earning paused</li>
                            <li>❌ Withdrawals blocked</li>
                            <li>❌ Your billing token has been invalidated</li>
                          </ul>
                          <p><strong>Renew now to restore access:</strong></p>
                          <a href="${APP_BASE_URL}/promoter/dashboard" 
                             style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Renew Subscription
                          </a>
                          <p style="color: #666; margin-top: 20px; font-size: 12px;">
                            Amount due: ₹${sub.amount} for ${sub.plan_type} plan.
                          </p>
                        </div>
                      `,
                    }),
                  });
                  results.emails_sent++;
                  console.log('Expiry email sent to:', profile.email);
                }
              } catch (emailErr) {
                console.error('Failed to send expiry email:', emailErr);
              }
            }

            results.downgraded_promoters++;
            results.auto_pay_failed++;
            console.log('Downgraded promoter:', sub.user_id);
          }
        }
      }
    }

    // ===== 2. REMINDER: 2 days before expiry =====
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const twoDaysMinus1Hour = new Date(twoDaysFromNow.getTime() - 60 * 60 * 1000);

    const { data: soonExpiring } = await supabase
      .from('subscriptions')
      .select('id, user_id, expires_at, plan_type, amount, auto_renew')
      .eq('status', 'active')
      .gte('expires_at', twoDaysMinus1Hour.toISOString())
      .lte('expires_at', twoDaysFromNow.toISOString());

    if (soonExpiring && soonExpiring.length > 0) {
      for (const sub of soonExpiring) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', sub.user_id)
          .eq('type', 'warning')
          .ilike('title', '%Subscription Expiring%')
          .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          const renewMessage = sub.auto_renew 
            ? 'Auto-renewal is enabled. Payment will be attempted on expiry. Please ensure funds are available.'
            : 'Auto-renewal is OFF. Please renew manually to avoid losing premium features.';

          await supabase.from('notifications').insert({
            user_id: sub.user_id,
            title: '⏰ Subscription Expiring in 2 Days!',
            message: `Your ${sub.plan_type} premium subscription expires in 2 days (₹${sub.amount}). ${renewMessage}`,
            type: 'warning',
            metadata: { subscription_id: sub.id, expires_at: sub.expires_at, action: 'renew_soon' }
          });

          // Send email reminder
          if (RESEND_API_KEY) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', sub.user_id)
                .single();

              if (profile?.email) {
                await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                  },
                  body: JSON.stringify({
                    from: 'Bestonconnect <support@bestonconnect.com>',
                    to: [profile.email],
                    subject: '⏰ Your Subscription Expires in 2 Days',
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #f59e0b;">⏰ Renewal Reminder</h2>
                        <p>Hi ${profile.full_name || 'there'},</p>
                        <p>Your <strong>${sub.plan_type}</strong> premium subscription expires in <strong>2 days</strong>.</p>
                        <p>Amount: <strong>₹${sub.amount}</strong></p>
                        <p>${renewMessage}</p>
                        <a href="${APP_BASE_URL}/promoter/dashboard" 
                           style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                          Renew Now
                        </a>
                      </div>
                    `,
                  }),
                });
                results.emails_sent++;
              }
            } catch (emailErr) {
              console.error('Failed to send reminder email:', emailErr);
            }
          }

          results.reminders_sent++;
          console.log('Sent expiry reminder to:', sub.user_id);
        }
      }
    }

    // ===== 3. SHOWCASE SUBSCRIPTION EXPIRY =====
    const { data: expiredShowcases } = await supabase
      .from('showcase_shops')
      .select('id, user_id, subscription_expires_at, billing_token')
      .eq('is_premium', true)
      .not('subscription_expires_at', 'is', null)
      .lt('subscription_expires_at', now.toISOString());

    if (expiredShowcases && expiredShowcases.length > 0) {
      for (const shop of expiredShowcases) {
        await supabase
          .from('showcase_shops')
          .update({ 
            is_premium: false, 
            is_active: false,
            billing_token: null,
            billing_token_expires_at: null,
            auto_pay_failed: true,
            auto_pay_failed_at: now.toISOString(),
          })
          .eq('id', shop.id);

        await supabase.from('notifications').insert({
          user_id: shop.user_id,
          title: '🔒 Vendor Shop Subscription Expired',
          message: 'Your vendor shop subscription has expired. Your shop is now deactivated and all vendor features are locked. Please renew to reactivate.',
          type: 'warning',
          metadata: { shop_id: shop.id, action: 'renew_required', locked: true }
        });

        // Send email
        if (RESEND_API_KEY) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', shop.user_id)
              .single();

            if (profile?.email) {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: 'Bestonconnect <support@bestonconnect.com>',
                  to: [profile.email],
                  subject: '🔒 Your Vendor Shop Has Been Deactivated',
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2 style="color: #dc2626;">Vendor Shop Deactivated</h2>
                      <p>Hi ${profile.full_name || 'there'},</p>
                      <p>Your vendor shop subscription has expired. Your shop is now <strong>deactivated</strong>.</p>
                      <a href="${APP_BASE_URL}/vendor/dashboard" 
                         style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Renew Subscription
                      </a>
                    </div>
                  `,
                }),
              });
              results.emails_sent++;
            }
          } catch (emailErr) {
            console.error('Failed to send vendor expiry email:', emailErr);
          }
        }

        results.downgraded_showcases++;
        results.tokens_invalidated++;
        console.log('Deactivated showcase:', shop.id);
      }
    }

    // ===== 4. SHOWCASE REMINDER: 2 days before =====
    const { data: soonExpiringShowcases } = await supabase
      .from('showcase_shops')
      .select('id, user_id, subscription_expires_at')
      .eq('is_premium', true)
      .not('subscription_expires_at', 'is', null)
      .gte('subscription_expires_at', twoDaysMinus1Hour.toISOString())
      .lte('subscription_expires_at', twoDaysFromNow.toISOString());

    if (soonExpiringShowcases && soonExpiringShowcases.length > 0) {
      for (const shop of soonExpiringShowcases) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', shop.user_id)
          .ilike('title', '%Showcase%Expiring%')
          .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          await supabase.from('notifications').insert({
            user_id: shop.user_id,
            title: '⏰ Vendor Shop Subscription Expiring Soon!',
            message: 'Your vendor shop subscription expires in 2 days. Please renew to keep your shop active and avoid feature lockout.',
            type: 'warning',
            metadata: { shop_id: shop.id, action: 'renew_soon' }
          });
          results.reminders_sent++;
        }
      }
    }

    console.log('Subscription check complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Subscription check error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
