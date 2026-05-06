import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Users, Crown, TrendingUp, Clock, Percent, Package } from 'lucide-react';

interface ReferralSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, number>;
  description: string | null;
}

export function ReferralCommissionSettings() {
  const [settings, setSettings] = useState<ReferralSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form values
  const [subscriptionPercent, setSubscriptionPercent] = useState(10);
  const [salesPercent, setSalesPercent] = useState(5);
  const [tier3Percent, setTier3Percent] = useState(2);
  const [physicalReturnDays, setPhysicalReturnDays] = useState(7);
  const [digitalReturnDays, setDigitalReturnDays] = useState(0);
  const [autoCompleteDays, setAutoCompleteDays] = useState(7);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('referral_commission_settings')
      .select('*')
      .order('setting_key');

    if (error) {
      toast.error('Failed to fetch referral settings');
      setLoading(false);
      return;
    }

    const typedSettings = (data || []).map(s => ({
      ...s,
      setting_value: s.setting_value as Record<string, number>
    }));
    
    setSettings(typedSettings);

    // Populate form values
    typedSettings.forEach(setting => {
      switch (setting.setting_key) {
        case 'subscription_referral_percent':
          setSubscriptionPercent(setting.setting_value.percent || 10);
          break;
        case 'sales_referral_percent':
          setSalesPercent(setting.setting_value.percent || 5);
          break;
        case 'tier3_bonus_percent':
          setTier3Percent(setting.setting_value.percent || 2);
          break;
        case 'return_period_days':
          setPhysicalReturnDays(setting.setting_value.physical || 7);
          setDigitalReturnDays(setting.setting_value.digital || 0);
          break;
        case 'auto_complete_days':
          setAutoCompleteDays(setting.setting_value.days || 7);
          break;
      }
    });

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Update subscription referral percent
      const subscriptionSetting = settings.find(s => s.setting_key === 'subscription_referral_percent');
      if (subscriptionSetting) {
        await supabase
          .from('referral_commission_settings')
          .update({ setting_value: { percent: subscriptionPercent } })
          .eq('id', subscriptionSetting.id);
      }

      // Update sales referral percent
      const salesSetting = settings.find(s => s.setting_key === 'sales_referral_percent');
      if (salesSetting) {
        await supabase
          .from('referral_commission_settings')
          .update({ setting_value: { percent: salesPercent } })
          .eq('id', salesSetting.id);
      }

      // Update tier 3 bonus percent
      const tier3Setting = settings.find(s => s.setting_key === 'tier3_bonus_percent');
      if (tier3Setting) {
        await supabase
          .from('referral_commission_settings')
          .update({ setting_value: { percent: tier3Percent } })
          .eq('id', tier3Setting.id);
      }

      // Update return period days
      const returnSetting = settings.find(s => s.setting_key === 'return_period_days');
      if (returnSetting) {
        await supabase
          .from('referral_commission_settings')
          .update({ setting_value: { physical: physicalReturnDays, digital: digitalReturnDays } })
          .eq('id', returnSetting.id);
      }

      // Update auto-complete days
      const autoCompleteSetting = settings.find(s => s.setting_key === 'auto_complete_days');
      if (autoCompleteSetting) {
        await supabase
          .from('referral_commission_settings')
          .update({ setting_value: { days: autoCompleteDays } })
          .eq('id', autoCompleteSetting.id);
      } else {
        // Create the setting if it doesn't exist
        await supabase
          .from('referral_commission_settings')
          .insert({
            setting_key: 'auto_complete_days',
            setting_value: { days: autoCompleteDays },
            description: 'Days after which shipped orders are automatically marked as completed'
          });
      }

      toast.success('Referral settings updated successfully');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Subscription Referral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Premium Subscription Referral
          </CardTitle>
          <CardDescription>
            Percentage of premium subscription amount credited to the referring promoter when their referred promoter upgrades to premium
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="subscription-percent">Commission Percentage</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="subscription-percent"
                  type="number"
                  min={0}
                  max={100}
                  value={subscriptionPercent}
                  onChange={(e) => setSubscriptionPercent(Number(e.target.value))}
                  className="w-24"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Example: If a referred promoter pays ₹999 for premium and this is set to {subscriptionPercent}%,
                the referrer earns <span className="font-bold text-earnings">₹{(999 * subscriptionPercent / 100).toFixed(2)}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Commission Referral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-earnings" />
            Sales Commission Referral
          </CardTitle>
          <CardDescription>
            Percentage of the referred promoter's sales commission that gets credited to the referring promoter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="sales-percent">Commission Share Percentage</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="sales-percent"
                  type="number"
                  min={0}
                  max={100}
                  value={salesPercent}
                  onChange={(e) => setSalesPercent(Number(e.target.value))}
                  className="w-24"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Example: If a referred promoter earns ₹100 commission and this is set to {salesPercent}%,
                the referrer earns <span className="font-bold text-earnings">₹{(100 * salesPercent / 100).toFixed(2)}</span> extra
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier 3 Bonus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-surge" />
            Tier 3 Referral Bonus
          </CardTitle>
          <CardDescription>
            Extra fixed percentage credited to the referring promoter when their referred promoter reaches Tier 3 status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="tier3-percent">Tier 3 Bonus Percentage</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="tier3-percent"
                  type="number"
                  min={0}
                  max={100}
                  value={tier3Percent}
                  onChange={(e) => setTier3Percent(Number(e.target.value))}
                  className="w-24"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                When a referred promoter achieves Tier 3, their referrer receives an additional {tier3Percent}% bonus on all future commissions from that promoter
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Return Period Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Commission Withdrawal Eligibility
          </CardTitle>
          <CardDescription>
            Set the return period (in days) before commissions become eligible for withdrawal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="physical-days">Physical Products (days)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="physical-days"
                  type="number"
                  min={0}
                  max={90}
                  value={physicalReturnDays}
                  onChange={(e) => setPhysicalReturnDays(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Commissions become withdrawable after {physicalReturnDays} days
              </p>
            </div>
            <div>
              <Label htmlFor="digital-days">Digital Products (days)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="digital-days"
                  type="number"
                  min={0}
                  max={90}
                  value={digitalReturnDays}
                  onChange={(e) => setDigitalReturnDays(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {digitalReturnDays === 0 ? 'Commissions are immediately withdrawable' : `Commissions become withdrawable after ${digitalReturnDays} days`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Complete Orders Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Order Auto-Complete
          </CardTitle>
          <CardDescription>
            Automatically mark shipped orders as completed after a specified number of days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="auto-complete-days">Days After Shipping</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="auto-complete-days"
                  type="number"
                  min={0}
                  max={30}
                  value={autoCompleteDays}
                  onChange={(e) => setAutoCompleteDays(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {autoCompleteDays === 0 
                  ? 'Auto-complete is disabled' 
                  : `Orders auto-complete ${autoCompleteDays} days after shipping`}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Shipped orders will be automatically marked as completed after {autoCompleteDays} days if no manual action is taken. 
                Set to 0 to disable auto-complete.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
