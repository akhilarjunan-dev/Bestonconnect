import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddressSelector } from './AddressSelector';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface AddressStepProps {
  userId: string;
  deliveryAddress: DeliveryAddress;
  onAddressChange: (address: DeliveryAddress) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function AddressStep({
  userId,
  deliveryAddress,
  onAddressChange,
  onBack,
  onContinue
}: AddressStepProps) {
  const handleContinue = () => {
    if (!deliveryAddress.name || !deliveryAddress.phone || !deliveryAddress.address ||
        !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode) {
      toast.error('Please select or add a delivery address');
      return;
    }
    onContinue();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Delivery Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddressSelector
            userId={userId}
            selectedAddress={deliveryAddress}
            onSelectAddress={onAddressChange}
          />
        </CardContent>
      </Card>

      {/* Selected Address Preview */}
      {deliveryAddress.address && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-1">Delivering to:</p>
            <p className="font-semibold">{deliveryAddress.name}</p>
            <p className="text-sm text-muted-foreground">{deliveryAddress.phone}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {deliveryAddress.address}, {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Cart
        </Button>
        <Button onClick={handleContinue} className="flex-1" disabled={!deliveryAddress.address}>
          Continue to Payment
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
