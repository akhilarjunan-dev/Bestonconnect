import { useState, useEffect } from 'react';
import { ProductDetailSkeleton } from '@/components/skeletons/ProductCardSkeleton';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { ShopperNavFooter } from '@/components/navigation/ShopperNavFooter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ImageGallery } from '@/components/ui/image-gallery';
import { ProductReviews } from '@/components/products/ProductReviews';
import { PhoneNumberDialog } from '@/components/checkout/PhoneNumberDialog';
import { PaymentOverlay } from '@/components/checkout/PaymentOverlay';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useRazorpayCheckout, storeCheckoutData } from '@/hooks/useRazorpayCheckout';
import { useAuth } from '@/hooks/useAuth';
import { useDeliveryCoverage } from '@/hooks/useDeliveryCoverage';
import { toast } from 'sonner';
import { 
  Package, ShoppingCart, CheckCircle, Loader2, 
  ArrowLeft, Heart, Share2, Truck, Shield, Clock, Tag, X, AlertCircle, MessageCircle, ClipboardList
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  unit: string | null;
  unit_quantity: number | null;
  discount_type: string | null;
  discount_value: number | null;
  category: string;
  image_urls: string[] | null;
  is_digital: boolean;
  commission_rate: number;
  promoter_code_discount: number | null;
  stock_quantity: number | null;
  vendor_id: string | null;
  available_from: string | null;
  available_to: string | null;
  availability_slots: any;
  vendor_name?: string | null;
  product_type?: string;
}

interface ReferralInfo {
  link_code: string;
  promoter_id: string;
  product_id: string | null;
  id: string;
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
  promoter_id: string;
  referral_link_id: string;
  link_code: string;
  verified: boolean;
  promoter_tier: 'free' | 'premium';
}

export default function ProductDetail() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refCode = searchParams.get('ref');
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const { isProductAvailable } = useDeliveryCoverage();
  
  // Use the synchronous checkout hook (same as Cart.tsx)
  const { 
    isScriptReady,
    isPreparing,
    preparedOrder,
    error: checkoutError,
    inAppBrowserInfo,
    prepareOrder,
    openCheckout,
    resetError,
    preload: preloadRazorpay
  } = useRazorpayCheckout();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  
  // Two-step checkout state: 'details' = collect info, 'payment' = ready to pay
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'payment'>('details');
  const [paymentGatewayError, setPaymentGatewayError] = useState<string | null>(null);
  
  // Promoter code state
  const [promoterCode, setPromoterCode] = useState('');
  const [promoterCodeInfo, setPromoterCodeInfo] = useState<PromoterCodeInfo | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Phone number collection state
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  // Preload Razorpay when component mounts
  useEffect(() => {
    preloadRazorpay();
  }, [preloadRazorpay]);

  // Watch for checkout errors from the hook
  useEffect(() => {
    if (checkoutError) {
      setPaymentGatewayError(checkoutError);
      setProcessing(false);
    }
  }, [checkoutError]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
    if (refCode) {
      trackReferralClick(refCode);
    }
    
    // Load saved promoter code from localStorage
    const savedCode = localStorage.getItem('referral_code');
    if (savedCode) {
      setPromoterCode(savedCode);
      verifyPromoterCode(savedCode);
    }
  }, [productId, refCode]);

  const isTimeAvailable = (p: Product) => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const slots = (p as any).availability_slots as { from: string; to: string }[] | null;
    if (slots && slots.length > 0) {
      return slots.some(slot => currentTime >= slot.from.slice(0, 5) && currentTime <= slot.to.slice(0, 5));
    }
    if (!p.available_from || !p.available_to) return true;
    return currentTime >= p.available_from.slice(0, 5) && currentTime <= p.available_to.slice(0, 5);
  };

  const getAvailabilityDisplay = (p: Product) => {
    const slots = (p as any).availability_slots as { from: string; to: string }[] | null;
    if (slots && slots.length > 0) {
      return slots.map(s => `${s.from.slice(0, 5)} - ${s.to.slice(0, 5)}`).join(', ');
    }
    if (p.available_from && p.available_to) {
      return `${p.available_from.slice(0, 5)} - ${p.available_to.slice(0, 5)}`;
    }
    return '';
  };

  const fetchProduct = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      toast.error('Product not found');
      navigate('/shop');
      return;
    }

    // Fetch vendor name separately to avoid RLS issues for anonymous users
    let vendorName: string | null = null;
    if (data.vendor_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.vendor_id)
        .maybeSingle();
      vendorName = profile?.full_name?.split(' ')[0] || null;
    }

    setProduct({ ...data, vendor_name: vendorName });
    setLoading(false);
  };

  const trackReferralClick = async (code: string) => {
    const cleaned = code.trim();
    if (!cleaned) return;

    try {
      const { data: linkData } = await supabase
        .from('referral_links')
        .select('id, link_code, promoter_id, product_id')
        .ilike('link_code', cleaned)
        .maybeSingle();

      if (!linkData) return;

      // Check promoter tier
      const { data: profileData } = await supabase
        .from('profiles')
        .select('promoter_tier')
        .eq('id', linkData.promoter_id)
        .maybeSingle();

      const promoterTier = (profileData?.promoter_tier as 'free' | 'premium') || 'free';

      setReferralInfo(linkData);
      setPromoterCode(linkData.link_code);
      setPromoterCodeInfo({
        promoter_id: linkData.promoter_id,
        referral_link_id: linkData.id,
        link_code: linkData.link_code,
        verified: true,
        promoter_tier: promoterTier
      });

      // Save referral info to localStorage for cart persistence
      localStorage.setItem('bestonconnect_referral', JSON.stringify({
        promoter_id: linkData.promoter_id,
        referral_link_id: linkData.id,
      }));
      localStorage.setItem('referral_code', linkData.link_code);

      await supabase.functions.invoke('track-referral', {
        body: { action: 'track_click', link_code: linkData.link_code },
      });
    } catch (error) {
      console.error('Error tracking referral:', error);
    }
  };

  const verifyPromoterCode = async (code: string, showToast = true): Promise<boolean> => {
    if (!code.trim()) return false;

    setVerifyingCode(true);
    try {
      // Use edge function for validation (bypasses RLS issues)
      const { data, error } = await supabase.functions.invoke('validate-referral-code', {
        body: { code: code.trim() }
      });

      if (error || !data?.valid) {
        if (showToast) toast.error('Invalid promoter code');
        setPromoterCodeInfo(null);
        setVerifyingCode(false);
        return false;
      }

      const promoterTier = (data.promoter_tier as 'free' | 'premium') || 'free';

      setPromoterCodeInfo({
        promoter_id: data.promoter_id,
        referral_link_id: data.referral_link_id,
        link_code: data.link_code,
        verified: true,
        promoter_tier: promoterTier
      });

      // Update referral info
      setReferralInfo({
        link_code: data.link_code,
        promoter_id: data.promoter_id,
        product_id: productId || null,
        id: data.referral_link_id
      });

      // Save to localStorage
      localStorage.setItem('bestonconnect_referral', JSON.stringify({
        promoter_id: data.promoter_id,
        referral_link_id: data.referral_link_id
      }));
      localStorage.setItem('referral_code', data.link_code);

      if (showToast) {
        if (promoterTier === 'premium') {
          toast.success('Promoter code applied! You\'ll get a discount.');
        } else {
          toast.success('Promoter code applied! (No discount - free tier promoter)');
        }
      }
      return true;
    } catch (err) {
      console.error('Error verifying code:', err);
      if (showToast) toast.error('Failed to verify code');
      return false;
    } finally {
      setVerifyingCode(false);
    }
  };

  const removePromoterCode = () => {
    setPromoterCode('');
    setPromoterCodeInfo(null);
    setReferralInfo(null);
    localStorage.removeItem('bestonconnect_referral');
    localStorage.removeItem('referral_code');
    localStorage.removeItem('referral_link_id');
    localStorage.removeItem('referral_promoter_id');
    toast.success('Promoter code removed');
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_urls: product.image_urls,
      is_digital: product.is_digital,
      commission_rate: product.commission_rate,
    });
    toast.success(`${product.name} added to cart`);
  };

  const handleBuyNow = async () => {
    // Require login before checkout
    if (!user) {
      toast.error('Please log in to complete your purchase');
      navigate(`/auth?redirect=/product/${productId}`);
      return;
    }
    
    if (!product) return;

    // Check if user has phone number saved
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle();

    // If no phone number, prompt for it first
    if (!profile?.phone) {
      setPhoneDialogOpen(true);
      return;
    }

    // Continue with checkout flow
    proceedToBuyNow();
  };

  const proceedToBuyNow = () => {
    if (!product) return;
    
    // Clear cart first (Buy Now replaces cart with single product)
    localStorage.removeItem('bestonconnect_cart');
    
    // Add product to cart
    const cartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_urls?.[0] || null,
      quantity: 1,
      is_digital: product.is_digital,
      commission_rate: product.commission_rate
    };
    
    localStorage.setItem('bestonconnect_cart', JSON.stringify([cartItem]));
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: 1 }));
    
    // Navigate to cart for unified checkout
    toast.success(`${product.name} added to cart`);
    navigate('/cart');
  };

  // Handler for when phone number is confirmed in dialog
  const handlePhoneConfirmed = async (_phone: string) => {
    proceedToBuyNow();
  };

  // Calculate discount (only for premium tier promoters)
  const getDiscountAmount = () => {
    if (!product || !promoterCodeInfo?.verified) return 0;
    if (promoterCodeInfo.promoter_tier !== 'premium') return 0;
    return product.price * quantity * (product.promoter_code_discount || 0) / 100;
  };

  const discountAmount = getDiscountAmount();
  const isPremiumPromoter = promoterCodeInfo?.promoter_tier === 'premium';
  const subtotal = product ? product.price * quantity : 0;
  const finalTotal = subtotal - discountAmount;

  // Pre-create Razorpay order when entering payment step
  const prepareRazorpayOrder = async () => {
    if (!product) return;

    if (promoterCode.trim() && !promoterCodeInfo?.verified) {
      await verifyPromoterCode(promoterCode, false);
    }

    const cartDataForWebhook = [{
      product_id: product.id,
      product_name: product.name,
      quantity: quantity,
      unit_price: product.price,
      total_amount: finalTotal,
      is_digital: product.is_digital,
      delivery_address: product.is_digital ? null : deliveryAddress,
      promoter_id: promoterCodeInfo?.promoter_id || referralInfo?.promoter_id || null,
      referral_link_id: promoterCodeInfo?.referral_link_id || referralInfo?.id || null,
      commission_rate: product.commission_rate,
      buyer_email: buyerEmail.trim()
    }];

    await prepareOrder({
      amount: finalTotal,
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        product_id: product.id,
        buyer_email: buyerEmail.trim(),
        buyer_name: buyerName?.trim() || null,
        user_id: user?.id || null,
        promoter_code: promoterCodeInfo?.link_code || null,
        discount_applied: discountAmount,
        cart_data: JSON.stringify(cartDataForWebhook)
      }
    });
  };

  // Handle "Proceed to Payment" - validates details and prepares order
  const handleProceedToPayment = async () => {
    if (!product) return;
    
    if (!buyerEmail.trim() || !buyerEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!product.is_digital) {
      if (!deliveryAddress.name || !deliveryAddress.phone || !deliveryAddress.address || 
          !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode) {
        toast.error('Please fill in all delivery address fields');
        return;
      }
    }

    setCheckoutStep('payment');
    setPaymentGatewayError(null);
    resetError();
    await prepareRazorpayOrder();
  };

  // Handle "Pay Now" - SYNCHRONOUS, no async before checkout
  const handlePayNow = () => {
    if (!product) return;

    if (inAppBrowserInfo.isInApp) {
      setPaymentGatewayError(`For secure payment, please open this page in Chrome or Safari. ${inAppBrowserInfo.browserName} browser does not support secure payments.`);
      return;
    }

    if (!preparedOrder) {
      toast.error('Payment not ready. Please wait a moment and try again.');
      prepareRazorpayOrder();
      return;
    }

    setProcessing(true);
    setPaymentGatewayError(null);

    const cartDataForWebhook = [{
      product_id: product.id,
      product_name: product.name,
      quantity: quantity,
      unit_price: product.price,
      total_amount: finalTotal,
      is_digital: product.is_digital,
      delivery_address: product.is_digital ? null : deliveryAddress,
      promoter_id: promoterCodeInfo?.promoter_id || referralInfo?.promoter_id || null,
      referral_link_id: promoterCodeInfo?.referral_link_id || referralInfo?.id || null,
      commission_rate: product.commission_rate,
      buyer_email: buyerEmail.trim()
    }];

    openCheckout({
      description: product.name + (promoterCodeInfo ? ' (Discount applied)' : ''),
      prefill: {
        email: buyerEmail.trim(),
        contact: deliveryAddress.phone || userPhone || '',
        name: buyerName.trim() || '',
      },
      theme: { color: '#6366f1' },
      checkoutData: {
        cartData: cartDataForWebhook,
        buyerEmail: buyerEmail.trim(),
        buyerName: buyerName.trim() || undefined,
        deliveryAddress: product.is_digital ? undefined : deliveryAddress,
        promoterInfo: promoterCodeInfo || referralInfo || undefined,
        finalTotal
      }
    });
  };

  const handleBackToDetails = () => {
    setCheckoutStep('details');
    setPaymentGatewayError(null);
    resetError();
  };

  const isPayButtonEnabled = isScriptReady && preparedOrder && !isPreparing && !processing;

  const getDiscountPercentage = () => {
    if (!product || !product.mrp || product.mrp <= product.price) return null;
    return Math.round(((product.mrp - product.price) / product.mrp) * 100);
  };

  if (loading) {
    return (
      <Layout>
        <ProductDetailSkeleton />
        <ShopperNavFooter />
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Product Not Found</h2>
          <Button onClick={() => navigate('/shop')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shop
          </Button>
        </div>
        <ShopperNavFooter />
      </Layout>
    );
  }

  const discount = getDiscountPercentage();

  return (
    <Layout>
      {/* Payment Overlay - blocks all touch events when payment is processing */}
      <PaymentOverlay isActive={processing} />
      
      <div className="container mx-auto px-4 py-6 pb-24">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/shop')} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Shop
        </Button>

        {/* Promoter Code Applied Badge */}
        {promoterCodeInfo?.verified && (
          <div className={`mb-4 p-3 rounded-lg border ${isPremiumPromoter ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${isPremiumPromoter ? 'text-green-600' : 'text-blue-600'}`} />
                <span className={`font-medium ${isPremiumPromoter ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'}`}>
                  Promoter code "{promoterCodeInfo.link_code}" applied!
                  {isPremiumPromoter && product.promoter_code_discount && product.promoter_code_discount > 0 ? (
                    <span className="ml-1">You'll get {product.promoter_code_discount}% off!</span>
                  ) : !isPremiumPromoter && (
                    <span className="ml-1 text-muted-foreground">(Free tier - no discount)</span>
                  )}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={removePromoterCode}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div>
            {product.image_urls && product.image_urls.length > 0 ? (
              <ImageGallery images={product.image_urls} alt={product.name} />
            ) : (
              <div className="aspect-square bg-muted rounded-xl flex items-center justify-center">
                <Package className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  {product.vendor_name && (
                    <p className="text-sm font-medium text-primary mb-1">{product.vendor_name}</p>
                  )}
                  <h1 className="text-2xl lg:text-3xl font-bold">{product.name}</h1>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleWishlist(product.id)}
                  className={isInWishlist(product.id) ? 'text-red-500' : ''}
                >
                  <Heart className={`h-6 w-6 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{product.category}</Badge>
                {product.is_digital && <Badge variant="secondary">Digital Product</Badge>}
                {product.available_from && product.available_to && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {product.available_from.slice(0, 5)} - {product.available_to.slice(0, 5)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Time-based unavailability notice */}
            {!isTimeAvailable(product) && getAvailabilityDisplay(product) && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Currently Unavailable
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This item is available during: {getAvailabilityDisplay(product)}. Please check back during those hours.
                </p>
              </div>
            )}

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">₹{product.price.toLocaleString()}</span>
                {product.mrp && product.mrp > product.price && (
                  <span className="text-xl text-muted-foreground line-through">₹{product.mrp.toLocaleString()}</span>
                )}
                {discount && (
                  <Badge className="bg-earnings text-white">{discount}% OFF</Badge>
                )}
              </div>
              {product.unit && product.unit_quantity && (
                <p className="text-sm text-muted-foreground">
                  {product.unit_quantity} {product.unit}
                </p>
              )}
            </div>

            {/* Stock Status */}
            {!product.is_digital && product.stock_quantity !== null && (
              <div className="flex items-center gap-2">
                {product.stock_quantity > 0 ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm text-green-600">In Stock ({product.stock_quantity} available)</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-sm text-red-600">Out of Stock</span>
                  </>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Secure Payment</p>
              </div>
              <div className="text-center">
                <Truck className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">{product.is_digital ? 'Instant Delivery' : 'Fast Shipping'}</p>
              </div>
              <div className="text-center">
                <Clock className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">24/7 Support</p>
              </div>
            </div>

            {/* Delivery Availability Notice */}
            {product.vendor_id && !isProductAvailable(product.vendor_id) && (
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  This product is not available for delivery to your saved addresses.
                </p>
              </div>
            )}

            {/* Action Buttons - based on product_type */}
            <div className="flex gap-4">
              {(!product.product_type || product.product_type === 'default') && (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={handleAddToCart}
                    disabled={(!product.is_digital && product.stock_quantity !== null && product.stock_quantity <= 0) || !isProductAvailable(product.vendor_id) || !isTimeAvailable(product)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {!isProductAvailable(product.vendor_id) ? 'Unavailable' : !isTimeAvailable(product) ? 'Not Available Now' : 'Add to Cart'}
                  </Button>
                  <Button 
                    className="flex-1 gap-2"
                    onClick={handleBuyNow}
                    disabled={(!product.is_digital && product.stock_quantity !== null && product.stock_quantity <= 0) || !isProductAvailable(product.vendor_id) || !isTimeAvailable(product)}
                  >
                    {isProductAvailable(product.vendor_id) && isTimeAvailable(product) ? 'Buy Now' : 'Unavailable'}
                  </Button>
                </>
              )}

              {product.product_type === 'custom_order' && (
                <Button 
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (!user) { navigate('/auth'); return; }
                    navigate(`/custom-order/${product.id}`);
                  }}
                >
                  <ClipboardList className="h-4 w-4" />
                  Place Custom Order
                </Button>
              )}

              {product.product_type === 'enquiry' && (
                <Button 
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    if (!user) { navigate('/auth'); return; }
                    // Fetch vendor WhatsApp number
                    let whatsappNumber = '';
                    if (product.vendor_id) {
                      const { data: vp } = await supabase.from('vendor_profiles').select('whatsapp_number, pickup_phone').eq('user_id', product.vendor_id).maybeSingle();
                      whatsappNumber = (vp as any)?.whatsapp_number || vp?.pickup_phone || '';
                    }
                    if (!whatsappNumber) {
                      toast.error('Vendor contact not available');
                      return;
                    }
                    // Log enquiry
                    const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
                    await supabase.from('product_enquiries').insert({
                      product_id: product.id,
                      user_id: user.id,
                      vendor_id: product.vendor_id,
                      customer_name: profile?.full_name || null,
                      customer_phone: profile?.phone || null,
                      message: `I'd like to know more about ${product.name}`,
                      whatsapp_sent: true,
                    });
                    // Open WhatsApp
                    const msg = encodeURIComponent(`Hi, I'd like to know more about this product: *${product.name}*\n\nProduct link: ${window.location.href}`);
                    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
                    const waNumber = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;
                    window.open(`https://wa.me/${waNumber}?text=${msg}`, '_blank');
                    toast.success('Enquiry sent via WhatsApp!');
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Enquire on WhatsApp
                </Button>
              )}
            </div>

            {/* Share */}
            <Button 
              variant="ghost" 
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Link copied to clipboard!');
              }}
            >
              <Share2 className="h-4 w-4" />
              Share Product
            </Button>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12">
          <ProductReviews productId={product.id} productName={product.name} />
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {orderComplete ? (
            <>
              <DialogHeader>
                <div className="mx-auto p-4 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <DialogTitle className="text-center">Order Confirmed!</DialogTitle>
                <DialogDescription className="text-center">
                  {product.is_digital 
                    ? 'Your digital product has been delivered to your email.'
                    : 'Your order has been placed. You will receive tracking details via email.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => { setCheckoutOpen(false); navigate('/shop'); }} className="w-full">
                  Continue Shopping
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Complete Your Purchase</DialogTitle>
                <DialogDescription>
                  {product.name} - ₹{(product.price * quantity).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name (Optional)</Label>
                    <Input
                      placeholder="Your name"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </Button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {!product.is_digital && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium">Delivery Address</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Full Name *"
                        value={deliveryAddress.name}
                        onChange={(e) => setDeliveryAddress({...deliveryAddress, name: e.target.value})}
                      />
                      <Input
                        placeholder="Phone *"
                        value={deliveryAddress.phone}
                        onChange={(e) => setDeliveryAddress({...deliveryAddress, phone: e.target.value})}
                      />
                    </div>
                    <Textarea
                      placeholder="Street Address *"
                      value={deliveryAddress.address}
                      onChange={(e) => setDeliveryAddress({...deliveryAddress, address: e.target.value})}
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        placeholder="City *"
                        value={deliveryAddress.city}
                        onChange={(e) => setDeliveryAddress({...deliveryAddress, city: e.target.value})}
                      />
                      <Input
                        placeholder="State *"
                        value={deliveryAddress.state}
                        onChange={(e) => setDeliveryAddress({...deliveryAddress, state: e.target.value})}
                      />
                      <Input
                        placeholder="Pincode *"
                        value={deliveryAddress.pincode}
                        onChange={(e) => setDeliveryAddress({...deliveryAddress, pincode: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                {/* Promoter Code Section */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span className="font-medium text-sm">Have a promoter code?</span>
                  </div>
                  {promoterCodeInfo?.verified ? (
                    <div className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                          "{promoterCodeInfo.link_code}" applied
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={removePromoterCode}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={promoterCode}
                        onChange={(e) => setPromoterCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && verifyPromoterCode(promoterCode)}
                        className="flex-1"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => verifyPromoterCode(promoterCode)}
                        disabled={verifyingCode || !promoterCode.trim()}
                      >
                        {verifyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  {verifyingCode ? (
                    <div className="flex items-center justify-center py-2 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-muted-foreground text-sm">Validating code...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toLocaleString()}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-green-600 mt-1">
                          <span>Promoter Code Discount ({product.promoter_code_discount}%)</span>
                          <span>-₹{discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                        <span>Total</span>
                        <span>₹{finalTotal.toLocaleString()}</span>
                      </div>
                      {discountAmount > 0 && (
                        <p className="text-xs text-green-600 mt-1 text-center">
                          You're saving ₹{discountAmount.toLocaleString()}!
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                {checkoutStep === 'details' ? (
                  <Button 
                    className="w-full gap-2" 
                    onClick={handleProceedToPayment}
                    disabled={verifyingCode}
                  >
                    Proceed to Payment
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleBackToDetails} disabled={processing}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button 
                      onClick={handlePayNow}
                      disabled={!isPayButtonEnabled || !!paymentGatewayError}
                      className="min-w-[140px]"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : isPreparing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        `Pay ₹${finalTotal.toLocaleString()}`
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Phone Number Collection Dialog */}
      <PhoneNumberDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
        userId={user?.id || ''}
        onPhoneConfirmed={handlePhoneConfirmed}
        existingPhone={userPhone || undefined}
      />

      <ShopperNavFooter />
    </Layout>
  );
}
