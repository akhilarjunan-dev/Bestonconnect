import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Truck, Settings, MapPin, CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

interface DefaultPickupLocation {
  business_name: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_pincode: string;
  pickup_phone: string;
  pickup_email: string;
}

export function DelhiverySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [autoCreate, setAutoCreate] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [pickupLocation, setPickupLocation] = useState<DefaultPickupLocation>({
    business_name: '',
    pickup_address: '',
    pickup_city: '',
    pickup_state: '',
    pickup_pincode: '',
    pickup_phone: '',
    pickup_email: ''
  });

  useEffect(() => {
    fetchSettings();
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const { data } = await supabase.functions.invoke('delhivery', {
        body: { action: 'check_status' }
      });
      setIsConfigured(data?.configured || false);
    } catch (err) {
      console.error('Error checking Delhivery config:', err);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('delhivery_settings')
      .select('*');

    if (error) {
      toast.error('Failed to fetch settings');
      setLoading(false);
      return;
    }

    // Parse settings
    data?.forEach(setting => {
      if (setting.setting_key === 'delhivery_enabled') {
        setIsEnabled((setting.setting_value as unknown as { enabled?: boolean })?.enabled || false);
      }
      if (setting.setting_key === 'auto_create_shipment') {
        setAutoCreate((setting.setting_value as unknown as { enabled?: boolean })?.enabled || false);
      }
      if (setting.setting_key === 'default_pickup_location') {
        const val = setting.setting_value as unknown as DefaultPickupLocation;
        if (val && val.business_name) {
          setPickupLocation(val);
        }
      }
    });

    setLoading(false);
  };

  const updateSetting = async (key: string, value: unknown) => {
    setSaving(true);
    const { error } = await supabase
      .from('delhivery_settings')
      .update({ setting_value: value as never })
      .eq('setting_key', key);

    if (error) {
      toast.error('Failed to save setting');
    } else {
      toast.success('Setting saved');
    }
    setSaving(false);
  };

  const handleToggleEnabled = async (checked: boolean) => {
    setIsEnabled(checked);
    await updateSetting('delhivery_enabled', { enabled: checked });
  };

  const handleToggleAutoCreate = async (checked: boolean) => {
    setAutoCreate(checked);
    await updateSetting('auto_create_shipment', { enabled: checked });
  };

  const handleSavePickupLocation = async () => {
    await updateSetting('default_pickup_location', pickupLocation as unknown as Record<string, unknown>);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delhivery', {
        body: { action: 'check_status' }
      });

      if (error) throw error;

      if (data?.configured) {
        toast.success('Delhivery API connection successful!');
      } else {
        toast.error('Delhivery API not configured properly');
      }
    } catch (err) {
      console.error('Test error:', err);
      toast.error('Failed to connect to Delhivery API');
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Delhivery Integration</CardTitle>
                <CardDescription>
                  Automate order fulfillment with Delhivery One API
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <Badge variant="outline" className="bg-earnings/10 text-earnings border-earnings/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Configured
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Enable Delhivery Integration</p>
                <p className="text-sm text-muted-foreground">
                  When enabled, orders can be shipped via Delhivery
                </p>
              </div>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleEnabled}
              disabled={!isConfigured}
            />
          </div>

          {!isConfigured && (
            <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">API Keys Required</p>
                  <p className="text-sm text-muted-foreground">
                    Please add DELHIVERY_API_KEY and DELHIVERY_CLIENT_NAME to your Supabase secrets.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Create Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Automation Settings</CardTitle>
          <CardDescription>
            Configure automatic shipment creation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Auto-create Shipments</p>
                <p className="text-sm text-muted-foreground">
                  Automatically create Delhivery shipment when order is placed
                </p>
              </div>
            </div>
            <Switch
              checked={autoCreate}
              onCheckedChange={handleToggleAutoCreate}
              disabled={!isEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Default Pickup Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Default Pickup Location
          </CardTitle>
          <CardDescription>
            Used for orders without a specific vendor pickup address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                value={pickupLocation.business_name}
                onChange={(e) => setPickupLocation({ ...pickupLocation, business_name: e.target.value })}
                placeholder="Your Business Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_phone">Phone Number</Label>
              <Input
                id="pickup_phone"
                value={pickupLocation.pickup_phone}
                onChange={(e) => setPickupLocation({ ...pickupLocation, pickup_phone: e.target.value })}
                placeholder="10-digit phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_address">Address</Label>
            <Input
              id="pickup_address"
              value={pickupLocation.pickup_address}
              onChange={(e) => setPickupLocation({ ...pickupLocation, pickup_address: e.target.value })}
              placeholder="Street address"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pickup_city">City</Label>
              <Input
                id="pickup_city"
                value={pickupLocation.pickup_city}
                onChange={(e) => setPickupLocation({ ...pickupLocation, pickup_city: e.target.value })}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_state">State</Label>
              <Input
                id="pickup_state"
                value={pickupLocation.pickup_state}
                onChange={(e) => setPickupLocation({ ...pickupLocation, pickup_state: e.target.value })}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_pincode">Pincode</Label>
              <Input
                id="pickup_pincode"
                value={pickupLocation.pickup_pincode}
                onChange={(e) => setPickupLocation({ ...pickupLocation, pickup_pincode: e.target.value })}
                placeholder="6-digit pincode"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_email">Email (Optional)</Label>
            <Input
              id="pickup_email"
              type="email"
              value={pickupLocation.pickup_email}
              onChange={(e) => setPickupLocation({ ...pickupLocation, pickup_email: e.target.value })}
              placeholder="business@email.com"
            />
          </div>

          <Separator />

          <Button onClick={handleSavePickupLocation} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save Pickup Location
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
