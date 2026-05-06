import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, Plus, Check, Home, Building, Star, Loader2 } from 'lucide-react';

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface SavedAddress extends DeliveryAddress {
  id: string;
  label: string;
  is_default: boolean;
}

interface AddressSelectorProps {
  userId: string;
  selectedAddress: DeliveryAddress;
  onSelectAddress: (address: DeliveryAddress) => void;
}

export function AddressSelector({
  userId,
  selectedAddress,
  onSelectAddress
}: AddressSelectorProps) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form for new address
  const [formData, setFormData] = useState({
    label: 'Home',
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    is_default: false
  });

  useEffect(() => {
    fetchAddresses();
  }, [userId]);

  const fetchAddresses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      const addrs = data as SavedAddress[];
      setAddresses(addrs);
      
      // Auto-select default address if none selected yet
      if (!selectedAddress.address && addrs.length > 0) {
        const defaultAddr = addrs.find(a => a.is_default) || addrs[0];
        setSelectedId(defaultAddr.id);
        onSelectAddress({
          name: defaultAddr.name,
          phone: defaultAddr.phone,
          address: defaultAddr.address,
          city: defaultAddr.city,
          state: defaultAddr.state,
          pincode: defaultAddr.pincode
        });
      } else if (selectedAddress.address) {
        // Find matching address
        const match = addrs.find(a => 
          a.address === selectedAddress.address && 
          a.city === selectedAddress.city && 
          a.pincode === selectedAddress.pincode
        );
        if (match) setSelectedId(match.id);
      }
    }
    setLoading(false);
  };

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedId(addr.id);
    onSelectAddress({
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode
    });
  };

  const handleSaveNewAddress = async () => {
    if (!formData.name || !formData.phone || !formData.address || 
        !formData.city || !formData.state || !formData.pincode) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.phone.replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    if (formData.pincode.length !== 6) {
      toast.error('Please enter a valid 6-digit PIN code');
      return;
    }

    setSaving(true);
    try {
      // If setting as default, unset other defaults first
      if (formData.is_default) {
        await supabase
          .from('saved_addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error } = await supabase
        .from('saved_addresses')
        .insert({
          user_id: userId,
          label: formData.label,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          is_default: formData.is_default || addresses.length === 0
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Address saved');
      
      // Auto-select the new address
      if (data) {
        setSelectedId(data.id);
        onSelectAddress({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode
        });
      }

      await fetchAddresses();
      setDialogOpen(false);
      
      // Reset form
      setFormData({
        label: 'Home',
        name: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        is_default: false
      });
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home':
        return <Home className="w-4 h-4" />;
      case 'work':
      case 'office':
        return <Building className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Saved Addresses */}
      {addresses.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select Delivery Address</Label>
          <div className="grid gap-2">
            {addresses.map((addr) => {
              const isSelected = selectedId === addr.id;

              return (
                <Card 
                  key={addr.id}
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleSelectAddress(addr)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {getLabelIcon(addr.label)}
                          <span className="font-medium text-sm">{addr.label}</span>
                          {addr.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm">{addr.name}</p>
                        <p className="text-xs text-muted-foreground">{addr.phone}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add New Address Button */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            {addresses.length === 0 ? 'Add Delivery Address' : 'Add New Address'}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Label Selection */}
            <div>
              <Label>Address Type</Label>
              <div className="flex gap-2 mt-1">
                {['Home', 'Work', 'Other'].map((label) => (
                  <Button
                    key={label}
                    type="button"
                    variant={formData.label === label ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, label }))}
                  >
                    {label === 'Home' && <Home className="w-4 h-4 mr-1" />}
                    {label === 'Work' && <Building className="w-4 h-4 mr-1" />}
                    {label === 'Other' && <MapPin className="w-4 h-4 mr-1" />}
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Name & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-addr-name">Full Name *</Label>
                <Input
                  id="new-addr-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Recipient name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-addr-phone">Phone *</Label>
                <Input
                  id="new-addr-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="10-digit number"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1">
              <Label htmlFor="new-addr-address">Street Address *</Label>
              <Input
                id="new-addr-address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="House/Flat, Street, Area"
              />
            </div>

            {/* City, State, Pincode */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="new-addr-city">City *</Label>
                <Input
                  id="new-addr-city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-addr-state">State *</Label>
                <Input
                  id="new-addr-state"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="State"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-addr-pincode">PIN *</Label>
                <Input
                  id="new-addr-pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="6 digits"
                  maxLength={6}
                />
              </div>
            </div>

            {/* Default Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                className="rounded border-input"
              />
              <span className="text-sm">Set as default address</span>
            </label>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveNewAddress}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save & Select
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
