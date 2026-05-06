import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, MapPin, Phone, Mail, User, Tag, CheckCircle, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  is_digital: boolean;
}

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface PromoterCodeInfo {
  link_code: string;
  promoter_tier: 'free' | 'premium';
}

interface CheckoutSummaryProps {
  cartItems: CartItem[];
  buyerEmail: string;
  buyerName: string;
  deliveryAddress: DeliveryAddress | null;
  hasPhysicalProducts: boolean;
  subtotal: number;
  discountAmount: number;
  shippingCharge?: number;
  finalTotal: number;
  promoterCodeInfo: PromoterCodeInfo | null;
  onEditContact?: () => void;
  onEditAddress?: () => void;
  onEditPromoterCode?: () => void;
  readOnly?: boolean;
}

export function CheckoutSummary({
  cartItems,
  buyerEmail,
  buyerName,
  deliveryAddress,
  hasPhysicalProducts,
  subtotal,
  discountAmount,
  shippingCharge = 0,
  finalTotal,
  promoterCodeInfo,
  onEditContact,
  onEditAddress,
  onEditPromoterCode,
  readOnly = false
}: CheckoutSummaryProps) {
  const isPremiumPromoter = promoterCodeInfo?.promoter_tier === 'premium';

  return (
    <div className="space-y-4">
      {/* Order Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
              </div>
              <p className="font-medium text-sm">₹{(item.price * item.quantity).toLocaleString()}</p>
            </div>
          ))}
          
          <Separator className="my-3" />
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{subtotal.toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-₹{discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <div className="text-right">
                <span className={shippingCharge > 0 ? '' : 'text-green-600'}>
                  {shippingCharge > 0 ? `₹${shippingCharge.toLocaleString()}` : 'Free'}
                </span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg pt-1">
              <span>Total</span>
              <span>₹{finalTotal.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promoter Code */}
      {promoterCodeInfo && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Code: {promoterCodeInfo.link_code}</span>
                {isPremiumPromoter ? (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    {discountAmount > 0 && `Saving ₹${discountAmount.toLocaleString()}`}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Free tier</Badge>
                )}
              </div>
              {!readOnly && onEditPromoterCode && (
                <Button variant="ghost" size="sm" onClick={onEditPromoterCode}>
                  <Edit2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Details - Read Only */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Contact Details
            </CardTitle>
            {!readOnly && onEditContact && (
              <Button variant="ghost" size="sm" onClick={onEditContact}>
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>{buyerEmail || 'Not provided'}</span>
          </div>
          {buyerName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{buyerName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Address - Read Only */}
      {hasPhysicalProducts && deliveryAddress && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </CardTitle>
              {!readOnly && onEditAddress && (
                <Button variant="ghost" size="sm" onClick={onEditAddress}>
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <p className="font-medium">{deliveryAddress.name}</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3 h-3" />
                <span>{deliveryAddress.phone}</span>
              </div>
              <p className="text-muted-foreground">
                {deliveryAddress.address}, {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ready indicator */}
      {readOnly && (
        <div className="flex items-center justify-center gap-2 text-green-600 py-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Ready for payment</span>
        </div>
      )}
    </div>
  );
}
