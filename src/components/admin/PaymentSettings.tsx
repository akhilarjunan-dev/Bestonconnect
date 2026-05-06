import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CreditCard, AlertTriangle, TestTube, Loader2, ShieldCheck } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';
import { CODSettings } from './CODSettings';

interface PaymentSettingsData {
  razorpay_test_mode: boolean;
}

export function PaymentSettings() {
  const [settings, setSettings] = useState<PaymentSettingsData>({ razorpay_test_mode: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('subscription_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'razorpay_test_mode')
      .maybeSingle();

    if (data) {
      const value = data.setting_value as unknown as { enabled: boolean };
      setSettings({ razorpay_test_mode: !!value?.enabled });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    // Check if setting exists
    const { data: existing } = await supabase
      .from('subscription_settings')
      .select('id')
      .eq('setting_key', 'razorpay_test_mode')
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('subscription_settings')
        .update({ 
          setting_value: { enabled: settings.razorpay_test_mode } as unknown as Json,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'razorpay_test_mode');

      if (error) {
        toast.error('Failed to update payment settings');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('subscription_settings')
        .insert({
          setting_key: 'razorpay_test_mode',
          setting_value: { enabled: settings.razorpay_test_mode } as unknown as Json,
          description: 'Toggle to switch between Razorpay test and live mode'
        });

      if (error) {
        toast.error('Failed to create payment settings');
        setSaving(false);
        return;
      }
    }

    toast.success('Payment settings updated successfully');
    setSaving(false);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Test Mode Warning */}
      {settings.razorpay_test_mode && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">Test Mode Active</p>
                <p className="text-sm text-muted-foreground">
                  Razorpay is currently in test mode. No real payments will be processed. 
                  Use test card numbers to simulate payments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Mode Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Razorpay Payment Mode
          </CardTitle>
          <CardDescription>
            Switch between test and live payment processing. Test mode uses Razorpay's sandbox environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${settings.razorpay_test_mode ? 'bg-warning/10' : 'bg-green-500/10'}`}>
                {settings.razorpay_test_mode ? (
                  <TestTube className="h-6 w-6 text-warning" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-green-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="test-mode" className="font-medium cursor-pointer">
                    {settings.razorpay_test_mode ? 'Test Mode' : 'Live Mode'}
                  </Label>
                  <Badge variant={settings.razorpay_test_mode ? 'secondary' : 'default'}>
                    {settings.razorpay_test_mode ? 'Sandbox' : 'Production'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {settings.razorpay_test_mode 
                    ? 'Using test API keys - no real charges will be made'
                    : 'Using live API keys - real payments are being processed'}
                </p>
              </div>
            </div>
            <Switch
              id="test-mode"
              checked={settings.razorpay_test_mode}
              onCheckedChange={(checked) => setSettings({ ...settings, razorpay_test_mode: checked })}
            />
          </div>

          {/* Test Card Info */}
          {settings.razorpay_test_mode && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Test Card Numbers
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-mono bg-muted px-2 py-0.5 rounded">4111 1111 1111 1111</span> - Successful payment</p>
                <p><span className="font-mono bg-muted px-2 py-0.5 rounded">4000 0000 0000 0002</span> - Declined card</p>
                <p className="text-xs mt-2">Use any future expiry date and any 3-digit CVV</p>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Payment Settings
          </Button>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            • API keys are stored securely in Supabase Edge Function secrets and are not exposed to the frontend.
          </p>
          <p>
            • When test mode is enabled, the edge function will use <code className="bg-muted px-1 rounded">RAZORPAY_KEY_ID_TEST</code> and <code className="bg-muted px-1 rounded">RAZORPAY_KEY_SECRET_TEST</code> secrets.
          </p>
          <p>
            • When live mode is enabled, the edge function will use <code className="bg-muted px-1 rounded">RAZORPAY_KEY_ID</code> and <code className="bg-muted px-1 rounded">RAZORPAY_KEY_SECRET</code> secrets.
          </p>
          <p>
            • Make sure both test and live API keys are configured in Supabase Edge Function secrets before switching modes.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* COD Settings Section */}
      <CODSettings />
    </div>
  );
}
