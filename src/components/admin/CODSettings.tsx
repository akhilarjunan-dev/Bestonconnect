import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Banknote, Loader2, AlertTriangle, Package } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface CODSettingsData {
  enabled: boolean;
  min_order_amount: number;
  max_order_amount: number;
  allow_cod_self_shipping: boolean;
}

export function CODSettings() {
  const [settings, setSettings] = useState<CODSettingsData>({
    enabled: true,
    min_order_amount: 0,
    max_order_amount: 10000,
    allow_cod_self_shipping: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('order_settings')
      .select('setting_value')
      .eq('setting_key', 'cod_enabled')
      .maybeSingle();

    if (data) {
      const value = data.setting_value as unknown as CODSettingsData;
      setSettings({
        enabled: value?.enabled ?? true,
        min_order_amount: value?.min_order_amount ?? 0,
        max_order_amount: value?.max_order_amount ?? 10000,
        allow_cod_self_shipping: value?.allow_cod_self_shipping ?? false
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const settingValue: CODSettingsData = {
      enabled: settings.enabled,
      min_order_amount: settings.min_order_amount,
      max_order_amount: settings.max_order_amount,
      allow_cod_self_shipping: settings.allow_cod_self_shipping
    };

    // Check if setting exists
    const { data: existing } = await supabase
      .from('order_settings')
      .select('id')
      .eq('setting_key', 'cod_enabled')
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('order_settings')
        .update({
          setting_value: settingValue as unknown as Json,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'cod_enabled');

      if (error) {
        toast.error('Failed to update COD settings');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('order_settings')
        .insert({
          setting_key: 'cod_enabled',
          setting_value: settingValue as unknown as Json,
          description: 'Cash on Delivery settings - enable/disable COD and set order amount limits'
        });

      if (error) {
        toast.error('Failed to create COD settings');
        setSaving(false);
        return;
      }
    }

    toast.success('COD settings updated successfully');
    setSaving(false);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* COD Disabled Warning */}
      {!settings.enabled && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">COD Disabled</p>
                <p className="text-sm text-muted-foreground">
                  Cash on Delivery is currently disabled. Customers can only pay online.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Cash on Delivery Settings
          </CardTitle>
          <CardDescription>
            Configure Cash on Delivery options for your store. Set order limits and enable/disable the feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${settings.enabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                <Banknote className={`h-6 w-6 ${settings.enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="cod-enabled" className="font-medium cursor-pointer">
                    Cash on Delivery
                  </Label>
                  <Badge variant={settings.enabled ? 'default' : 'secondary'}>
                    {settings.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {settings.enabled
                    ? 'Customers can pay cash when their order is delivered'
                    : 'Customers must pay online before order is shipped'}
                </p>
              </div>
            </div>
            <Switch
              id="cod-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          {/* Order Amount Limits */}
          {settings.enabled && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium">Order Amount Limits</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-amount">Minimum Order Amount (₹)</Label>
                  <Input
                    id="min-amount"
                    type="number"
                    min="0"
                    value={settings.min_order_amount}
                    onChange={(e) => setSettings({
                      ...settings,
                      min_order_amount: parseInt(e.target.value) || 0
                    })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Set to 0 for no minimum
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-amount">Maximum Order Amount (₹)</Label>
                  <Input
                    id="max-amount"
                    type="number"
                    min="0"
                    value={settings.max_order_amount}
                    onChange={(e) => setSettings({
                      ...settings,
                      max_order_amount: parseInt(e.target.value) || 0
                    })}
                    placeholder="10000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Set to 0 for no maximum
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                COD will only be available for orders between ₹{settings.min_order_amount.toLocaleString()} 
                {settings.max_order_amount > 0 ? ` and ₹${settings.max_order_amount.toLocaleString()}` : ' (no max limit)'}.
              </p>
            </div>
          )}

          {/* Self-Shipping COD Toggle */}
          {settings.enabled && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${settings.allow_cod_self_shipping ? 'bg-blue-500/10' : 'bg-muted'}`}>
                  <Package className={`h-6 w-6 ${settings.allow_cod_self_shipping ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="cod-self-shipping" className="font-medium cursor-pointer">
                      Allow COD for Self-Shipping Vendors
                    </Label>
                    <Badge variant={settings.allow_cod_self_shipping ? 'default' : 'secondary'}>
                      {settings.allow_cod_self_shipping ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {settings.allow_cod_self_shipping
                      ? 'Self-shipping vendors can offer COD to customers'
                      : 'COD is disabled for self-shipping vendor products (only online payment)'}
                  </p>
                </div>
              </div>
              <Switch
                id="cod-self-shipping"
                checked={settings.allow_cod_self_shipping}
                onCheckedChange={(checked) => setSettings({ ...settings, allow_cod_self_shipping: checked })}
              />
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save COD Settings
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How COD Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• When enabled, customers see a "Cash on Delivery" option at checkout.</p>
          <p>• COD orders are created with status "pending" and marked for cash collection on delivery.</p>
          <p>• Promoter commissions for COD orders are credited only after successful delivery confirmation.</p>
          <p>• Order amount limits help manage risk for high-value COD orders.</p>
        </CardContent>
      </Card>
    </div>
  );
}
