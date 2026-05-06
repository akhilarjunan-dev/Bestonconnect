import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, Plus, Trash2, Edit2, Home, Building, Star, Loader2, Check } from 'lucide-react';

interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface AddressBookProps {
  userId: string;
  onAddressSelect?: (address: SavedAddress) => void;
  showSelectMode?: boolean;
  selectedAddressId?: string;
}

export function AddressBook({ 
  userId, 
  onAddressSelect, 
  showSelectMode = false,
  selectedAddressId 
}: AddressBookProps) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
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
      setAddresses(data as SavedAddress[]);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      label: 'Home',
      name: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      is_default: addresses.length === 0
    });
    setEditingAddress(null);
  };

  const handleOpenDialog = (address?: SavedAddress) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        label: address.label,
        name: address.name,
        phone: address.phone,
        address: address.address,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        is_default: address.is_default
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSaveAddress = async () => {
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

      if (editingAddress) {
        // Update existing
        const { error } = await supabase
          .from('saved_addresses')
          .update({
            label: formData.label,
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            is_default: formData.is_default
          })
          .eq('id', editingAddress.id);

        if (error) throw error;
        toast.success('Address updated');
      } else {
        // Create new
        const { error } = await supabase
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
          });

        if (error) throw error;
        toast.success('Address saved');
      }

      await fetchAddresses();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Address deleted');
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('Failed to delete address');
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // Unset all defaults first
      await supabase
        .from('saved_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Set the new default
      const { error } = await supabase
        .from('saved_addresses')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Default address updated');
      fetchAddresses();
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Failed to set default address');
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Saved Addresses
            </CardTitle>
            <CardDescription>
              {showSelectMode 
                ? 'Select a delivery address or add a new one'
                : 'Manage your saved delivery addresses'}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-1" />
                Add New
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </DialogTitle>
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
                    <Label htmlFor="addr-name">Full Name *</Label>
                    <Input
                      id="addr-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Recipient name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="addr-phone">Phone *</Label>
                    <Input
                      id="addr-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="10-digit number"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <Label htmlFor="addr-address">Street Address *</Label>
                  <Input
                    id="addr-address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="House/Flat, Street, Area"
                  />
                </div>

                {/* City, State, Pincode */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="addr-city">City *</Label>
                    <Input
                      id="addr-city"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="addr-state">State *</Label>
                    <Input
                      id="addr-state"
                      value={formData.state}
                      onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="State"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="addr-pincode">PIN *</Label>
                    <Input
                      id="addr-pincode"
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
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveAddress}
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
                        {editingAddress ? 'Update' : 'Save'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {addresses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No saved addresses yet</p>
            <p className="text-sm">Add an address to make checkout faster</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {addresses.map((addr) => {
              const isSelected = selectedAddressId === addr.id;
              
              return (
                <div
                  key={addr.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    showSelectMode 
                      ? 'cursor-pointer hover:border-primary/50' 
                      : ''
                  } ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border'
                  }`}
                  onClick={() => showSelectMode && onAddressSelect?.(addr)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getLabelIcon(addr.label)}
                        <span className="font-medium text-sm">{addr.label}</span>
                        {addr.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary ml-auto" />
                        )}
                      </div>
                      <p className="font-medium">{addr.name}</p>
                      <p className="text-sm text-muted-foreground">{addr.phone}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                    </div>
                    
                    {!showSelectMode && (
                      <div className="flex gap-1 ml-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(addr);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {!addr.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(addr.id);
                            }}
                            title="Set as default"
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(addr.id);
                          }}
                          disabled={deleting === addr.id}
                        >
                          {deleting === addr.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
