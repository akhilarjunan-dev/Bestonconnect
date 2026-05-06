import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckoutSummary } from './CheckoutSummary';
import { ArrowLeft, CreditCard, Loader2, AlertTriangle, Smartphone, ExternalLink, Banknote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

interface CODSettings {
  enabled: boolean;
  min_order_amount: number;
  max_order_amount: number;
  allow_cod_self_shipping: boolean;
}

interface PaymentStepProps {
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
  isProcessing: boolean;
  isPayEnabled?: boolean;
  isInAppBrowser: boolean;
  inAppBrowserName: string | null;
  paymentError: string | null;
  onBack: () => void;
  onPay: () => void;
  onCOD?: () => void;
}

export function PaymentStep({
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
  isProcessing,
  isPayEnabled = true,
  isInAppBrowser,
  inAppBrowserName,
  paymentError,
  onBack,
  onPay,
  onCOD
}: PaymentStepProps) {
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [codSettings, setCodSettings] = useState<CODSettings | null>(null);
  const [loadingCodSettings, setLoadingCodSettings] = useState(true);
  const [hasSelfShippingVendor, setHasSelfShippingVendor] = useState(false);

  // Fetch COD settings and vendor delivery types
  useEffect(() => {
    const fetchCODSettings = async () => {
      const { data } = await supabase
        .from('order_settings')
        .select('setting_value')
        .eq('setting_key', 'cod_enabled')
        .maybeSingle();

      if (data) {
        const value = data.setting_value as unknown as CODSettings;
        setCodSettings({
          enabled: value?.enabled ?? false,
          min_order_amount: value?.min_order_amount ?? 0,
          max_order_amount: value?.max_order_amount ?? 10000,
          allow_cod_self_shipping: value?.allow_cod_self_shipping ?? false
        });
      } else {
        setCodSettings({ enabled: false, min_order_amount: 0, max_order_amount: 10000, allow_cod_self_shipping: false });
      }

      // Check if any cart product is from a self-shipping vendor
      const productIds = cartItems.map(i => i.id);
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, vendor_id')
          .in('id', productIds);

        const vendorIds = (products || []).map(p => p.vendor_id).filter(Boolean) as string[];
        if (vendorIds.length > 0) {
          const { data: vendors } = await supabase
            .from('vendor_profiles')
            .select('user_id, delivery_type')
            .in('user_id', vendorIds);

          const hasSelfShipping = (vendors || []).some(v => v.delivery_type === 'self_shipping');
          setHasSelfShippingVendor(hasSelfShipping);
        }
      }

      setLoadingCodSettings(false);
    };

    fetchCODSettings();
  }, [cartItems]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  // Check if COD is available for this order
  const isCODAvailable = () => {
    if (!codSettings?.enabled) return false;
    if (!hasPhysicalProducts) return false;
    
    // Block COD for self-shipping vendors unless admin allows it
    if (hasSelfShippingVendor && !codSettings.allow_cod_self_shipping) return false;
    
    const minAmount = codSettings.min_order_amount || 0;
    const maxAmount = codSettings.max_order_amount || 0;
    
    if (minAmount > 0 && finalTotal < minAmount) return false;
    if (maxAmount > 0 && finalTotal > maxAmount) return false;
    
    return true;
  };

  const handlePayment = () => {
    if (paymentMethod === 'cod' && onCOD) {
      onCOD();
    } else {
      onPay();
    }
  };

  const codAvailable = isCODAvailable();

  return (
    <div className="space-y-4">
      {/* In-app browser warning */}
      {isInAppBrowser && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <Smartphone className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">
              You're using {inAppBrowserName || 'an in-app browser'}
            </p>
            <p className="text-sm mb-2">
              For the best payment experience, open this page in Chrome or Safari.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Copy Link
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Payment error */}
      {paymentError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{paymentError}</AlertDescription>
        </Alert>
      )}

      {/* Read-only summary - NO INPUT FIELDS */}
      <CheckoutSummary
        cartItems={cartItems}
        buyerEmail={buyerEmail}
        buyerName={buyerName}
        deliveryAddress={deliveryAddress}
        hasPhysicalProducts={hasPhysicalProducts}
        subtotal={subtotal}
        discountAmount={discountAmount}
        shippingCharge={shippingCharge}
        finalTotal={finalTotal}
        promoterCodeInfo={promoterCodeInfo}
        readOnly={true}
      />

      {/* Payment Method Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCodSettings ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as 'online' | 'cod')}
              className="space-y-3"
            >
              {/* Online Payment Option */}
              <div className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                paymentMethod === 'online' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}>
                <RadioGroupItem value="online" id="online" />
                <Label htmlFor="online" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="font-medium">Pay Online</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    UPI, Cards, Net Banking - Powered by Razorpay
                  </p>
                </Label>
              </div>

              {/* Cash on Delivery Option */}
              {codAvailable && (
                <div className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  paymentMethod === 'cod' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}>
                  <RadioGroupItem value="cod" id="cod" />
                  <Label htmlFor="cod" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Cash on Delivery</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pay when your order is delivered
                    </p>
                  </Label>
                </div>
              )}
            </RadioGroup>
          )}

          {/* Show why COD is not available */}
          {!loadingCodSettings && !codAvailable && codSettings?.enabled && hasPhysicalProducts && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              {hasSelfShippingVendor && !codSettings.allow_cod_self_shipping
                ? 'COD is not available for self-shipping vendor products'
                : `COD is available for orders between ₹${codSettings.min_order_amount.toLocaleString()} - ₹${codSettings.max_order_amount.toLocaleString()}`}
            </p>
          )}

          {paymentMethod === 'online' && (
            <>
              {/* Secure payment badges */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Secure Payment
                </span>
                <span>•</span>
                <span>256-bit SSL</span>
                <span>•</span>
                <span>PCI DSS Compliant</span>
              </div>
            </>
          )}

          {paymentMethod === 'cod' && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Note:</strong> Please keep exact change ready. Our delivery partner will collect ₹{finalTotal.toLocaleString()} on delivery.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={onBack} 
          disabled={isProcessing}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handlePayment}
          disabled={isProcessing || (!isPayEnabled && paymentMethod === 'online') || (isInAppBrowser && paymentMethod === 'online')}
          className="flex-1 bg-primary hover:bg-primary/90"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : !isPayEnabled && paymentMethod === 'online' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Preparing Payment...
            </>
          ) : isInAppBrowser && paymentMethod === 'online' ? (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Open in Browser to Pay
            </>
          ) : paymentMethod === 'cod' ? (
            <>
              <Banknote className="w-4 h-4 mr-2" />
              Place Order (COD)
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay ₹{finalTotal.toLocaleString()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
