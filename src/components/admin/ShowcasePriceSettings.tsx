import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Save, Loader2, IndianRupee } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface ShowcasePricing {
  monthly: number;
  annual: number;
}

export function ShowcasePriceSettings() {
  const [pricing, setPricing] = useState<ShowcasePricing>({ monthly: 299, annual: 2990 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPrice();
  }, []);

  const fetchPrice = async () => {
    const { data } = await supabase
      .from('subscription_settings')
      .select('*')
      .eq('setting_key', 'showcase_premium_price')
      .maybeSingle();

    if (data?.setting_value) {
      const val = data.setting_value as unknown as ShowcasePricing;
      // Support old format (single amount) and new format (monthly/annual)
      if (val && typeof val.monthly === 'number' && typeof val.annual === 'number') {
        setPricing(val);
      } else if (typeof (data.setting_value as any).amount === 'number') {
        // Migrate old format
        const amount = (data.setting_value as any).amount;
        setPricing({ monthly: amount, annual: amount * 10 });
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (pricing.monthly <= 0 || pricing.annual <= 0) {
      toast.error('Enter valid prices');
      return;
    }
    setSaving(true);

    const { data: existing } = await supabase
      .from('subscription_settings')
      .select('id')
      .eq('setting_key', 'showcase_premium_price')
      .maybeSingle();

    if (existing) {
      await supabase
        .from('subscription_settings')
        .update({ setting_value: pricing as unknown as Json })
        .eq('setting_key', 'showcase_premium_price');
    } else {
      await supabase
        .from('subscription_settings')
        .insert({
          setting_key: 'showcase_premium_price',
          setting_value: pricing as unknown as Json,
          description: 'Monthly and annual pricing for vendor/promoter showcase shops'
        });
    }

    toast.success('Showcase pricing saved');
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          Showcase Subscription Pricing
        </CardTitle>
        <CardDescription>
          Set monthly and annual subscription pricing for vendor/promoter showcase shops (after 5-day free trial).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="showcase-monthly">Monthly Price (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="showcase-monthly"
                type="number"
                className="pl-10"
                value={pricing.monthly}
                onChange={(e) => setPricing({ ...pricing, monthly: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="showcase-annual">Annual Price (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="showcase-annual"
                type="number"
                className="pl-10"
                value={pricing.annual}
                onChange={(e) => setPricing({ ...pricing, annual: Number(e.target.value) })}
              />
            </div>
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
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Pricing
        </Button>
      </CardContent>
    </Card>
  );
}
