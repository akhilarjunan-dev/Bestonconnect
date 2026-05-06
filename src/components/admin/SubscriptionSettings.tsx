import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { IndianRupee, Save, Crown, Ban } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface PremiumPricing {
  monthly: number;
  annual: number;
}

export function SubscriptionSettings() {
  const [pricing, setPricing] = useState<PremiumPricing>({ monthly: 999, annual: 9990 });
  const [premiumDisabled, setPremiumDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
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
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const { error: pricingError } = await supabase
      .from('subscription_settings')
      .update({ setting_value: pricing as unknown as Json })
      .eq('setting_key', 'premium_pricing');

    if (pricingError) {
      toast.error('Failed to update pricing');
      setSaving(false);
      return;
    }

    // Upsert premium_disabled
    const { data: existing } = await supabase
      .from('subscription_settings')
      .select('id')
      .eq('setting_key', 'premium_disabled')
      .maybeSingle();

    if (existing) {
      await supabase
        .from('subscription_settings')
        .update({ setting_value: { disabled: premiumDisabled } as unknown as Json })
        .eq('setting_key', 'premium_disabled');
    } else {
      await supabase.from('subscription_settings').insert({
        setting_key: 'premium_disabled',
        setting_value: { disabled: premiumDisabled } as unknown as Json,
        description: 'Toggle to disable new premium subscriptions',
      });
    }

    toast.success('Settings updated successfully');
    setSaving(false);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Toggle Card */}
      <Card className={premiumDisabled ? 'border-destructive/50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            Disable Premium Subscriptions
          </CardTitle>
          <CardDescription>
            When enabled, new users cannot purchase premium subscriptions (monthly limit reached message is shown)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Switch
              id="premium-disabled"
              checked={premiumDisabled}
              onCheckedChange={setPremiumDisabled}
            />
            <Label htmlFor="premium-disabled" className="cursor-pointer">
              {premiumDisabled ? 'Premium subscriptions are disabled' : 'Premium subscriptions are enabled'}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Premium Subscription Pricing
          </CardTitle>
          <CardDescription>
            Set the pricing for premium promoter subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="monthly">Monthly Price (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="monthly"
                  type="number"
                  className="pl-10"
                  value={pricing.monthly}
                  onChange={(e) => setPricing({ ...pricing, monthly: Number(e.target.value) })}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Price charged monthly for premium tier
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual">Annual Price (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="annual"
                  type="number"
                  className="pl-10"
                  value={pricing.annual}
                  onChange={(e) => setPricing({ ...pricing, annual: Number(e.target.value) })}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Price charged annually (typically discounted)
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">Savings Preview</h4>
            <p className="text-sm text-muted-foreground">
              Annual plan saves ₹{(pricing.monthly * 12) - pricing.annual}{' '}
              ({Math.round(((pricing.monthly * 12) - pricing.annual) / (pricing.monthly * 12) * 100)}% off)
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}