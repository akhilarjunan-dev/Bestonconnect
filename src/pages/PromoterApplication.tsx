import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, CheckCircle, Clock, XCircle, Crown, Zap, BookOpen, IndianRupee, Loader2, Users, AlertTriangle, History, CalendarDays, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

type PromoterTier = 'free' | 'premium';
type PlanType = 'monthly' | 'annual';

interface Application {
  id: string;
  status: string;
  tier: PromoterTier | null;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface PremiumPricing {
  monthly: number;
  annual: number;
}

// Using Razorpay type from useRazorpay hook

export default function PromoterApplication() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const refFromUrl = (searchParams.get('ref') || '').trim().toUpperCase();

  const [existingApp, setExistingApp] = useState<Application | null>(null);
  const [applicationHistory, setApplicationHistory] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PromoterTier>('free');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [pricing, setPricing] = useState<PremiumPricing>({ monthly: 999, annual: 9990 });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralLocked, setReferralLocked] = useState(false);
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referrerPromoterId, setReferrerPromoterId] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referrerTier, setReferrerTier] = useState<string | null>(null);
  const [referrerAvatar, setReferrerAvatar] = useState<string | null>(null);
  const [referrerJoined, setReferrerJoined] = useState<string | null>(null);
  const [referrerSalesCount, setReferrerSalesCount] = useState<number>(0);
  const [premiumDisabled, setPremiumDisabled] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
      const refQuery = refFromUrl ? `ref=${encodeURIComponent(refFromUrl)}&` : '';
      navigate(`/auth?${refQuery}redirect=${redirect}`);
      return;
    }
    if (user) {
      // If already a promoter, redirect to dashboard
      if (hasRole('promoter')) {
        navigate('/promoter/dashboard');
        return;
      }

      fetchExistingApplication();
      fetchPricing();

      if (refFromUrl && !referralLocked) {
        setReferralCode((prev) => (prev ? prev : refFromUrl));
        setReferralLocked(true);
        validateReferralCode(refFromUrl);
      }
    }
  }, [user, authLoading, hasRole, navigate, location.pathname, location.search, refFromUrl, referralLocked]);

  const fetchPricing = async () => {
    const { data } = await supabase
      .from('subscription_settings')
      .select('setting_key, setting_value');

    if (data) {
      const pricingRow = data.find((d) => d.setting_key === 'premium_pricing');
      if (pricingRow) {
        const value = pricingRow.setting_value as unknown as PremiumPricing;
        if (value && typeof value.monthly === 'number' && typeof value.annual === 'number') {
          setPricing(value);
        }
      }

      const disabledRow = data.find((d) => d.setting_key === 'premium_disabled');
      if (disabledRow) {
        const val = disabledRow.setting_value as unknown as { disabled: boolean };
        setPremiumDisabled(!!val?.disabled);
      }
    }
  };

  const validateReferralCode = async (code: string) => {
    const cleaned = code.trim().toUpperCase();

    if (!cleaned) {
      setReferralValid(null);
      setReferrerPromoterId(null);
      setReferrerName(null);
      setReferrerTier(null);
      setReferrerAvatar(null);
      setReferrerJoined(null);
      setReferrerSalesCount(0);
      return;
    }

    // Basic client-side validation (server validates again)
    if (cleaned.length > 32 || !/^[A-Z0-9]+$/.test(cleaned)) {
      setReferralValid(false);
      setReferrerPromoterId(null);
      setReferrerName(null);
      setReferrerTier(null);
      setReferrerAvatar(null);
      setReferrerJoined(null);
      setReferrerSalesCount(0);
      return;
    }

    setValidatingReferral(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-referral-code', {
        body: { code: cleaned },
      });

      if (error) throw error;

      if (data?.valid && data?.promoter_id) {
        setReferralValid(true);
        setReferrerPromoterId(data.promoter_id);
        setReferrerName(data.promoter_name || 'Promoter');
        setReferrerTier(data.promoter_tier || 'free');
        setReferrerAvatar(data.promoter_avatar || null);
        setReferrerJoined(data.promoter_joined || null);
        setReferrerSalesCount(data.promoter_sales_count || 0);
      } else if (data?.error === 'self_referral') {
        setReferralValid(false);
        setReferrerPromoterId(null);
        setReferrerName(null);
        setReferrerTier(null);
        setReferrerAvatar(null);
        setReferrerJoined(null);
        setReferrerSalesCount(0);
        toast.error(data.message || "You cannot use your own referral code");
      } else {
        setReferralValid(false);
        setReferrerPromoterId(null);
        setReferrerName(null);
        setReferrerTier(null);
        setReferrerAvatar(null);
        setReferrerJoined(null);
        setReferrerSalesCount(0);
      }
    } catch (error) {
      console.error('Error validating referral code:', error);
      setReferralValid(false);
      setReferrerPromoterId(null);
      setReferrerName(null);
      setReferrerTier(null);
      setReferrerAvatar(null);
      setReferrerJoined(null);
      setReferrerSalesCount(0);
    } finally {
      setValidatingReferral(false);
    }
  };

  const fetchExistingApplication = async () => {
    const { data, error } = await supabase
      .from('promoter_applications')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      // Set all applications for history
      const allApps: Application[] = data.map(app => ({
        ...app,
        tier: app.tier as PromoterTier | null,
        reviewed_at: app.reviewed_at
      }));
      setApplicationHistory(allApps);

      // Set the most recent non-rejected application as current, or the latest one
      const activeApp = allApps.find(app => app.status !== 'rejected') || allApps[0];
      setExistingApp(activeApp);
    }
    setLoading(false);
  };

  const handlePremiumPayment = async (): Promise<boolean> => {
    if (!user) return false;
    
    setProcessingPayment(true);
    
    try {
      // Create Razorpay order
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

      // Open Razorpay checkout
      return new Promise((resolve) => {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Bestonconnect',
          description: `Premium Promoter ${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Subscription`,
          order_id: orderData.order_id,
          handler: async (response: any) => {
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('premium-subscription', {
              body: {
                action: 'verify_payment',
                user_id: user.id,
                plan_type: selectedPlan,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                referral_code: referralCode || undefined,
              }
            });

            if (verifyError || !verifyData?.success) {
              toast.error('Payment verification failed');
              resolve(false);
            } else {
              toast.success('Payment successful! You are now a premium promoter.');
              resolve(true);
            }
          },
          prefill: {
            email: user.email,
          },
          theme: {
            color: '#7c3aed',
          },
          modal: {
            ondismiss: () => {
              resolve(false);
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      });
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
      return false;
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Block submission if referral code was entered but is invalid
    if (referralCode.trim() && referralValid === false) {
      toast.error('Please enter a valid referral code or clear the field');
      return;
    }

    setSubmitting(true);

    try {
      // Handle premium payment if selected
      if (selectedTier === 'premium') {
        const paymentSuccess = await handlePremiumPayment();
        if (!paymentSuccess) {
          setSubmitting(false);
          return;
        }
      }

      // Create application with referral info if provided
      const { error: appError } = await supabase
        .from('promoter_applications')
        .insert({
          user_id: user.id,
          tier: selectedTier,
          status: 'pending',
          referred_by_promoter_id: referrerPromoterId,
        });

      if (appError) {
        toast.error('Failed to submit application');
        setSubmitting(false);
        return;
      }

      toast.success('Application submitted successfully!');
      fetchExistingApplication();
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  // Show existing application status
  if (existingApp) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {existingApp.status === 'pending' && (
                  <div className="p-4 rounded-full bg-warning/10">
                    <Clock className="h-12 w-12 text-warning" />
                  </div>
                )}
                {existingApp.status === 'approved' && (
                  <div className="p-4 rounded-full bg-success/10">
                    <CheckCircle className="h-12 w-12 text-success" />
                  </div>
                )}
                {existingApp.status === 'rejected' && (
                  <div className="p-4 rounded-full bg-destructive/10">
                    <XCircle className="h-12 w-12 text-destructive" />
                  </div>
                )}
              </div>
              <CardTitle className="text-2xl">
                {existingApp.status === 'pending' && 'Application Under Review'}
                {existingApp.status === 'approved' && 'Application Approved!'}
                {existingApp.status === 'rejected' && 'Application Rejected'}
              </CardTitle>
              <CardDescription>
                {existingApp.status === 'pending' &&
                  (existingApp.reason ||
                    'Your promoter application is being reviewed. We\'ll notify you once a decision is made.')}
                {existingApp.status === 'approved' &&
                  'Congratulations! You are now a promoter. Head to your dashboard to get started.'}
                {existingApp.status === 'rejected' &&
                  (existingApp.reason || 'Unfortunately, your application was not approved.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex justify-center gap-4">
                <Badge variant="outline">
                  Tier: {existingApp.tier || 'free'}
                </Badge>
                <Badge variant={
                  existingApp.status === 'approved' ? 'default' :
                  existingApp.status === 'pending' ? 'secondary' : 'destructive'
                }>
                  {existingApp.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Applied on {new Date(existingApp.created_at).toLocaleDateString()}
              </p>
              {existingApp.status === 'approved' && (
                <Button onClick={() => navigate('/promoter/dashboard')}>
                  Go to Dashboard
                </Button>
              )}
              {existingApp.status === 'rejected' && (
                <Button 
                  onClick={() => {
                    setExistingApp(null);
                    setSelectedTier('free');
                    setReferralCode('');
                    setReferralValid(null);
                    setReferrerPromoterId(null);
                    setReferrerName(null);
                    setReferrerTier(null);
                    setReferrerAvatar(null);
                    setReferrerJoined(null);
                    setReferrerSalesCount(0);
                  }}
                >
                  Reapply as Promoter
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Application History */}
          {applicationHistory.length > 1 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Application History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {applicationHistory.map((app) => (
                    <div 
                      key={app.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        app.id === existingApp?.id ? 'bg-muted/50 border-primary/30' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {app.status === 'pending' && <Clock className="h-4 w-4 text-warning" />}
                        {app.status === 'approved' && <CheckCircle className="h-4 w-4 text-success" />}
                        {app.status === 'rejected' && <XCircle className="h-4 w-4 text-destructive" />}
                        <div>
                          <p className="text-sm font-medium">
                            {app.tier === 'premium' ? 'Premium' : 'Free'} Tier Application
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Applied: {new Date(app.created_at).toLocaleDateString()}
                            {app.reviewed_at && ` • Reviewed: ${new Date(app.reviewed_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        app.status === 'approved' ? 'default' :
                        app.status === 'pending' ? 'secondary' : 'destructive'
                      }>
                        {app.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <UserPlus className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display mb-2">Become a Promoter</h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-4">
            Start earning by promoting products you love. Complete the application below to get started.
          </p>
          <Button variant="outline" onClick={() => navigate('/landing')} className="gap-2">
            <BookOpen className="h-4 w-4" />
            Learn More About Promoter Program
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Premium Disabled Banner */}
          {premiumDisabled && (
            <Card className="border-warning/50 bg-warning/10">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <p className="font-medium text-warning">Monthly premium subscription limit reached</p>
                  <p className="text-sm text-muted-foreground">
                    New premium subscriptions are currently unavailable. Please check back next month or continue with the free tier.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tier Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Select Your Tier
              </CardTitle>
              <CardDescription>
                Choose the tier that best fits your promotion goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={premiumDisabled && selectedTier === 'premium' ? 'free' : selectedTier} 
                onValueChange={(v) => {
                  if (v === 'premium' && premiumDisabled) return;
                  setSelectedTier(v as PromoterTier);
                }}
                className="grid md:grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="free"
                  className={`cursor-pointer rounded-xl border-2 p-6 transition-all ${
                    selectedTier === 'free' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="free" id="free" className="sr-only" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">Free Tier</h3>
                      <Badge variant="secondary">Free</Badge>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        1 product referral link
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        1 video ad upload
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        1-month commission validity
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Max 30% commission rate
                      </li>
                    </ul>
                  </div>
                </Label>

                <Label
                  htmlFor="premium"
                  className={`cursor-pointer rounded-xl border-2 p-6 transition-all ${
                    premiumDisabled
                      ? 'opacity-50 cursor-not-allowed border-border'
                      : selectedTier === 'premium'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="premium" id="premium" className="sr-only" disabled={premiumDisabled} />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">Premium Tier</h3>
                      {premiumDisabled ? (
                        <Badge variant="secondary" className="bg-warning/20 text-warning">Unavailable</Badge>
                      ) : (
                        <Badge className="gradient-hero text-primary-foreground">Premium</Badge>
                      )}
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-earnings" />
                        Unlimited referral links
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-earnings" />
                        Unlimited video ads
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-earnings" />
                        Commission valid for subscription period
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-earnings" />
                        Max 30% commission rate
                      </li>
                    </ul>
                    {premiumDisabled && (
                      <p className="text-xs text-warning mt-2">Monthly limit reached. Check back next month.</p>
                    )}
                  </div>
                </Label>
              </RadioGroup>

              {/* Premium Plan Selection */}
              {selectedTier === 'premium' && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-3">Select Billing Plan</h4>
                  <RadioGroup
                    value={selectedPlan}
                    onValueChange={(v) => setSelectedPlan(v as PlanType)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="monthly"
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        selectedPlan === 'monthly'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="monthly" id="monthly" className="sr-only" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Monthly</p>
                        <div className="flex items-center justify-center gap-1 text-2xl font-bold text-earnings mt-1">
                          <IndianRupee className="h-5 w-5" />
                          <span>{pricing.monthly}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">per month</p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="annual"
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all relative ${
                        selectedPlan === 'annual'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="annual" id="annual" className="sr-only" />
                      <Badge className="absolute -top-2 -right-2 bg-earnings text-white text-xs">
                        Save {Math.round(((pricing.monthly * 12) - pricing.annual) / (pricing.monthly * 12) * 100)}%
                      </Badge>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Annual</p>
                        <div className="flex items-center justify-center gap-1 text-2xl font-bold text-earnings mt-1">
                          <IndianRupee className="h-5 w-5" />
                          <span>{pricing.annual}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">per year</p>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Referral Code (Optional)
              </CardTitle>
              <CardDescription>
                If you were referred by an existing promoter, enter their referral code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="referral-code">Referral Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="referral-code"
                    placeholder="Enter referral code (optional)"
                    value={referralCode}
                    readOnly={referralLocked}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setReferralCode(next);
                      setReferralValid(null);
                      setReferrerPromoterId(null);
                      setReferrerName(null);
                      setReferrerTier(null);
                      setReferrerAvatar(null);
                      setReferrerJoined(null);
                      setReferrerSalesCount(0);
                    }}
                    className={referralValid === true ? 'border-success' : referralValid === false ? 'border-destructive' : ''}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => validateReferralCode(referralCode)}
                    disabled={!referralCode.trim() || validatingReferral}
                  >
                    {validatingReferral ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </div>
                {referralValid === true && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                    <div className="flex items-center gap-3">
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <div className="cursor-pointer">
                            {referrerAvatar ? (
                              <img 
                                src={referrerAvatar} 
                                alt={referrerName || 'Referrer'} 
                                className="h-10 w-10 rounded-full object-cover border-2 border-success/30 hover:border-primary transition-colors"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center hover:bg-success/30 transition-colors">
                                <Users className="h-5 w-5 text-success" />
                              </div>
                            )}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-64" side="top">
                          <div className="flex items-start gap-3">
                            {referrerAvatar ? (
                              <img 
                                src={referrerAvatar} 
                                alt={referrerName || 'Referrer'} 
                                className="h-12 w-12 rounded-full object-cover border-2 border-border"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                <Users className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 space-y-1">
                              <p className="font-semibold text-sm">{referrerName}</p>
                              <Badge 
                                variant={referrerTier === 'premium' ? 'default' : 'secondary'} 
                                className={`text-xs ${referrerTier === 'premium' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : ''}`}
                              >
                                {referrerTier === 'premium' ? (
                                  <span className="flex items-center gap-1">
                                    <Crown className="h-3 w-3" />
                                    Premium
                                  </span>
                                ) : (
                                  'Free'
                                )}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-border space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ShoppingBag className="h-4 w-4" />
                              <span><strong className="text-foreground">{referrerSalesCount}</strong> total sales</span>
                            </div>
                            {referrerJoined && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarDays className="h-4 w-4" />
                                <span>Joined {new Date(referrerJoined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                              </div>
                            )}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                      <div className="flex-1">
                        <p className="text-sm text-success flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>
                            Valid referral code! You'll be linked to <strong>{referrerName}</strong>
                          </span>
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge 
                            variant={referrerTier === 'premium' ? 'default' : 'secondary'} 
                            className={`text-xs ${referrerTier === 'premium' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : ''}`}
                          >
                            {referrerTier === 'premium' ? (
                              <span className="flex items-center gap-1">
                                <Crown className="h-3 w-3" />
                                Premium Promoter
                              </span>
                            ) : (
                              'Free Promoter'
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {referralValid === false && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Invalid referral code. Please check and try again.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button 
            type="submit" 
            size="lg" 
            className="w-full gap-2"
            disabled={submitting || processingPayment || validatingReferral || (referralCode.trim() !== '' && referralValid === false)}
          >
            {submitting || processingPayment ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {processingPayment ? 'Processing Payment...' : 'Submitting...'}
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                {selectedTier === 'premium' 
                  ? `Pay ₹${selectedPlan === 'annual' ? pricing.annual : pricing.monthly} & Submit Application`
                  : 'Submit Application'
                }
              </>
            )}
          </Button>
        </form>

        {/* Application History when reapplying */}
        {applicationHistory.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" />
                Your Previous Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {applicationHistory.map((app) => (
                  <div 
                    key={app.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      {app.status === 'pending' && <Clock className="h-4 w-4 text-warning" />}
                      {app.status === 'approved' && <CheckCircle className="h-4 w-4 text-success" />}
                      {app.status === 'rejected' && <XCircle className="h-4 w-4 text-destructive" />}
                      <div>
                        <p className="text-sm font-medium">
                          {app.tier === 'premium' ? 'Premium' : 'Free'} Tier Application
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Applied: {new Date(app.created_at).toLocaleDateString()}
                          {app.reviewed_at && ` • Reviewed: ${new Date(app.reviewed_at).toLocaleDateString()}`}
                        </p>
                        {app.reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reason: {app.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={
                      app.status === 'approved' ? 'default' :
                      app.status === 'pending' ? 'secondary' : 'destructive'
                    }>
                      {app.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
