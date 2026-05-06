import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Crown, Calendar, CreditCard, History, IndianRupee, Loader2, Zap, RefreshCw } from 'lucide-react';

// Using Razorpay type from useRazorpay hook

interface Subscription {
  id: string;
  plan_type: string;
  status: string;
  auto_renew: boolean;
  amount: number;
  started_at: string;
  expires_at: string;
  next_billing_date: string | null;
}

interface PremiumPricing {
  monthly: number;
  annual: number;
}

export function SubscriptionManagement() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [pricing, setPricing] = useState<PremiumPricing>({ monthly: 999, annual: 9990 });
  const [processing, setProcessing] = useState(false);
  const [profile, setProfile] = useState<{ promoter_tier: string | null } | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    const [subRes, historyRes, pricingRes, profileRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('subscription_settings')
        .select('setting_value')
        .eq('setting_key', 'premium_pricing')
        .single(),
      supabase
        .from('profiles')
        .select('promoter_tier')
        .eq('id', user?.id)
        .single()
    ]);

    if (subRes.data) setSubscription(subRes.data);
    if (historyRes.data) setHistory(historyRes.data);
    if (pricingRes.data) {
      const val = pricingRes.data.setting_value as unknown as PremiumPricing;
      if (val?.monthly && val?.annual) setPricing(val);
    }
    if (profileRes.data) setProfile(profileRes.data);
    setLoading(false);
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setProcessing(true);

    try {
      const { data: orderData, error: orderError } = await supabase.functions.invoke('premium-subscription', {
        body: {
          action: 'create_order',
          user_id: user.id,
          plan_type: selectedPlan,
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
        description: `Premium ${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Subscription`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('premium-subscription', {
            body: {
              action: 'verify_payment',
              user_id: user.id,
              plan_type: selectedPlan,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }
          });

          if (verifyError || !verifyData?.success) {
            toast.error('Payment verification failed');
          } else {
            toast.success('Subscription upgraded successfully!');
            setUpgradeDialogOpen(false);
            fetchData();
          }
        },
        prefill: { email: user.email },
        theme: { color: '#7c3aed' },
        modal: {
          ondismiss: () => setProcessing(false)
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const toggleAutoRenew = async (value: boolean) => {
    if (!subscription) return;
    
    const { error } = await supabase
      .from('subscriptions')
      .update({ auto_renew: value, next_billing_date: value ? subscription.expires_at : null })
      .eq('id', subscription.id);

    if (error) {
      toast.error('Failed to update auto-renewal');
    } else {
      toast.success(value ? 'Auto-renewal enabled' : 'Auto-renewal disabled');
      fetchData();
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading subscription...</div>;
  }

  const isPremium = profile?.promoter_tier === 'premium';
  const daysRemaining = subscription ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Subscription Status
          </CardTitle>
          <CardDescription>Manage your promoter subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${isPremium ? 'bg-primary/20' : 'bg-muted'}`}>
                <Crown className={`h-8 w-8 ${isPremium ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {isPremium ? 'Premium Tier' : 'Free Tier'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isPremium ? 'Unlimited access to all features' : 'Limited features available'}
                </p>
              </div>
            </div>
            <Badge variant={isPremium ? 'default' : 'secondary'} className="text-lg px-4 py-2">
              {isPremium ? 'Active' : 'Free'}
            </Badge>
          </div>

          {subscription && isPremium && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Expires</span>
                </div>
                <p className="text-lg font-semibold">
                  {new Date(subscription.expires_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">{daysRemaining} days remaining</p>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm">Plan Type</span>
                </div>
                <p className="text-lg font-semibold capitalize">{subscription.plan_type}</p>
                <p className="text-sm text-muted-foreground">₹{subscription.amount}/
                  {subscription.plan_type === 'annual' ? 'year' : 'month'}
                </p>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <RefreshCw className="h-4 w-4" />
                  <span className="text-sm">Auto-Renewal</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Switch
                    checked={subscription.auto_renew}
                    onCheckedChange={toggleAutoRenew}
                  />
                  <Label>{subscription.auto_renew ? 'Enabled' : 'Disabled'}</Label>
                </div>
                {subscription.auto_renew && subscription.next_billing_date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Next: {new Date(subscription.next_billing_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {!isPremium && (
            <Button onClick={() => setUpgradeDialogOpen(true)} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Upgrade to Premium
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Subscription History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Subscription History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="capitalize">{sub.plan_type}</TableCell>
                    <TableCell>₹{sub.amount}</TableCell>
                    <TableCell>{new Date(sub.started_at).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(sub.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to Premium</DialogTitle>
            <DialogDescription>
              Choose your subscription plan
            </DialogDescription>
          </DialogHeader>
          
          <RadioGroup
            value={selectedPlan}
            onValueChange={(v) => setSelectedPlan(v as 'monthly' | 'annual')}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="monthly-upgrade"
              className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                selectedPlan === 'monthly' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <RadioGroupItem value="monthly" id="monthly-upgrade" className="sr-only" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Monthly</p>
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary mt-1">
                  <IndianRupee className="h-5 w-5" />
                  <span>{pricing.monthly}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">per month</p>
              </div>
            </Label>

            <Label
              htmlFor="annual-upgrade"
              className={`cursor-pointer rounded-lg border-2 p-4 transition-all relative ${
                selectedPlan === 'annual' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <RadioGroupItem value="annual" id="annual-upgrade" className="sr-only" />
              <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs">
                Save {Math.round(((pricing.monthly * 12) - pricing.annual) / (pricing.monthly * 12) * 100)}%
              </Badge>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Annual</p>
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary mt-1">
                  <IndianRupee className="h-5 w-5" />
                  <span>{pricing.annual}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">per year</p>
              </div>
            </Label>
          </RadioGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay ₹{selectedPlan === 'annual' ? pricing.annual : pricing.monthly}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
