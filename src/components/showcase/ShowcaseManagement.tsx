import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Store, Image, Link as LinkIcon, Copy, ExternalLink, Loader2, Crown, Clock, Package, Upload, X, Search, IndianRupee, CreditCard, Zap } from 'lucide-react';
import { differenceInDays, differenceInHours } from 'date-fns';

interface Product {
  id: string;
  name: string;
  price: number;
  image_urls: string[] | null;
  is_active: boolean;
}

interface ShowcaseShop {
  id: string;
  shop_name: string;
  owner_type: string;
  banner_url: string | null;
  selected_product_ids: string[];
  is_active: boolean;
  trial_started_at: string;
  trial_ends_at: string;
  is_premium: boolean;
  premium_paid_at: string | null;
  subscription_plan_type: string | null;
  subscription_expires_at: string | null;
  subscription_auto_renew: boolean;
}

interface ShowcasePricing {
  monthly: number;
  annual: number;
}

interface Props {
  ownerType: 'vendor' | 'promoter';
}

export function ShowcaseManagement({ ownerType }: Props) {
  const { user } = useAuth();
  const [shop, setShop] = useState<ShowcaseShop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopName, setShopName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pricing, setPricing] = useState<ShowcasePricing>({ monthly: 299, annual: 2990 });
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchShop(), fetchProducts(), fetchPricing()]);
    setLoading(false);
  };

  const fetchShop = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('showcase_shops')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setShop(data as unknown as ShowcaseShop);
      setShopName(data.shop_name);
      setSelectedIds((data.selected_product_ids as string[]) || []);
      setBannerUrl(data.banner_url);
    }
  };

  const fetchProducts = async () => {
    if (!user) return;
    if (ownerType === 'vendor') {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_urls, is_active')
        .eq('vendor_id', user.id)
        .eq('is_active', true)
        .order('name');
      setProducts(data || []);
    } else {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_urls, is_active')
        .eq('is_active', true)
        .order('name');
      setProducts(data || []);
    }
  };

  const fetchPricing = async () => {
    const { data } = await supabase
      .from('subscription_settings')
      .select('setting_value')
      .eq('setting_key', 'showcase_premium_price')
      .maybeSingle();
    if (data?.setting_value) {
      const val = data.setting_value as unknown as ShowcasePricing;
      if (val && typeof val.monthly === 'number' && typeof val.annual === 'number') {
        setPricing(val);
      } else if (typeof (data.setting_value as any).amount === 'number') {
        const amount = (data.setting_value as any).amount;
        setPricing({ monthly: amount, annual: amount * 10 });
      }
    }
  };

  const sanitizeShopName = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const handleCreate = async () => {
    if (!user || !shopName.trim()) {
      toast.error('Please enter a shop name');
      return;
    }
    const sanitized = sanitizeShopName(shopName);
    if (sanitized.length < 3) {
      toast.error('Shop name must be at least 3 characters');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('showcase_shops')
      .insert({
        user_id: user.id,
        shop_name: sanitized,
        owner_type: ownerType,
        selected_product_ids: selectedIds,
        banner_url: bannerUrl,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('This shop name is already taken. Try another.');
      } else {
        toast.error('Failed to create showcase shop');
      }
      setSaving(false);
      return;
    }
    setShop(data as unknown as ShowcaseShop);
    setShopName(data.shop_name);
    toast.success('Showcase shop created! 5-day free trial started.');
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!user || !shop) return;
    setSaving(true);
    const { error } = await supabase
      .from('showcase_shops')
      .update({ selected_product_ids: selectedIds, banner_url: bannerUrl })
      .eq('id', shop.id);
    if (error) {
      toast.error('Failed to update showcase');
    } else {
      toast.success('Showcase updated!');
      fetchShop();
    }
    setSaving(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('showcase-banners').upload(filePath, file);
    if (error) { toast.error('Failed to upload banner'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('showcase-banners').getPublicUrl(filePath);
    setBannerUrl(urlData.publicUrl);
    setUploading(false);
  };

  const removeBanner = () => setBannerUrl(null);

  const toggleProduct = (productId: string) => {
    setSelectedIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const getTrialStatus = () => {
    if (!shop) return null;
    // Check subscription-based premium
    if (shop.is_premium) {
      if (shop.subscription_expires_at) {
        const expiresAt = new Date(shop.subscription_expires_at);
        const now = new Date();
        if (now > expiresAt) {
          return { status: 'subscription_expired' as const, text: 'Subscription Expired' };
        }
        const daysLeft = differenceInDays(expiresAt, now);
        return {
          status: 'premium' as const,
          text: `Premium (${daysLeft} days left)`,
          daysLeft,
        };
      }
      return { status: 'premium' as const, text: 'Premium Active' };
    }
    const now = new Date();
    const endsAt = new Date(shop.trial_ends_at);
    if (now > endsAt) return { status: 'expired' as const, text: 'Trial Expired' };
    const hoursLeft = differenceInHours(endsAt, now);
    const daysLeft = differenceInDays(endsAt, now);
    return {
      status: 'trial' as const,
      text: daysLeft > 0 ? `${daysLeft} day${daysLeft > 1 ? 's' : ''} left` : `${hoursLeft} hours left`
    };
  };

  const handleUpgradeToPremium = async () => {
    if (!shop || !user) return;
    setProcessing(true);

    try {
      const amount = selectedPlan === 'annual' ? pricing.annual : pricing.monthly;

      const { data: orderData, error: orderError } = await supabase.functions.invoke('razorpay', {
        body: {
          amount,
          currency: 'INR',
          receipt: `showcase_${shop.id.substring(0, 8)}`,
          notes: { type: 'showcase_premium', shop_id: shop.id, user_id: user.id, plan_type: selectedPlan }
        }
      });

      if (orderError || !orderData?.order) {
        throw new Error('Failed to create payment order');
      }

      const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKeyId) {
        throw new Error('Payment not configured');
      }

      const durationDays = selectedPlan === 'annual' ? 365 : 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      const options = {
        key: razorpayKeyId,
        amount: orderData.order.amount,
        currency: 'INR',
        name: 'Showcase Premium',
        description: `${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Showcase Subscription`,
        order_id: orderData.order.id,
        handler: async (response: any) => {
          const { error } = await supabase
            .from('showcase_shops')
            .update({
              is_premium: true,
              premium_paid_at: new Date().toISOString(),
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              subscription_plan_type: selectedPlan,
              subscription_expires_at: expiresAt.toISOString(),
              subscription_auto_renew: false,
            })
            .eq('id', shop.id);

          if (error) {
            toast.error('Payment received but failed to update. Contact support.');
          } else {
            toast.success('Upgraded to Premium! Your showcase is now active.');
            setUpgradeDialogOpen(false);
            fetchShop();
          }
        },
        prefill: { email: user.email },
        theme: { color: '#6366f1' },
        modal: { ondismiss: () => setProcessing(false) }
      };

      const win = window as any;
      if (win.Razorpay) {
        const rzp = new win.Razorpay(options);
        rzp.open();
      } else {
        throw new Error('Payment SDK not loaded. Refresh and try again.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const shopUrl = shop ? `${window.location.origin}/shop/${shop.shop_name}` : '';
  const trialStatus = getTrialStatus();
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const needsSubscription = trialStatus?.status === 'expired' || trialStatus?.status === 'subscription_expired';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            My Showcase Shop
          </CardTitle>
          <CardDescription>
            {ownerType === 'vendor'
              ? 'Create a dedicated page to showcase your products'
              : 'Create a showcase page with products you want to promote'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Status & Link */}
      {shop && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant={
                trialStatus?.status === 'premium' ? 'default' :
                trialStatus?.status === 'expired' || trialStatus?.status === 'subscription_expired' ? 'destructive' : 'secondary'
              } className="gap-1">
                {trialStatus?.status === 'premium' && <Crown className="w-3 h-3" />}
                {trialStatus?.status === 'trial' && <Clock className="w-3 h-3" />}
                {trialStatus?.text}
              </Badge>
              {needsSubscription && (
                <Button size="sm" onClick={() => setUpgradeDialogOpen(true)} className="gap-1">
                  <Zap className="w-4 h-4" />
                  Subscribe to Premium
                </Button>
              )}
              {trialStatus?.status === 'premium' && trialStatus.daysLeft !== undefined && trialStatus.daysLeft <= 5 && (
                <Button size="sm" variant="outline" onClick={() => setUpgradeDialogOpen(true)} className="gap-1">
                  <CreditCard className="w-4 h-4" />
                  Renew Subscription
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input value={shopUrl} readOnly className="font-mono text-sm" />
              <Button size="icon" variant="outline" onClick={() => {
                navigator.clipboard.writeText(shopUrl);
                toast.success('Link copied!');
              }}><Copy className="w-4 h-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => window.open(shopUrl, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Shop */}
      {!shop && (
        <Card>
          <CardHeader>
            <CardTitle>Create Your Shop</CardTitle>
            <CardDescription>Choose a unique name for your showcase page. You get 5 days free!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Shop Name (URL-friendly)</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{window.location.origin}/shop/</span>
                <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="my-shop-name" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Only lowercase letters, numbers, and hyphens. Min 3 characters.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Image className="w-5 h-5" />Shop Banner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {bannerUrl ? (
            <div className="relative">
              <img src={bannerUrl} alt="Banner" className="w-full h-40 object-cover rounded-lg" />
              <Button size="icon" variant="destructive" className="absolute top-2 right-2" onClick={removeBanner}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload banner image</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
          {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
        </CardContent>
      </Card>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Select Products ({selectedIds.length} selected)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
            {filteredProducts.map(product => (
              <label key={product.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox checked={selectedIds.includes(product.id)} onCheckedChange={() => toggleProduct(product.id)} />
                {product.image_urls?.[0] ? (
                  <img src={product.image_urls[0]} alt={product.name} className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">₹{product.price.toLocaleString()}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save / Create */}
      <div className="flex justify-end">
        <Button onClick={shop ? handleUpdate : handleCreate} disabled={saving} size="lg" className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {shop ? 'Save Changes' : 'Create Showcase Shop'}
        </Button>
      </div>

      {/* Upgrade Dialog - Monthly/Yearly */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe to Showcase Premium</DialogTitle>
            <DialogDescription>Choose your subscription plan to keep your showcase active</DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={selectedPlan}
            onValueChange={(v) => setSelectedPlan(v as 'monthly' | 'annual')}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="showcase-monthly"
              className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${selectedPlan === 'monthly' ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <RadioGroupItem value="monthly" id="showcase-monthly" className="sr-only" />
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
              htmlFor="showcase-annual"
              className={`cursor-pointer rounded-lg border-2 p-4 transition-all relative ${selectedPlan === 'annual' ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <RadioGroupItem value="annual" id="showcase-annual" className="sr-only" />
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
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpgradeToPremium} disabled={processing}>
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" />Pay ₹{selectedPlan === 'annual' ? pricing.annual : pricing.monthly}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
