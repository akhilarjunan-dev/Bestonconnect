import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhoneNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPhoneConfirmed: (phone: string) => void;
  existingPhone?: string;
}

export function PhoneNumberDialog({ 
  open, 
  onOpenChange, 
  userId, 
  onPhoneConfirmed,
  existingPhone 
}: PhoneNumberDialogProps) {
  const [phone, setPhone] = useState(existingPhone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingPhone) {
      setPhone(existingPhone);
    }
  }, [existingPhone]);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits except +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // Add +91 prefix if it's a 10-digit number without country code
    if (/^\d{10}$/.test(cleaned)) {
      cleaned = '+91' + cleaned;
    }
    
    return cleaned;
  };

  const validatePhone = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, '');
    // Must be at least 10 digits (Indian mobile number)
    return cleaned.length >= 10;
  };

  const handleSubmit = async () => {
    const formattedPhone = formatPhoneNumber(phone);
    
    if (!validatePhone(formattedPhone)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: formattedPhone })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      toast.success('Mobile number saved!');
      onPhoneConfirmed(formattedPhone);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save phone:', error);
      toast.error('Failed to save mobile number');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits, +, and spaces
    const cleaned = value.replace(/[^\d+\s]/g, '');
    setPhone(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Mobile Number Required
          </DialogTitle>
          <DialogDescription>
            Please enter your mobile number to continue with checkout. This will be saved for future purchases.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={handleInputChange}
                onBlur={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  if (formatted !== e.target.value) {
                    setPhone(formatted);
                  }
                }}
                className="pl-10"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your 10-digit mobile number. We'll add +91 automatically.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !phone.trim()}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue to Checkout'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
