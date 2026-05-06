import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldAlert, CreditCard, IndianRupee, Loader2, Lock, Crown } from 'lucide-react';

interface SubscriptionGateProps {
  children: React.ReactNode;
  role: 'promoter' | 'vendor';
}

interface PremiumPricing {
  monthly: number;
  annual: number;
}

export function SubscriptionGate({ children, role }: SubscriptionGateProps) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [expired, setExpired] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [pricing, setPricing] = useState<PremiumPricing>({ monthly: 999, annual: 9990 });
  const [processing, setProcessing] = useState(false);
  const [expiryInfo, setExpiryInfo] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    if (user) checkSubscriptionStatus();
  }, [user]);

  const checkSubscriptionStatus = async () => {
    if (!user) return;
    setChecking(true);

    if (role === 'promoter') {
      // Check promoter subscription
      const [profileRes, subRes, pricingRes] = await Promise.all([
        supabase.from('profiles').select('promoter_tier').eq('id', user.id).single(),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('subscription_settings').select('setting_value').eq('setting_key', 'premium_pricing').single(),
      ]);

      if (pricingRes.data) {
        const val = pricingRes.data.setting_value as unknown as PremiumPricing;
        if (val?.monthly && val?.annual) setPricing(val);
      }

      const tier = profileRes.data?.promoter_tier;
      const sub = subRes.data;

      if (tier === 'premium' && sub) {
        const now = new Date();
        const expiresAt = new Date(sub.expires_at);
        
        if (expiresAt > now && sub.billing_token) {
          // Valid token and not expired
          setIsActive(true);
          setExpired(false);
        } else if (expiresAt > now) {
          // Not expired but no token (legacy) - allow but mark for token generation
          setIsActive(true);
          setExpired(false);
        } else {
          // Expired
          setIsActive(false);
          setExpired(true);
          setExpiryInfo(expiresAt.toLocaleDateString());
        }
      } else if (tier === 'free' || !tier) {
        // Free tier promoters can access dashboard with limited features
        setIsActive(true);
        setExpired(false);
      } else {
        // Premium but no active subscription found - expired
        setIsActive(false);
        setExpired(true);
      }
    } else if (role === 'vendor') {
      // Check vendor showcase subscription
      const [shopRes, pricingRes] = await Promise.all([
        supabase.from('showcase_shops').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('subscription_settings').select('setting_value').eq('setting_key', 'showcase_pricing').single(),
      ]);

      if (pricingRes.data) {
        const val = pricingRes.data.setting_value as unknown as PremiumPricing;
        if (val?.monthly && val?.annual) setPricing(val);
      }

      const shop = shopRes.data;
      if (!shop) {
        // No shop created yet - allow access to create one
        setIsActive(true);
        setExpired(false);
      } else {
        const now = new Date();
        const trialEnds = new Date(shop.trial_ends_at);
        const subExpires = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;

        if (trialEnds > now && !shop.is_premium) {
          // Still in trial
          setIsActive(true);
          setExpired(false);
        } else if (shop.is_premium && subExpires && subExpires > now) {
          // Active paid subscription
          setIsActive(true);
          setExpired(false);
        } else if (shop.is_premium && subExpires && subExpires <= now) {
          // Subscription expired
          setIsActive(false);
          setExpired(true);
          setExpiryInfo(subExpires.toLocaleDateString());
        } else if (trialEnds <= now && !shop.is_premium) {
          // Trial ended, no subscription
          setIsActive(false);
          setExpired(true);
          setExpiryInfo(trialEnds.toLocaleDateString());
        } else {
          setIsActive(true);
          setExpired(false);
        }
      }
    }

    setChecking(false);
  };

  const handlePayment = async () => {
    if (!user) return;
    setProcessing(true);

    try {
      const settingKey = role === 'promoter' ? 'premium_pricing' : 'showcase_pricing';
      const edgeFn = role === 'promoter' ? 'premium-subscription' : 'premium-subscription';

      const { data: orderData, error: orderError } = await supabase.functions.invoke(edgeFn, {
        body: {
          action: 'create_order',
          user_id: user.id,
          plan_type: selectedPlan,
          subscription_for: role,
        }
      });

      if (orderError || !orderData?.success) {
        throw new Error(orderData?.error || 'Failed to create order');
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Bestonconnect',
        description: `${role === 'promoter' ? 'Premium Promoter' : 'Vendor Shop'} ${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Subscription`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke(edgeFn, {
            body: {
              action: 'verify_payment',
              user_id: user.id,
              plan_type: selectedPlan,
              subscription_for: role,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }
          });

          if (verifyError || !verifyData?.success) {
            toast.error('Payment verification failed');
          } else {
            toast.success('Subscription activated! Refreshing...');
            setTimeout(() => window.location.reload(), 1500);
          }
        },
        prefill: { email: user.email },
        theme: { color: '#7c3aed' },
        modal: { ondismiss: () => setProcessing(false) }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Verifying subscription...
        </div>
      </div>
    );
  }

  if (isActive && !expired) {
    return <>{children}</>;
  }

  // LOCKOUT SCREEN
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-lg w-full border-destructive/50 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive flex items-center justify-center gap-2">
            <Lock className="h-5 w-5" />
            Subscription Required
          </CardTitle>
          <CardDescription className="text-base">
            {expired
              ? `Your ${role === 'promoter' ? 'premium promoter' : 'vendor shop'} subscription expired${expiryInfo ? ` on ${expiryInfo}` : ''}. All features are disabled until you renew.`
              : `A paid subscription is required to access ${role === 'promoter' ? 'premium promoter' : 'vendor shop'} features.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
            <p className="font-medium mb-1">⚠️ All features are currently locked:</p>
            <ul className="list-disc pl-5 space-y-1 text-destructive/80">
              {role === 'promoter' ? (
                <>
                  <li>Referral link generation disabled</li>
                  <li>Commission earning paused</li>
                  <li>Withdrawals blocked</li>
                  <li>Video ad uploads disabled</li>
                  <li>Showcase shop deactivated</li>
                </>
              ) : (
                <>
                  <li>Shop link generation disabled</li>
                  <li>Product management locked</li>
                  <li>Order processing paused</li>
                  <li>Withdrawals blocked</li>
                </>
              )}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium mb-3 text-center">Choose a plan to reactivate:</p>
            <RadioGroup
              value={selectedPlan}
              onValueChange={(v) => setSelectedPlan(v as 'monthly' | 'annual')}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="gate-monthly"
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  selectedPlan === 'monthly' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <RadioGroupItem value="monthly" id="gate-monthly" className="sr-only" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Monthly</p>
                  <div className="flex items-center justify-center gap-1 text-xl font-bold text-primary mt-1">
                    <IndianRupee className="h-4 w-4" />
                    <span>{pricing.monthly}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">per month</p>
                </div>
              </Label>

              <Label
                htmlFor="gate-annual"
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all relative ${
                  selectedPlan === 'annual' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <RadioGroupItem value="annual" id="gate-annual" className="sr-only" />
                <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs">
                  Save {Math.round(((pricing.monthly * 12) - pricing.annual) / (pricing.monthly * 12) * 100)}%
                </Badge>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Annual</p>
                  <div className="flex items-center justify-center gap-1 text-xl font-bold text-primary mt-1">
                    <IndianRupee className="h-4 w-4" />
                    <span>{pricing.annual}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">per year</p>
                </div>
              </Label>
            </RadioGroup>
          </div>

          <Button
            onClick={handlePayment}
            disabled={processing}
            className="w-full gap-2"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Pay ₹{selectedPlan === 'annual' ? pricing.annual : pricing.monthly} to Reactivate
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment via Razorpay. Your subscription will be activated immediately after payment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
