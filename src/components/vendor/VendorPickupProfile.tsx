import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { MapPin, Truck, Loader2, CheckCircle, Save, Hand, PackageCheck, Zap, X } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

interface VendorProfile {
  id?: string;
  user_id: string;
  business_name: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_pincode: string;
  pickup_phone: string;
  pickup_email?: string;
  gstin?: string;
  whatsapp_number?: string;
  delivery_type: string;
  coverage_pincodes: string[];
  coverage_states: string[];
}

export function VendorPickupProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<VendorProfile>({
    user_id: '',
    business_name: '',
    pickup_address: '',
    pickup_city: '',
    pickup_state: '',
    pickup_pincode: '',
    pickup_phone: '',
    pickup_email: '',
    gstin: '',
    whatsapp_number: '',
    delivery_type: 'auto_shipping',
    coverage_pincodes: [],
    coverage_states: []
  });
  const [hasProfile, setHasProfile] = useState(false);
  const [newPincode, setNewPincode] = useState('');
  const [newState, setNewState] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      toast.error('Failed to load profile');
      console.error(error);
    }

    if (data) {
      setProfile({
        ...data,
        coverage_pincodes: (data as any).coverage_pincodes || [],
        coverage_states: (data as any).coverage_states || [],
        delivery_type: (data as any).delivery_type || 'auto_shipping'
      });
      setHasProfile(true);
    } else {
      setProfile(prev => ({ ...prev, user_id: user.id }));
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!profile.business_name || !profile.pickup_address || !profile.pickup_city || 
        !profile.pickup_state || !profile.pickup_pincode || !profile.pickup_phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (profile.delivery_type === 'in_hand' && profile.coverage_pincodes.length === 0) {
      toast.error('Please add at least one pincode for In-Hand delivery');
      return;
    }

    if (profile.delivery_type === 'self_shipping' && profile.coverage_states.length === 0) {
      toast.error('Please add at least one state for Self Shipping');
      return;
    }

    setSaving(true);

    const profileData = {
      ...profile,
      user_id: user.id
    };

    let result;
    if (hasProfile && profile.id) {
      result = await supabase
        .from('vendor_profiles')
        .update(profileData as any)
        .eq('id', profile.id);
    } else {
      result = await supabase
        .from('vendor_profiles')
        .insert(profileData as any)
        .select()
        .single();
      
      if (result.data) {
        setProfile(result.data as any);
        setHasProfile(true);
      }
    }

    if (result.error) {
      toast.error('Failed to save profile');
      console.error(result.error);
    } else {
      toast.success('Profile saved successfully');
    }

    setSaving(false);
  };

  const addPincode = () => {
    const pin = newPincode.trim();
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast.error('Please enter a valid 6-digit pincode');
      return;
    }
    if (profile.coverage_pincodes.includes(pin)) {
      toast.error('Pincode already added');
      return;
    }
    setProfile(prev => ({ ...prev, coverage_pincodes: [...prev.coverage_pincodes, pin] }));
    setNewPincode('');
  };

  const removePincode = (pin: string) => {
    setProfile(prev => ({ ...prev, coverage_pincodes: prev.coverage_pincodes.filter(p => p !== pin) }));
  };

  const addState = () => {
    const state = newState.trim();
    if (!state) {
      toast.error('Please select a state');
      return;
    }
    if (profile.coverage_states.includes(state)) {
      toast.error('State already added');
      return;
    }
    setProfile(prev => ({ ...prev, coverage_states: [...prev.coverage_states, state] }));
    setNewState('');
  };

  const removeState = (state: string) => {
    setProfile(prev => ({ ...prev, coverage_states: prev.coverage_states.filter(s => s !== state) }));
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
      {/* Delivery Type Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Delivery Type</CardTitle>
              <CardDescription>Choose how you want to deliver products to customers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={profile.delivery_type}
            onValueChange={(val) => setProfile(prev => ({ ...prev, delivery_type: val }))}
            className="space-y-4"
          >
            <div className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-colors ${profile.delivery_type === 'in_hand' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="in_hand" id="in_hand" className="mt-1" />
              <Label htmlFor="in_hand" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <Hand className="h-4 w-4 text-primary" />
                  <span className="font-semibold">In-Hand Delivery</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You personally deliver to customers within specific pincodes. Only shoppers with matching pincodes can see and purchase your products.
                </p>
              </Label>
            </div>

            <div className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-colors ${profile.delivery_type === 'self_shipping' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="self_shipping" id="self_shipping" className="mt-1" />
              <Label htmlFor="self_shipping" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <PackageCheck className="h-4 w-4 text-info" />
                  <span className="font-semibold">Self Shipping</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You arrange shipping via courier/delivery partner to specific states. Only shoppers in those states can see and purchase your products.
                </p>
              </Label>
            </div>

            <div className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-colors ${profile.delivery_type === 'auto_shipping' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="auto_shipping" id="auto_shipping" className="mt-1" />
              <Label htmlFor="auto_shipping" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-earnings" />
                  <span className="font-semibold">Auto Shipping (Delhivery)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Delivery is handled automatically via Delhivery. Products are available to all shoppers across India.
                </p>
              </Label>
            </div>
          </RadioGroup>

          {/* Coverage Pincodes for In-Hand */}
          {profile.delivery_type === 'in_hand' && (
            <div className="mt-6 space-y-3">
              <Label className="font-semibold">Coverage Pincodes</Label>
              <p className="text-sm text-muted-foreground">Add pincodes where you can personally deliver</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 6-digit pincode"
                  value={newPincode}
                  onChange={(e) => setNewPincode(e.target.value)}
                  maxLength={6}
                  className="max-w-[200px]"
                  onKeyDown={(e) => e.key === 'Enter' && addPincode()}
                />
                <Button variant="outline" size="sm" onClick={addPincode}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.coverage_pincodes.map(pin => (
                  <Badge key={pin} variant="secondary" className="gap-1 pr-1">
                    {pin}
                    <button onClick={() => removePincode(pin)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {profile.coverage_pincodes.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No pincodes added yet</p>
                )}
              </div>
            </div>
          )}

          {/* Coverage States for Self Shipping */}
          {profile.delivery_type === 'self_shipping' && (
            <div className="mt-6 space-y-3">
              <Label className="font-semibold">Coverage States</Label>
              <p className="text-sm text-muted-foreground">Add states where you can ship products</p>
              <div className="flex gap-2">
                <select
                  value={newState}
                  onChange={(e) => setNewState(e.target.value)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-w-[250px]"
                >
                  <option value="">Select a state</option>
                  {INDIAN_STATES.filter(s => !profile.coverage_states.includes(s)).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={addState}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.coverage_states.map(state => (
                  <Badge key={state} variant="secondary" className="gap-1 pr-1">
                    {state}
                    <button onClick={() => removeState(state)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {profile.coverage_states.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No states added yet</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pickup Address */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Pickup / Business Address</CardTitle>
                <CardDescription>
                  {profile.delivery_type === 'auto_shipping' 
                    ? 'Configure your pickup location for Delhivery shipments'
                    : 'Your business address for order management'}
                </CardDescription>
              </div>
            </div>
            {hasProfile && (
              <Badge variant="outline" className="bg-earnings/10 text-earnings border-earnings/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.delivery_type === 'auto_shipping' && (
            <div className="p-4 rounded-lg bg-info/10 border border-info/30 mb-6">
              <div className="flex items-start gap-3">
                <Truck className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-info">Delhivery Integration</p>
                  <p className="text-sm text-muted-foreground">
                    This address will be used as the pickup location when orders for your products are shipped via Delhivery.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                value={profile.business_name}
                onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
                placeholder="Your Business Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN (Optional)</Label>
              <Input
                id="gstin"
                value={profile.gstin || ''}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
                placeholder="GST Identification Number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_address">Address *</Label>
            <Input
              id="pickup_address"
              value={profile.pickup_address}
              onChange={(e) => setProfile({ ...profile, pickup_address: e.target.value })}
              placeholder="Street address, building, floor"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pickup_city">City *</Label>
              <Input
                id="pickup_city"
                value={profile.pickup_city}
                onChange={(e) => setProfile({ ...profile, pickup_city: e.target.value })}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_state">State *</Label>
              <Input
                id="pickup_state"
                value={profile.pickup_state}
                onChange={(e) => setProfile({ ...profile, pickup_state: e.target.value })}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_pincode">Pincode *</Label>
              <Input
                id="pickup_pincode"
                value={profile.pickup_pincode}
                onChange={(e) => setProfile({ ...profile, pickup_pincode: e.target.value })}
                placeholder="6-digit pincode"
                maxLength={6}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pickup_phone">Phone Number *</Label>
              <Input
                id="pickup_phone"
                value={profile.pickup_phone}
                onChange={(e) => setProfile({ ...profile, pickup_phone: e.target.value })}
                placeholder="10-digit phone number"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_email">Email (Optional)</Label>
              <Input
                id="pickup_email"
                type="email"
                value={profile.pickup_email || ''}
                onChange={(e) => setProfile({ ...profile, pickup_email: e.target.value })}
                placeholder="business@email.com"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp Number (For Enquiry Products)</Label>
              <Input
                id="whatsapp_number"
                value={profile.whatsapp_number || ''}
                onChange={(e) => setProfile({ ...profile, whatsapp_number: e.target.value })}
                placeholder="10-digit WhatsApp number"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Customers will contact you on this number for "Enquiry" type products.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
