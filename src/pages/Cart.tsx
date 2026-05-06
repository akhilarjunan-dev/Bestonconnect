import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { ShopperNavFooter } from '@/components/navigation/ShopperNavFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShoppingCart, Trash2, Plus, Minus, Package, ArrowRight, Loader2, Tag, CheckCircle, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PhoneNumberDialog } from '@/components/checkout/PhoneNumberDialog';
import { CheckoutSteps, CheckoutStep } from '@/components/checkout/CheckoutSteps';
import { AddressStep } from '@/components/checkout/AddressStep';
import { PaymentStep } from '@/components/checkout/PaymentStep';
import { PaymentOverlay } from '@/components/checkout/PaymentOverlay';
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout';
import type { Json } from '@/integrations/supabase/types';

interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  is_digital: boolean;
  commission_rate: number;
  promoter_code_discount?: number;
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
  referral_link_id?: string;
  link_code: string;
  verified: boolean;
  promoter_tier: 'free' | 'premium';
}

const CART_STORAGE_KEY = 'bestonconnect_cart';
const REFERRAL_STORAGE_KEY = 'bestonconnect_referral';

export default function Cart() {
  const [_searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Use the new synchronous checkout hook
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
  
  // Multi-step checkout state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentGatewayError, setPaymentGatewayError] = useState<string | null>(null);
  
  // Preload Razorpay when component mounts
  useEffect(() => {
    preloadRazorpay();
  }, [preloadRazorpay]);

  const [referralInfo, setReferralInfo] = useState<{ promoter_id: string; referral_link_id?: string } | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  // Shipping charge state
  const [shippingCharge, setShippingCharge] = useState(0);
  const [shippingBreakdown, setShippingBreakdown] = useState<{ base: number; discount: number; label: string } | null>(null);
  const [_loadingShipping, setLoadingShipping] = useState(false);
  const [shippingConfig, setShippingConfig] = useState<{
    slabs: { max_weight_grams: number; charge: number }[];
    extra_per_kg: number;
    free_above: number;
    half_discount_above: number;
  } | null>(null);
  const [productWeightMap, setProductWeightMap] = useState<Record<string, number>>({});

  // Promoter code state
  const [promoterCode, setPromoterCode] = useState('');
  const [promoterCodeInfo, setPromoterCodeInfo] = useState<PromoterCodeInfo | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [productDiscounts, setProductDiscounts] = useState<Record<string, number>>({});

  // Phone number collection state
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  // Watch for checkout errors
  useEffect(() => {
    if (checkoutError) {
      setPaymentGatewayError(checkoutError);
      setProcessing(false);
    }
  }, [checkoutError]);

  // Fetch user profile data for auto-fill
  const fetchUserProfile = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email, delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_pincode')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profile) {
      setUserPhone(profile.phone);
      if (profile.email) setBuyerEmail(profile.email);
      if (profile.full_name) setBuyerName(profile.full_name);
      
      if (profile.delivery_address || profile.delivery_name) {
        setDeliveryAddress({
          name: profile.delivery_name || profile.full_name || '',
          phone: profile.delivery_phone || profile.phone || '',
          address: profile.delivery_address || '',
          city: profile.delivery_city || '',
          state: profile.delivery_state || '',
          pincode: profile.delivery_pincode || ''
        });
      }
    }
  };

  const handlePhoneConfirmed = async (phone: string) => {
    setUserPhone(phone);
    await fetchUserProfile();
    toast.success('Mobile number saved!');
  };

  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }

    const savedReferral = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (savedReferral) {
      const refInfo = JSON.parse(savedReferral);
      setReferralInfo(refInfo);
      
      const savedCode = localStorage.getItem('referral_code');
      if (savedCode) {
        setPromoterCode(savedCode);
        verifyPromoterCode(savedCode);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (cartItems.length > 0) {
      fetchProductDiscounts();
    }
  }, [cartItems]);

  const fetchProductDiscounts = async () => {
    const productIds = cartItems.map(item => item.id);
    const { data } = await supabase
      .from('products')
      .select('id, promoter_code_discount, commission_rate')
      .in('id', productIds);

    if (data) {
      const discounts: Record<string, number> = {};
      data.forEach(p => {
        discounts[p.id] = p.promoter_code_discount || 0;
      });
      setProductDiscounts(discounts);
    }
  };

  const verifyPromoterCode = async (code: string, showToast = true): Promise<boolean> => {
    if (!code.trim()) {
      if (showToast) toast.error('Please enter a promoter code');
      return false;
    }

    setVerifyingCode(true);
    try {
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

      setReferralInfo({
        promoter_id: data.promoter_id,
        referral_link_id: data.referral_link_id
      });

      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({
        promoter_id: data.promoter_id,
        referral_link_id: data.referral_link_id
      }));
      localStorage.setItem('referral_code', data.link_code);

      if (showToast) {
        if (promoterTier === 'premium') {
          toast.success('Promoter code applied! You\'ll get a discount.');
        } else {
          toast.success('Promoter code applied! (No discount - free tier)');
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
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    localStorage.removeItem('referral_code');
    toast.success('Promoter code removed');
  };

  const updateCart = (items: CartItem[]) => {
    setCartItems(items);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: items.length }));
  };

  const updateQuantity = (id: string, delta: number) => {
    const updatedItems = cartItems.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    });
    updateCart(updatedItems);
  };

  const removeItem = (id: string) => {
    const updatedItems = cartItems.filter(item => item.id !== id);
    updateCart(updatedItems);
    toast.success('Item removed from cart');
  };

  const clearCart = () => {
    updateCart([]);
    toast.success('Cart cleared');
  };

  const hasPhysicalProducts = cartItems.some(item => !item.is_digital);
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const calculateDiscount = () => {
    if (!promoterCodeInfo?.verified || promoterCodeInfo?.promoter_tier !== 'premium') return 0;
    return cartItems.reduce((sum, item) => {
      const discountPercent = productDiscounts[item.id] || 0;
      return sum + (item.price * item.quantity * discountPercent / 100);
    }, 0);
  };
  
  const isPremiumPromoter = promoterCodeInfo?.promoter_tier === 'premium';
  const discountAmount = calculateDiscount();
  const finalTotal = subtotal - discountAmount + shippingCharge;

  // Fetch shipping config from DB
  useEffect(() => {
    const fetchShippingConfig = async () => {
      const { data } = await supabase
        .from('order_settings')
        .select('setting_value')
        .eq('setting_key', 'shipping_charge_config')
        .maybeSingle();
      if (data?.setting_value) {
        const val = data.setting_value as any;
        setShippingConfig({
          slabs: val.slabs || [{ max_weight_grams: 500, charge: 60 }, { max_weight_grams: 1000, charge: 80 }, { max_weight_grams: 2000, charge: 120 }],
          extra_per_kg: val.extra_per_kg ?? 40,
          free_above: val.free_above ?? 2500,
          half_discount_above: val.half_discount_above ?? 1000,
        });
      } else {
        setShippingConfig({
          slabs: [{ max_weight_grams: 500, charge: 60 }, { max_weight_grams: 1000, charge: 80 }, { max_weight_grams: 2000, charge: 120 }],
          extra_per_kg: 40,
          free_above: 2500,
          half_discount_above: 1000,
        });
      }
    };
    fetchShippingConfig();
  }, []);

  // Slab-based shipping calculation using config
  const calculateSlabShipping = (totalWeightGrams: number): number => {
    const cfg = shippingConfig;
    if (!cfg) return 60; // fallback
    const sortedSlabs = [...cfg.slabs].sort((a, b) => a.max_weight_grams - b.max_weight_grams);
    for (const slab of sortedSlabs) {
      if (totalWeightGrams <= slab.max_weight_grams) return slab.charge;
    }
    // Above max slab: use last slab charge + extra per kg
    const lastSlab = sortedSlabs[sortedSlabs.length - 1];
    if (!lastSlab) return 60;
    const extraGrams = totalWeightGrams - lastSlab.max_weight_grams;
    const extraKg = Math.ceil(extraGrams / 1000);
    return lastSlab.charge + extraKg * cfg.extra_per_kg;
  };

  // Apply order-amount based shipping discount
  const applyShippingDiscount = (baseShipping: number, orderAmount: number): { final: number; discount: number; label: string } => {
    const cfg = shippingConfig;
    if (!cfg) return { final: baseShipping, discount: 0, label: '' };
    if (cfg.free_above > 0 && orderAmount >= cfg.free_above) {
      return { final: 0, discount: baseShipping, label: `Free Delivery (order above ₹${cfg.free_above.toLocaleString()})` };
    }
    if (cfg.half_discount_above > 0 && orderAmount >= cfg.half_discount_above) {
      const discounted = Math.round(baseShipping / 2);
      return { final: discounted, discount: baseShipping - discounted, label: `50% off delivery (order ₹${cfg.half_discount_above.toLocaleString()}–₹${cfg.free_above.toLocaleString()})` };
    }
    return { final: baseShipping, discount: 0, label: '' };
  };

  // Fetch product weights and calculate slab-based shipping
  const fetchShippingCharges = async () => {
    if (!hasPhysicalProducts) {
      setShippingCharge(0);
      setShippingBreakdown(null);
      return;
    }

    setLoadingShipping(true);
    try {
      const physicalItems = cartItems.filter(i => !i.is_digital);
      const physicalProductIds = physicalItems.map(i => i.id);

      const { data: products } = await supabase
        .from('products')
        .select('id, weight_grams')
        .in('id', physicalProductIds);

      const weightMap = (products || []).reduce<Record<string, number>>((acc, product) => {
        acc[product.id] = product.weight_grams || 500;
        return acc;
      }, {});
      setProductWeightMap(weightMap);

      // Calculate total weight
      let totalWeight = 0;
      for (const item of physicalItems) {
        const weight = weightMap[item.id] || 500;
        totalWeight += weight * item.quantity;
      }

      const baseShipping = calculateSlabShipping(totalWeight);
      const orderAmount = subtotal - discountAmount;
      const { final, discount, label } = applyShippingDiscount(baseShipping, orderAmount);

      setShippingCharge(final);
      setShippingBreakdown({ base: baseShipping, discount, label });
    } catch (err) {
      console.error('Failed to calculate shipping:', err);
      const baseShipping = calculateSlabShipping(500 * cartItems.filter(i => !i.is_digital).length);
      setShippingCharge(baseShipping);
      setShippingBreakdown(null);
    } finally {
      setLoadingShipping(false);
    }
  };

  // Auto-calculate shipping when cart changes and config is loaded
  useEffect(() => {
    if (shippingConfig && cartItems.length > 0 && hasPhysicalProducts) {
      fetchShippingCharges();
    }
  }, [cartItems, shippingConfig, discountAmount]);

  const getPerItemShippingAllocation = (): Record<string, number> => {
    if (shippingCharge <= 0) return {};

    const physicalItems = cartItems.filter(item => !item.is_digital);
    if (physicalItems.length === 0) return {};

    const weightByItem = physicalItems.map(item => ({
      id: item.id,
      weight: (productWeightMap[item.id] || 500) * item.quantity,
    }));

    const totalWeight = weightByItem.reduce((sum, row) => sum + row.weight, 0);
    if (totalWeight <= 0) return {};

    let allocated = 0;
    const allocation: Record<string, number> = {};

    for (let i = 0; i < weightByItem.length; i++) {
      const row = weightByItem[i];
      if (i === weightByItem.length - 1) {
        allocation[row.id] = Math.max(0, shippingCharge - allocated);
      } else {
        const share = Math.round((shippingCharge * row.weight) / totalWeight);
        allocation[row.id] = share;
        allocated += share;
      }
    }

    return allocation;
  };

  // Build cart data for webhook
  const buildCartDataForWebhook = () => {
    const shippingAllocation = getPerItemShippingAllocation();

    return cartItems.map(item => {
      const itemSubtotal = item.price * item.quantity;
      const itemDiscountPercent = productDiscounts[item.id] || 0;
      const itemDiscount = (promoterCodeInfo?.verified && promoterCodeInfo?.promoter_tier === 'premium')
        ? (itemSubtotal * itemDiscountPercent / 100) : 0;
      const itemBaseTotal = itemSubtotal - itemDiscount;
      const itemShipping = item.is_digital ? 0 : (shippingAllocation[item.id] || 0);
      const itemTotal = itemBaseTotal + itemShipping;

      return {
        product_id: item.id,
        buyer_email: buyerEmail.trim().toLowerCase(),
        quantity: item.quantity,
        unit_price: item.price,
        subtotal_amount: itemSubtotal,
        discount_amount: itemDiscount,
        shipping_amount: itemShipping,
        total_amount: itemTotal,
        delivery_address: item.is_digital ? null : deliveryAddress,
        is_digital: item.is_digital,
        promoter_id: promoterCodeInfo?.promoter_id || referralInfo?.promoter_id || null,
        referral_link_id: promoterCodeInfo?.referral_link_id || referralInfo?.referral_link_id || null,
        commission_rate: item.commission_rate
      };
    });
  };

  // Step navigation handlers
  const handleProceedToAddress = () => {
    if (!user) {
      toast.error('Please log in to continue');
      navigate('/auth?redirect=/cart');
      return;
    }

    if (!userPhone) {
      setPhoneDialogOpen(true);
      return;
    }

    if (!buyerEmail.trim() || !buyerEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (hasPhysicalProducts) {
      setCurrentStep('address');
    } else {
      setCurrentStep('payment');
      // Pre-create the Razorpay order when entering payment step
      prepareRazorpayOrder();
    }
  };

  const handleProceedToPayment = async () => {
    // Recalculate shipping before proceeding
    if (hasPhysicalProducts) {
      await fetchShippingCharges();
    }
    setCurrentStep('payment');
    // NOTE: Don't call prepareRazorpayOrder here — shippingCharge state hasn't updated yet.
    // useEffect below will trigger it once shippingCharge settles.
  };

  // Re-prepare Razorpay order when shipping charge updates on payment step
  useEffect(() => {
    if (currentStep === 'payment') {
      prepareRazorpayOrder();
    }
  }, [currentStep, shippingCharge]);

  const handleBackToCart = () => {
    setCurrentStep('cart');
    setPaymentGatewayError(null);
    resetError();
  };

  const handleBackToAddress = () => {
    if (hasPhysicalProducts) {
      setCurrentStep('address');
    } else {
      setCurrentStep('cart');
    }
    setPaymentGatewayError(null);
    resetError();
  };

  // Pre-create Razorpay order when entering payment step
  const prepareRazorpayOrder = async () => {
    if (cartItems.length === 0) return;

    // Verify promoter code if needed
    if (promoterCode.trim() && !promoterCodeInfo?.verified) {
      await verifyPromoterCode(promoterCode, false);
    }

    const cartDataForWebhook = buildCartDataForWebhook();

    await prepareOrder({
      amount: finalTotal,
      currency: 'INR',
      receipt: `cart_${Date.now()}`,
      notes: {
        buyer_email: buyerEmail.trim(),
        buyer_name: buyerName.trim() || null,
        user_id: user?.id || null,
        items_count: cartItems.length,
        promoter_code: promoterCodeInfo?.link_code || null,
        discount_applied: discountAmount,
        cart_data: JSON.stringify(cartDataForWebhook)
      }
    });
  };

  // Handle Pay Now - SYNCHRONOUS, no async before checkout
  const handlePayNow = () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    // Check if in-app browser - block payment
    if (inAppBrowserInfo.isInApp) {
      setPaymentGatewayError(`For secure payment, please open this page in Chrome or Safari. ${inAppBrowserInfo.browserName} browser does not support secure payments.`);
      return;
    }

    // Check if order is prepared
    if (!preparedOrder) {
      toast.error('Payment not ready. Please wait a moment and try again.');
      // Try to prepare again
      prepareRazorpayOrder();
      return;
    }

    setProcessing(true);
    setPaymentGatewayError(null);

    const cartDataForWebhook = buildCartDataForWebhook();

    // Open checkout SYNCHRONOUSLY - this will redirect to Razorpay
    openCheckout({
      description: `${cartItems.length} items${promoterCodeInfo ? ' (Discount applied)' : ''}`,
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
        deliveryAddress: hasPhysicalProducts ? deliveryAddress : undefined,
        promoterInfo: promoterCodeInfo || referralInfo || undefined,
        finalTotal
      }
    });
  };

  // Handle COD Order - Creates order directly without payment
  const handleCODOrder = async () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setProcessing(true);
    setPaymentGatewayError(null);

    try {
      const cartDataForWebhook = buildCartDataForWebhook();

      const createdOrders: Array<{ id: string; item: ReturnType<typeof buildCartDataForWebhook>[number]; productName: string }> = [];

      // Create orders directly for each item in cart
      for (const item of cartDataForWebhook) {
        const orderData = {
          product_id: item.product_id as string,
          buyer_email: (item.buyer_email as string).toLowerCase(),
          buyer_name: buyerName.trim() || null,
          user_id: user?.id || null,
          quantity: item.quantity as number,
          unit_price: item.unit_price as number,
          total_amount: item.total_amount as number,
          delivery_address: item.delivery_address as unknown as Json,
          is_digital: item.is_digital as boolean,
          status: 'pending',
          payment_id: 'COD',
          promoter_id: item.promoter_id as string | null,
          referral_link_id: item.referral_link_id as string | null
        };

        const { data: createdOrder, error } = await supabase
          .from('orders')
          .insert(orderData)
          .select('id')
          .single();

        if (error || !createdOrder) {
          console.error('Error creating COD order:', error);
          toast.error('Failed to place order. Please try again.');
          setProcessing(false);
          return;
        }

        const productName = cartItems.find(ci => ci.id === item.product_id)?.name || 'your product';
        createdOrders.push({ id: createdOrder.id, item, productName });
      }

      // Send order confirmation notifications for each created order
      for (const created of createdOrders) {
        const { item, productName, id: createdOrderId } = created;

        if (user?.id) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            title: '🛒 Order Placed Successfully!',
            message: `Your Cash on Delivery order for "${productName}" (Qty: ${item.quantity}) worth ₹${(item.total_amount as number).toLocaleString()} has been placed. Please keep the payment ready at the time of delivery.`,
            type: 'success',
            is_read: false,
          });
        }

        supabase.functions.invoke('send-notification', {
          body: {
            type: 'order_placed_alert',
            data: {
              order_id: createdOrderId,
              product_id: item.product_id as string,
              product_name: productName,
              buyer_name: buyerName.trim() || null,
              buyer_email: item.buyer_email as string,
              quantity: item.quantity,
              total_amount: item.total_amount,
              payment_method: 'Cash on Delivery',
              vendor_id: null,
            }
          }
        }).catch(err => console.error('Order alert email failed (non-blocking):', err));
      }

      // Auto-create Delhivery shipments for physical COD orders
      const physicalOrderIds = createdOrders
        .filter(order => !(order.item.is_digital as boolean))
        .map(order => order.id);

      if (physicalOrderIds.length > 0) {
        await Promise.allSettled(
          physicalOrderIds.map((orderId) =>
            supabase.functions.invoke('delhivery', {
              body: { action: 'auto_create_shipment', order_id: orderId }
            })
          )
        );
      }

      // Clear cart after successful order
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      localStorage.removeItem('referral_code');
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: 0 }));
      
      toast.success('Order placed successfully! Pay on delivery.');
      navigate('/order-confirmation?payment=cod');
    } catch (error) {
      console.error('COD order error:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Render empty cart state
  if (cartItems.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto py-8 px-4 pb-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-primary/10">
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display">Shopping Cart</h1>
              <p className="text-muted-foreground">0 items in cart</p>
            </div>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-4">Browse products and add them to your cart</p>
              <Button onClick={() => navigate('/')}>
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        </div>
        <ShopperNavFooter />
      </Layout>
    );
  }

  // Determine if Pay button should be enabled
  const isPayButtonEnabled = isScriptReady && preparedOrder && !isPreparing && !processing;

  return (
    <Layout>
      {/* Payment Overlay - blocks all touch events when payment is processing */}
      <PaymentOverlay isActive={processing} />

      <div className="container mx-auto py-8 px-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-primary/10">
            <ShoppingCart className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold font-display">Checkout</h1>
            <p className="text-muted-foreground">{cartItems.length} items</p>
          </div>
        </div>

        {/* Step Indicator */}
        <CheckoutSteps currentStep={currentStep} hasPhysicalProducts={hasPhysicalProducts} />

        {/* STEP 1: Cart */}
        {currentStep === 'cart' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-lg font-bold text-primary">₹{item.price.toLocaleString()}</p>
                        {item.is_digital && (
                          <span className="text-xs text-muted-foreground">Digital Product</span>
                        )}
                        {promoterCodeInfo?.verified && productDiscounts[item.id] > 0 && isPremiumPromoter && (
                          <Badge variant="secondary" className="mt-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {productDiscounts[item.id]}% off
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, -1)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm font-medium">₹{(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" onClick={clearCart} className="w-full">
                Clear Cart
              </Button>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Promoter Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Promoter Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {promoterCodeInfo?.verified ? (
                    <div className={`p-3 rounded-lg border ${isPremiumPromoter ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className={`h-5 w-5 ${isPremiumPromoter ? 'text-green-600' : 'text-blue-600'}`} />
                          <span className={`font-medium ${isPremiumPromoter ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'}`}>
                            {promoterCodeInfo.link_code}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={removePromoterCode}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {isPremiumPromoter && discountAmount > 0 && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          Saving ₹{discountAmount.toLocaleString()}!
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter promoter code"
                        value={promoterCode}
                        onChange={(e) => setPromoterCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && verifyPromoterCode(promoterCode)}
                      />
                      <Button onClick={() => verifyPromoterCode(promoterCode)} disabled={verifyingCode || !promoterCode.trim()}>
                        {verifyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-₹{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Delivery</span>
                      <span className={shippingCharge > 0 ? '' : 'text-green-600'}>
                        {shippingCharge > 0 ? `₹${shippingCharge.toLocaleString()}` : 'Free'}
                      </span>
                    </div>
                    {shippingBreakdown && shippingBreakdown.discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>{shippingBreakdown.label}</span>
                        <span>-₹{shippingBreakdown.discount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>₹{finalTotal.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyer_email">Email *</Label>
                    <Input
                      id="buyer_email"
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer_name">Name</Label>
                    <Input
                      id="buyer_name"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Continue Button */}
              <Button onClick={handleProceedToAddress} className="w-full" size="lg">
                {hasPhysicalProducts ? 'Continue to Address' : 'Continue to Payment'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Address (only for physical products) */}
        {currentStep === 'address' && user && (
          <div className="max-w-2xl mx-auto">
            <AddressStep
              userId={user.id}
              deliveryAddress={deliveryAddress}
              onAddressChange={setDeliveryAddress}
              onBack={handleBackToCart}
              onContinue={handleProceedToPayment}
            />
          </div>
        )}

        {/* STEP 3: Payment - READ ONLY, NO INPUT FIELDS */}
        {currentStep === 'payment' && (
          <div className="max-w-2xl mx-auto">
            <PaymentStep
              cartItems={cartItems}
              buyerEmail={buyerEmail}
              buyerName={buyerName}
              deliveryAddress={hasPhysicalProducts ? deliveryAddress : null}
              hasPhysicalProducts={hasPhysicalProducts}
              subtotal={subtotal}
              discountAmount={discountAmount}
              shippingCharge={shippingCharge}
              finalTotal={finalTotal}
              promoterCodeInfo={promoterCodeInfo ? { link_code: promoterCodeInfo.link_code, promoter_tier: promoterCodeInfo.promoter_tier } : null}
              isProcessing={processing || isPreparing}
              isPayEnabled={isPayButtonEnabled}
              isInAppBrowser={inAppBrowserInfo.isInApp}
              inAppBrowserName={inAppBrowserInfo.browserName}
              paymentError={paymentGatewayError}
              onBack={handleBackToAddress}
              onPay={handlePayNow}
              onCOD={handleCODOrder}
            />
          </div>
        )}

        {/* Phone Number Dialog */}
        <PhoneNumberDialog
          open={phoneDialogOpen}
          onOpenChange={setPhoneDialogOpen}
          userId={user?.id || ''}
          onPhoneConfirmed={handlePhoneConfirmed}
        />
      </div>

      <ShopperNavFooter />
    </Layout>
  );
}
