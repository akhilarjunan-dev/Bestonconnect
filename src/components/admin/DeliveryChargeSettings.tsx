import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Truck, Loader2, Save, Plus, Trash2 } from 'lucide-react';

interface ShippingSlab {
  max_weight_grams: number;
  charge: number;
}

interface ShippingConfig {
  slabs: ShippingSlab[];
  extra_per_kg: number;
  free_above: number;
  half_discount_above: number;
}

const DEFAULT_CONFIG: ShippingConfig = {
  slabs: [
    { max_weight_grams: 500, charge: 60 },
    { max_weight_grams: 1000, charge: 80 },
    { max_weight_grams: 2000, charge: 120 },
  ],
  extra_per_kg: 40,
  free_above: 2500,
  half_discount_above: 1000,
};

export function DeliveryChargeSettings() {
  const [config, setConfig] = useState<ShippingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('order_settings')
      .select('setting_value')
      .eq('setting_key', 'shipping_charge_config')
      .maybeSingle();

    if (data?.setting_value) {
      const val = data.setting_value as unknown as ShippingConfig;
      setConfig({
        slabs: val.slabs || DEFAULT_CONFIG.slabs,
        extra_per_kg: val.extra_per_kg ?? DEFAULT_CONFIG.extra_per_kg,
        free_above: val.free_above ?? DEFAULT_CONFIG.free_above,
        half_discount_above: val.half_discount_above ?? DEFAULT_CONFIG.half_discount_above,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    // Upsert the setting
    const { data: existing } = await supabase
      .from('order_settings')
      .select('id')
      .eq('setting_key', 'shipping_charge_config')
      .maybeSingle();

    let error;
    const jsonValue = JSON.parse(JSON.stringify(config));
    if (existing) {
      ({ error } = await supabase
        .from('order_settings')
        .update({ setting_value: jsonValue })
        .eq('setting_key', 'shipping_charge_config'));
    } else {
      ({ error } = await supabase
        .from('order_settings')
        .insert([{
          setting_key: 'shipping_charge_config',
          setting_value: jsonValue,
          description: 'Shipping charge slab configuration',
        }]));
    }

    setSaving(false);
    if (error) {
      toast.error('Failed to save shipping settings');
    } else {
      toast.success('Shipping charge settings saved');
    }
  };

  const addSlab = () => {
    const lastSlab = config.slabs[config.slabs.length - 1];
    setConfig({
      ...config,
      slabs: [...config.slabs, { max_weight_grams: (lastSlab?.max_weight_grams || 0) + 1000, charge: (lastSlab?.charge || 0) + 40 }],
    });
  };

  const removeSlab = (index: number) => {
    setConfig({ ...config, slabs: config.slabs.filter((_, i) => i !== index) });
  };

  const updateSlab = (index: number, field: keyof ShippingSlab, value: number) => {
    const updated = [...config.slabs];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, slabs: updated });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Delivery Charge Settings
        </CardTitle>
        <CardDescription>
          Configure weight-based shipping slabs and order-amount discounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weight Slabs */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Weight-Based Slabs</Label>
          <p className="text-xs text-muted-foreground">
            Define shipping charge for each weight range. The last slab acts as the base for heavier packages.
          </p>
          {config.slabs.map((slab, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Up to (grams)</Label>
                <Input
                  type="number"
                  value={slab.max_weight_grams}
                  onChange={(e) => updateSlab(i, 'max_weight_grams', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Charge (₹)</Label>
                <Input
                  type="number"
                  value={slab.charge}
                  onChange={(e) => updateSlab(i, 'charge', parseInt(e.target.value) || 0)}
                />
              </div>
              <Button variant="ghost" size="icon" className="mt-5" onClick={() => removeSlab(i)} disabled={config.slabs.length <= 1}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSlab} className="gap-1">
            <Plus className="h-4 w-4" /> Add Slab
          </Button>
        </div>

        {/* Extra per kg */}
        <div className="space-y-2">
          <Label>Extra Charge per Additional KG (₹)</Label>
          <Input
            type="number"
            value={config.extra_per_kg}
            onChange={(e) => setConfig({ ...config, extra_per_kg: parseInt(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">
            Applied for weight above the last slab's max weight.
          </p>
        </div>

        {/* Discount thresholds */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Free Delivery Above (₹)</Label>
            <Input
              type="number"
              value={config.free_above}
              onChange={(e) => setConfig({ ...config, free_above: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">Orders above this amount get free delivery. Set 0 to disable.</p>
          </div>
          <div className="space-y-2">
            <Label>50% Discount Above (₹)</Label>
            <Input
              type="number"
              value={config.half_discount_above}
              onChange={(e) => setConfig({ ...config, half_discount_above: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">Orders above this amount get 50% off delivery. Set 0 to disable.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
