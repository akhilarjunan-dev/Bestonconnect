import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Loader2, Save, RotateCcw, RefreshCw, XCircle } from 'lucide-react';

interface OrderSettings {
  return_period_days: number;
  replacement_period_days: number;
  cancel_period_hours: number;
}

export function OrderSettingsManagement() {
  const [settings, setSettings] = useState<OrderSettings>({
    return_period_days: 7,
    replacement_period_days: 7,
    cancel_period_hours: 24
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('order_settings')
      .select('setting_key, setting_value');

    if (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load order settings');
    } else if (data) {
      const newSettings: OrderSettings = { ...settings };
      data.forEach((item) => {
        const key = item.setting_key as keyof OrderSettings;
        if (key in newSettings) {
          newSettings[key] = Number(item.setting_value);
        }
      });
      setSettings(newSettings);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    const updates = [
      { setting_key: 'return_period_days', setting_value: settings.return_period_days.toString() },
      { setting_key: 'replacement_period_days', setting_value: settings.replacement_period_days.toString() },
      { setting_key: 'cancel_period_hours', setting_value: settings.cancel_period_hours.toString() }
    ];

    let hasError = false;
    for (const update of updates) {
      const { error } = await supabase
        .from('order_settings')
        .update({ setting_value: update.setting_value })
        .eq('setting_key', update.setting_key);
      
      if (error) {
        console.error('Error updating setting:', error);
        hasError = true;
      }
    }

    setSaving(false);
    if (hasError) {
      toast.error('Failed to save some settings');
    } else {
      toast.success('Order settings saved successfully');
    }
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
          <Settings className="h-5 w-5" />
          Order Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Configure the time periods for return, replacement, and cancellation requests after order delivery.
        </p>
        
        <div className="grid gap-6 md:grid-cols-3">
          {/* Return Period */}
          <div className="space-y-2">
            <Label htmlFor="return_period" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              Return Period (Days)
            </Label>
            <Input
              id="return_period"
              type="number"
              min={0}
              max={30}
              value={settings.return_period_days}
              onChange={(e) => setSettings({ ...settings, return_period_days: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              Days after delivery for return requests
            </p>
          </div>

          {/* Replacement Period */}
          <div className="space-y-2">
            <Label htmlFor="replacement_period" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Replacement Period (Days)
            </Label>
            <Input
              id="replacement_period"
              type="number"
              min={0}
              max={30}
              value={settings.replacement_period_days}
              onChange={(e) => setSettings({ ...settings, replacement_period_days: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              Days after delivery for replacement requests
            </p>
          </div>

          {/* Cancel Period */}
          <div className="space-y-2">
            <Label htmlFor="cancel_period" className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-primary" />
              Cancel Period (Hours)
            </Label>
            <Input
              id="cancel_period"
              type="number"
              min={0}
              max={72}
              value={settings.cancel_period_hours}
              onChange={(e) => setSettings({ ...settings, cancel_period_hours: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              Hours after delivery to cancel order
            </p>
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
