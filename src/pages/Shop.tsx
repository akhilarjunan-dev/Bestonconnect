import { useState, useEffect, useRef } from 'react';
import { ProductGridSkeleton } from '@/components/skeletons/ProductCardSkeleton';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { ShopperNavFooter } from '@/components/navigation/ShopperNavFooter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageGallery } from '@/components/ui/image-gallery';
import { ProductReviews } from '@/components/products/ProductReviews';
import { PhoneNumberDialog } from '@/components/checkout/PhoneNumberDialog';
import { PaymentOverlay } from '@/components/checkout/PaymentOverlay';
import { useCart } from '@/hooks/useCart';
import { useDeliveryCoverage } from '@/hooks/useDeliveryCoverage';
import { useWishlist } from '@/hooks/useWishlist';
import { useRazorpayCheckout, storeCheckoutData } from '@/hooks/useRazorpayCheckout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Package, Search, ShoppingCart, CheckCircle, Loader2, Star, MapPin, Mail, Truck, XCircle, Eye, ArrowLeft, Plus, Heart, ArrowUpDown, ChevronLeft, ChevronRight, Shirt, Laptop, Footprints, Watch, Grid3X3, Tag, X, AlertCircle, Clock } from 'lucide-react';

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
  vendor_id: string | null;
  available_from: string | null;
  available_to: string | null;
  availability_slots: { from: string; to: string }[] | null;
  vendor_name?: string | null;
  is_featured?: boolean;
  is_hot_deal?: boolean;
}

interface ReferralInfo {
  id: string;
  link_code: string;
  promoter_id: string;
  product_id: string | null;
}

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface Order {
  id: string;
  product_id: string;
  buyer_email: string;
  buyer_name: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  delivery_address: DeliveryAddress | null;
  is_digital: boolean;
  status: string;
  tracking_info: { carrier?: string; tracking_number?: string; url?: string } | null;
  order_id: string | null;
  created_at: string;
  cancelled_at: string | null;
  delivered_at: string | null;
  payment_id: string | null;
}

interface Category {
  id: string;
  name: string;
  image_url: string | null;
}

interface HomeSection {
  id: string;
  section_key: string;
  title: string;
  emoji: string | null;
  is_enabled: boolean;
  display_order: number;
  image_url: string | null;
  selected_category_ids: string[] | null;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_type: 'product' | 'category' | 'external';
  link_value: string;
  position?: 'top' | 'center';
  media_type?: 'image' | 'video';
}

type SortOption = 'name' | 'price_low' | 'price_high' | 'newest' | 'popular';

export default function Shop() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refCode = searchParams.get('ref');
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const { isProductAvailable, getVendorDeliveryType } = useDeliveryCoverage();
  
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
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);
  
  // Two-step checkout state: 'details' = collect info, 'payment' = ready to pay
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'payment'>('details');
  const [paymentGatewayError, setPaymentGatewayError] = useState<string | null>(null);
  
  // Promoter code state
  const [promoterCode, setPromoterCode] = useState('');
  const [promoterCodeInfo, setPromoterCodeInfo] = useState<{
    promoter_id: string;
    referral_link_id: string;
    link_code: string;
    verified: boolean;
    promoter_tier: 'free' | 'premium';
  } | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  
  // Phone number collection state
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  
  // Delivery address fields
  const [deliveryAddress, setDeliveryAddress] = useState({
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

  const handleAddToCart = (product: Product) => {
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

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBanners();
    fetchHomeSections();
    if (refCode) {
      trackReferralClick(refCode);
    }
  }, [refCode]);

  const fetchHomeSections = async () => {
    const { data, error } = await supabase
      .from('home_sections')
      .select('*')
      .eq('is_enabled', true)
      .order('display_order');

    if (!error && data) {
      setHomeSections(data as HomeSection[]);
    }
  };

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Parallax scroll effect for banner
  useEffect(() => {
    const handleScroll = () => {
      if (bannerRef.current) {
        const rect = bannerRef.current.getBoundingClientRect();
        // Only apply effect when banner is visible
        if (rect.bottom > 0) {
          setScrollY(window.scrollY * 0.4); // Parallax speed factor
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from('banners')
      .select('id, title, image_url, link_type, link_value, position, media_type')
      .eq('is_active', true)
      .order('display_order');

    if (!error && data) {
      setBanners(data as Banner[]);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, image_url')
      .eq('is_active', true)
      .order('display_order')
      .order('name');

    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, mrp, unit, unit_quantity, discount_type, discount_value, category, image_urls, is_digital, shopper_discount_percent, vendor_id, available_from, available_to, availability_slots, is_featured, is_hot_deal')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Failed to load products');
      return;
    }

    // Fetch vendor names separately to avoid RLS issues for anonymous users
    const vendorIds = [...new Set((data || []).map(p => p.vendor_id).filter(Boolean))];
    let vendorMap: Record<string, string> = {};
    if (vendorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', vendorIds);
      if (profiles) {
        vendorMap = Object.fromEntries(
          profiles.map(p => [p.id, p.full_name?.split(' ')[0] || ''])
        );
      }
    }

    const productsWithVendor = (data || []).map((p: any) => ({
      ...p,
      commission_rate: p.shopper_discount_percent ?? 0,
      promoter_code_discount: p.shopper_discount_percent ?? 0,
      vendor_name: p.vendor_id ? vendorMap[p.vendor_id] || null : null,
    }));

    setProducts(productsWithVendor);
    setLoading(false);
  };

  const verifyPromoterCode = async (code: string, showToast = true): Promise<boolean> => {
    if (!code.trim()) return false;

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

      // Update referral info
      setReferralInfo({
        link_code: data.link_code,
        promoter_id: data.promoter_id,
        product_id: selectedProduct?.id || null,
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
    toast.success('Promoter code removed');
  };

  // Calculate discount (only for premium tier promoters)
  const getDiscountAmount = () => {
    if (!selectedProduct || !promoterCodeInfo?.verified) return 0;
    if (promoterCodeInfo.promoter_tier !== 'premium') return 0;
    return selectedProduct.price * quantity * (selectedProduct.promoter_code_discount || 0) / 100;
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

      setReferralInfo(linkData);

      // Save referral info to localStorage for cart persistence
      localStorage.setItem('bestonconnect_referral', JSON.stringify({
        promoter_id: linkData.promoter_id,
        referral_link_id: linkData.id,
      }));

      // Track click (use stored casing so DB update matches)
      await supabase.functions.invoke('track-referral', {
        body: { action: 'track_click', link_code: linkData.link_code },
      });

      // If this is a product referral link, deep-link to the product detail
      if (linkData.product_id) {
        navigate(`/product/${linkData.product_id}?ref=${encodeURIComponent(linkData.link_code)}`, {
          replace: true,
        });
      }
    } catch (error) {
      console.error('Error tracking referral:', error);
    }
  };

  const handleBuyNow = async (product: Product) => {
    // Require login before checkout
    if (!user) {
      toast.error('Please log in to complete your purchase');
      navigate(`/auth?redirect=/shop`);
      return;
    }
    
    // Check if user has phone number saved
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle();

    // If no phone number, prompt for it first
    if (!profile?.phone) {
      setPendingProduct(product);
      setPhoneDialogOpen(true);
      return;
    }

    // Add product to cart and navigate to cart checkout
    proceedToBuyNow(product);
  };

  const proceedToBuyNow = (product: Product) => {
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
    if (pendingProduct) {
      proceedToBuyNow(pendingProduct);
    }
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  };

  const fetchUserOrders = async () => {
    if (!user?.id) {
      toast.info('Please log in to view your orders');
      return;
    }

    setLoadingOrders(true);
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch orders');
      setLoadingOrders(false);
      return;
    }

    const typedOrders = (data || []).map(order => ({
      ...order,
      delivery_address: order.delivery_address as unknown as DeliveryAddress | null,
      tracking_info: order.tracking_info as unknown as { carrier?: string; tracking_number?: string; url?: string } | null
    }));
    setOrders(typedOrders);
    setLoadingOrders(false);
  };

  const handleTrackOrders = () => {
    setOrdersOpen(true);
    fetchUserOrders();
  };

  const handleBannerClick = (banner: Banner) => {
    if (banner.link_type === 'product') {
      const product = products.find(p => p.id === banner.link_value);
      if (product) {
        handleViewDetails(product);
      }
    } else if (banner.link_type === 'category') {
      setSelectedCategory(banner.link_value);
    } else if (banner.link_type === 'external') {
      window.open(banner.link_value, '_blank');
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    // Find the order to check payment type
    const orderToCancel = orders.find(o => o.id === orderId);

    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled', 
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelled by customer'
      })
      .eq('id', orderId)
      .eq('status', 'pending');

    if (error) {
      toast.error('Failed to cancel order. Only pending orders can be cancelled.');
      return;
    }

    const isCOD = orderToCancel?.payment_id === 'COD';

    // Notify buyer
    if (user) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '❌ Order Cancelled',
        message: isCOD
          ? `Your COD order has been cancelled successfully. No refund needed.`
          : `Your prepaid order has been cancelled. A refund will be processed shortly.`,
        type: 'info',
        is_read: false,
      });
    }

    // For prepaid, notify admins and managers
    if (!isCOD && orderToCancel) {
      const { data: adminManagerRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'manager']);

      if (adminManagerRoles?.length) {
        const productInfo = products.find(p => p.id === orderToCancel.product_id);
        const notifications = adminManagerRoles.map(r => ({
          user_id: r.user_id,
          title: '💰 Refund Required - Order Cancelled',
          message: `Prepaid order for "${productInfo?.name || 'a product'}" (₹${Number(orderToCancel.total_amount).toLocaleString()}, Order: ${orderId.slice(0, 8)}...) was cancelled. Refund action required.`,
          type: 'warning',
          is_read: false,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }

    toast.success(isCOD ? 'Order cancelled successfully' : 'Order cancelled. Refund will be processed by admin.');
    fetchUserOrders();
  };

  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailOpen(true);
  };

  const getProductById = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  // Pre-create Razorpay order when entering payment step (called when user clicks "Proceed to Payment")
  const prepareRazorpayOrder = async () => {
    if (!selectedProduct) return;

    // Verify promoter code if needed
    if (promoterCode.trim() && !promoterCodeInfo?.verified) {
      await verifyPromoterCode(promoterCode, false);
    }

    const discountAmount = getDiscountAmount();
    const subtotal = selectedProduct.price * quantity;
    const finalTotal = subtotal - discountAmount;

    const cartDataForWebhook = [{
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: quantity,
      unit_price: selectedProduct.price,
      total_amount: finalTotal,
      is_digital: selectedProduct.is_digital,
      delivery_address: selectedProduct.is_digital ? null : deliveryAddress,
      promoter_id: promoterCodeInfo?.promoter_id || referralInfo?.promoter_id || null,
      referral_link_id: promoterCodeInfo?.referral_link_id || referralInfo?.id || null,
      commission_rate: selectedProduct.commission_rate,
      buyer_email: buyerEmail.trim()
    }];

    await prepareOrder({
      amount: finalTotal,
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        product_id: selectedProduct.id,
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
    if (!selectedProduct) return;
    
    if (!buyerEmail.trim() || !buyerEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate delivery address for physical products
    if (!selectedProduct.is_digital) {
      if (!deliveryAddress.name || !deliveryAddress.phone || !deliveryAddress.address || 
          !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode) {
        toast.error('Please fill in all delivery address fields');
        return;
      }
    }

    // Move to payment step and pre-create order
    setCheckoutStep('payment');
    setPaymentGatewayError(null);
    resetError();
    await prepareRazorpayOrder();
  };

  // Handle "Pay Now" - SYNCHRONOUS, no async before checkout
  const handlePayNow = () => {
    if (!selectedProduct) return;

    // Check if in-app browser - block payment
    if (inAppBrowserInfo.isInApp) {
      setPaymentGatewayError(`For secure payment, please open this page in Chrome or Safari. ${inAppBrowserInfo.browserName} browser does not support secure payments.`);
      return;
    }

    // Check if order is prepared
    if (!preparedOrder) {
      toast.error('Payment not ready. Please wait a moment and try again.');
      prepareRazorpayOrder();
      return;
    }

    setProcessing(true);
    setPaymentGatewayError(null);

    const discountAmount = getDiscountAmount();
    const subtotal = selectedProduct.price * quantity;
    const finalTotal = subtotal - discountAmount;

    const cartDataForWebhook = [{
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: quantity,
      unit_price: selectedProduct.price,
      total_amount: finalTotal,
      is_digital: selectedProduct.is_digital,
      delivery_address: selectedProduct.is_digital ? null : deliveryAddress,
      promoter_id: promoterCodeInfo?.promoter_id || referralInfo?.promoter_id || null,
      referral_link_id: promoterCodeInfo?.referral_link_id || referralInfo?.id || null,
      commission_rate: selectedProduct.commission_rate,
      buyer_email: buyerEmail.trim()
    }];

    // Open checkout SYNCHRONOUSLY - this will redirect to Razorpay
    openCheckout({
      description: selectedProduct.name + (promoterCodeInfo ? ' (Discount applied)' : ''),
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
        deliveryAddress: selectedProduct.is_digital ? undefined : deliveryAddress,
        promoterInfo: promoterCodeInfo || referralInfo || undefined,
        finalTotal
      }
    });
  };

  // Handle back to details step
  const handleBackToDetails = () => {
    setCheckoutStep('details');
    setPaymentGatewayError(null);
    resetError();
  };

  // Determine if Pay button should be enabled
  const isPayButtonEnabled = isScriptReady && preparedOrder && !isPreparing && !processing;

  const isTimeAvailable = (product: Product) => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Check new multi-slot format first
    const slots = product.availability_slots as { from: string; to: string }[] | null;
    if (slots && slots.length > 0) {
      return slots.some(slot => currentTime >= slot.from.slice(0, 5) && currentTime <= slot.to.slice(0, 5));
    }
    
    // Fallback to legacy single slot
    if (!product.available_from || !product.available_to) return true;
    return currentTime >= product.available_from.slice(0, 5) && currentTime <= product.available_to.slice(0, 5);
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'All Categories' || product.category === selectedCategory;
      const matchesTime = isTimeAvailable(product);
      return matchesSearch && matchesCategory && matchesTime;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_low':
          return a.price - b.price;
        case 'price_high':
          return b.price - a.price;
        case 'newest':
          return 0;
        case 'popular':
          return 0;
        default:
          return a.name.localeCompare(b.name);
      }
    });

  // Hot deals: admin-marked or discount > 0
  const hotDealsProducts = filteredProducts.filter(p => p.is_hot_deal || (p.discount_value && p.discount_value > 0));
  // Featured/recommended: admin-marked or if search active, search-based
  const featuredProducts = searchQuery
    ? filteredProducts.filter(p => p.is_featured || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredProducts.filter(p => p.is_featured);
  // Discount-based sections
  const upto30Products = filteredProducts.filter(p => {
    if (!p.mrp || p.mrp <= p.price) return false;
    const disc = ((p.mrp - p.price) / p.mrp) * 100;
    return disc > 0 && disc <= 30;
  });
  const upto50Products = filteredProducts.filter(p => {
    if (!p.mrp || p.mrp <= p.price) return false;
    const disc = ((p.mrp - p.price) / p.mrp) * 100;
    return disc > 30 && disc <= 50;
  });
  // Category-wise sections: filter by selected_category_ids from 'categories' home section
  const categoriesSection = homeSections.find(s => s.section_key === 'categories');
  const allowedCatIds = categoriesSection?.selected_category_ids?.length ? categoriesSection.selected_category_ids : null;
  const categoryProductGroups = categories
    .filter(cat => !allowedCatIds || allowedCatIds.includes(cat.id))
    .map(cat => ({
      name: cat.name,
      products: filteredProducts.filter(p => p.category === cat.name)
    }))
    .filter(g => g.products.length > 0)
    .slice(0, 6);
  // Free delivery products (no shipping charge)
  const freeDeliveryProducts = filteredProducts.filter(p => !p.is_digital);
  // 3x3 grid products (first 9 for page 2 style)
  const gridProducts = filteredProducts.slice(0, 9);
  // Split banners by position
  const topBanners = banners.filter(b => b.position === 'top' || !b.position);
  const centerBanners = banners.filter(b => b.position === 'center');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600';
      case 'processing': return 'bg-blue-500/10 text-blue-600';
      case 'shipped': return 'bg-purple-500/10 text-purple-600';
      case 'delivered': return 'bg-green-500/10 text-green-600';
      case 'cancelled': return 'bg-red-500/10 text-red-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <ProductGridSkeleton count={8} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Payment Overlay - blocks all touch events when payment is processing */}
      <PaymentOverlay isActive={processing} />

      {/* ═══ STICKY SEARCH BAR ═══ */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border px-3 py-2 md:hidden">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-9 text-sm" />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[100px] h-9 text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">A-Z</SelectItem>
              <SelectItem value="price_low">Low ₹</SelectItem>
              <SelectItem value="price_high">High ₹</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* ═══ SECTION 1: TOP BANNERS ═══ */}
      {topBanners.length > 0 && (
        <div ref={bannerRef} className="relative mb-4 overflow-hidden rounded-xl">
          <div 
            className="relative overflow-hidden cursor-pointer aspect-[3/1]"
            onClick={() => handleBannerClick(topBanners[currentBannerIndex % topBanners.length])}
          >
            {topBanners.map((banner, index) => (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  index === (currentBannerIndex % topBanners.length) ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                {banner.media_type === 'video' ? (
                  <video 
                    src={banner.image_url} 
                    className="w-full h-[120%] object-cover transition-transform duration-100 ease-out"
                    style={{ transform: `translateY(-${scrollY}px) scale(1.1)` }}
                    autoPlay muted loop playsInline
                  />
                ) : (
                  <img 
                    src={banner.image_url} 
                    alt={banner.title}
                    className="w-full h-[120%] object-cover transition-transform duration-100 ease-out"
                    style={{ transform: `translateY(-${scrollY}px) scale(1.1)` }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
                  <div className="p-6">
                    <Badge className="mb-2 bg-primary text-primary-foreground">Special Offer</Badge>
                    <h2 className="text-primary-foreground text-xl sm:text-2xl font-bold">{banner.title}</h2>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {topBanners.length > 1 && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/80 hover:bg-card"
                onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex((prev) => (prev - 1 + topBanners.length) % topBanners.length); }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/80 hover:bg-card"
                onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex((prev) => (prev + 1) % topBanners.length); }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                {topBanners.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i === (currentBannerIndex % topBanners.length) ? 'bg-primary-foreground' : 'bg-primary-foreground/50'}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="container mx-auto px-3 pb-4">
        {/* ═══ SECTION 2: CATEGORIES WITH IMAGES ═══ */}
        {categories.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-foreground">Category</h2>
              <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => { setSelectedCategory('All Categories'); navigate('/products'); }}>
                See All
              </Button>
            </div>
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`flex-shrink-0 w-[calc(27%-4px)] min-w-[85px] max-w-[110px] snap-start flex flex-col items-center gap-2 p-1.5 pb-2 rounded-xl border transition-all ${
                      selectedCategory === cat.name
                        ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-sm'
                        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                    }`}
                  >
                    <div className="w-[72px] h-[72px] rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden">
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Grid3X3 className="h-7 w-7 text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-center line-clamp-2 text-foreground leading-tight">{cat.name}</span>
                  </button>
                ))}
              </div>
              {/* Right fade gradient to hint scrollability */}
              <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent" />
            </div>
          </div>
        )}

        {/* ═══ SECTION 3: SEARCH BAR + FILTER (desktop only, mobile is sticky above) ═══ */}
        <div className="hidden md:flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-9 text-sm" />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[100px] h-9 text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">A-Z</SelectItem>
              <SelectItem value="price_low">Low ₹</SelectItem>
              <SelectItem value="price_high">High ₹</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ═══ SECTION 4: DYNAMIC OFFER SECTIONS ═══ */}
        {(homeSections.length > 0 ? homeSections : [
          { id: 'fallback-hot', section_key: 'hot_deals', title: 'Hot Deals', emoji: '🔥', is_enabled: true, display_order: 0, image_url: null, selected_category_ids: null },
          { id: 'fallback-feat', section_key: 'featured', title: 'Recommended for You', emoji: '⭐', is_enabled: true, display_order: 1, image_url: null, selected_category_ids: null },
          { id: 'fallback-cat', section_key: 'categories', title: 'Categories', emoji: '📂', is_enabled: true, display_order: 2, image_url: null, selected_category_ids: null },
          { id: 'fallback-30', section_key: 'upto_30', title: 'Up to 30% Off', emoji: '💰', is_enabled: true, display_order: 3, image_url: null, selected_category_ids: null },
          { id: 'fallback-50', section_key: 'upto_50', title: 'Up to 50% Off', emoji: '🎉', is_enabled: true, display_order: 4, image_url: null, selected_category_ids: null },
        ]).map((section) => {
          const sectionTitle = `${section.emoji || ''} ${section.title}`.trim();
          const key = section.section_key;

          const renderProductRow = (products: Product[], keyPrefix: string, borderClass: string, badgeRender?: (p: Product) => React.ReactNode, filterPath?: string) => {
            if (products.length === 0) return null;
            return (
              <div key={section.id} className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-1">{sectionTitle}</h2>
                  {filterPath && <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => navigate(filterPath)}>See All</Button>}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {products.slice(0, 10).map((product) => (
                    <Card key={`${keyPrefix}-${product.id}`} className={`overflow-hidden ${borderClass} hover:shadow-md transition-shadow cursor-pointer min-w-[120px] max-w-[120px] flex-shrink-0`} onClick={() => navigate(`/product/${product.id}`)}>
                      <div className="relative bg-muted aspect-square">
                        {product.image_urls?.[0] ? <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground/30" /></div>}
                        {badgeRender?.(product)}
                      </div>
                      <CardContent className="p-1.5">
                        <h3 className="font-medium text-[10px] line-clamp-1">{product.name}</h3>
                        <div className="flex items-center justify-between mt-0.5">
                          <div>
                            <span className="text-xs font-bold text-primary">₹{product.price.toLocaleString()}</span>
                            {product.mrp && product.mrp > product.price && <span className="text-[9px] text-muted-foreground line-through ml-1">₹{product.mrp.toLocaleString()}</span>}
                          </div>
                          <div className="flex gap-0.5">
                            <Button size="sm" variant="outline" className="h-5 text-[9px] px-1" onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}>
                              <ShoppingCart className="h-3 w-3" />
                            </Button>
                            <Button size="sm" className="h-5 text-[9px] px-1.5" onClick={(e) => { e.stopPropagation(); handleBuyNow(product); }}>
                              Buy
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          };

          if (key === 'hot_deals') return renderProductRow(hotDealsProducts, 'hot', 'border border-destructive/20', (p) => p.discount_value && p.discount_value > 0 ? <Badge className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-[9px] px-1 py-0">{p.discount_type === 'percentage' ? `${p.discount_value}%` : `₹${p.discount_value}`} OFF</Badge> : null, '/products?filter=hot_deals');
          if (key === 'featured') return renderProductRow(featuredProducts, 'feat', 'border border-primary/20', () => <Badge className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] px-1 py-0">⭐</Badge>, '/products?filter=featured');
          if (key === 'upto_30') return renderProductRow(upto30Products, '30', 'border border-warning/20', (p) => <Badge className="absolute top-1 left-1 bg-warning text-warning-foreground text-[9px] px-1 py-0">{Math.round(((p.mrp! - p.price) / p.mrp!) * 100)}% OFF</Badge>, '/products?filter=upto30');
          if (key === 'upto_50') return renderProductRow(upto50Products, '50', 'border border-earnings/20', (p) => <Badge className="absolute top-1 left-1 bg-earnings text-earnings-foreground text-[9px] px-1 py-0">{Math.round(((p.mrp! - p.price) / p.mrp!) * 100)}% OFF</Badge>, '/products?filter=upto50');

          if (key === 'categories' && categoryProductGroups.length > 0) {
            return (
              <div key={section.id}>
                {categoryProductGroups.map((group) => (
                  <div key={`catgroup-${group.name}`} className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold text-foreground flex items-center gap-1">📂 {group.name}</h2>
                      <Button variant="link" size="sm" className="text-primary text-xs p-0 h-auto" onClick={() => { setSelectedCategory(group.name); navigate('/products'); }}>See All</Button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {group.products.slice(0, 10).map((product) => (
                        <Card key={`cat-${product.id}`} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer min-w-[120px] max-w-[120px] flex-shrink-0" onClick={() => navigate(`/product/${product.id}`)}>
                          <div className="relative bg-muted aspect-square">
                            {product.image_urls?.[0] ? <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground/30" /></div>}
                          </div>
                          <CardContent className="p-1.5">
                            <h3 className="font-medium text-[10px] line-clamp-1">{product.name}</h3>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs font-bold text-foreground">₹{product.price.toLocaleString()}</span>
                              <div className="flex gap-0.5">
                                <Button size="sm" variant="outline" className="h-5 text-[9px] px-1" onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}>
                                  <ShoppingCart className="h-3 w-3" />
                                </Button>
                                <Button size="sm" className="h-5 text-[9px] px-1.5" onClick={(e) => { e.stopPropagation(); handleBuyNow(product); }}>
                                  Buy
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          return null;
        })}

        {/* ═══ SECTION 5: ALL PRODUCTS 3×3 GRID ═══ */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">All Products</h2>
          <span className="text-[10px] text-muted-foreground">{filteredProducts.length} items</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No products found.</p>
          </div>
        ) : (
          <>
            {/* First 9 products in 3×3 grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {gridProducts.map((product) => {
                const available = isProductAvailable(product.vendor_id);
                return (
                  <Card
                    key={`grid-${product.id}`}
                    className={`overflow-hidden transition-shadow cursor-pointer ${available ? 'hover:shadow-md' : 'opacity-60 grayscale'}`}
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <div className="relative bg-muted aspect-square">
                      {product.image_urls?.[0] ? (
                        <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground/30" /></div>
                      )}
                      {product.discount_value && product.discount_value > 0 && (
                        <Badge className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] px-1 py-0">
                          {product.discount_type === 'percentage' ? `${product.discount_value}%` : `₹${product.discount_value}`} OFF
                        </Badge>
                      )}
                      {!available && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-20">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-1.5">
                      <h3 className="font-medium text-[10px] line-clamp-2 leading-tight">{product.name}</h3>
                      <div className="flex items-center justify-between mt-0.5">
                        <div>
                          <span className="text-xs font-bold text-foreground">₹{product.price.toLocaleString()}</span>
                          {product.mrp && product.mrp > product.price && (
                            <span className="text-[9px] text-muted-foreground line-through ml-1">₹{product.mrp.toLocaleString()}</span>
                          )}
                        </div>
                        <div className="flex gap-0.5">
                          <Button size="sm" variant="outline" className="h-5 text-[9px] px-1" onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }} disabled={!available}>
                            <ShoppingCart className="h-3 w-3" />
                          </Button>
                          <Button size="sm" className="h-5 text-[9px] px-1.5" onClick={(e) => { e.stopPropagation(); handleBuyNow(product); }} disabled={!available}>
                            {available ? 'Buy' : 'N/A'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ═══ SECTION 6: CENTER BANNERS ═══ */}
            {centerBanners.length > 0 && (
              <div className="space-y-3 mb-4">
                {centerBanners.map((banner) => (
                  <div key={banner.id} className="rounded-xl overflow-hidden cursor-pointer" onClick={() => handleBannerClick(banner)}>
                    {banner.media_type === 'video' ? (
                      <video src={banner.image_url} className="w-full aspect-[3/1] object-cover" autoPlay muted loop playsInline />
                    ) : (
                      <img src={banner.image_url} alt={banner.title} className="w-full aspect-[3/1] object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ═══ SECTION 7: REMAINING ALL PRODUCTS ═══ */}
            {filteredProducts.length > 9 && (
              <>
                <div className="flex items-center justify-between mb-2 mt-2">
                  <h2 className="text-sm font-bold text-foreground">More Products</h2>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-8">
                  {filteredProducts.slice(9).map((product) => {
                    const available = isProductAvailable(product.vendor_id);
                    return (
                      <Card
                        key={product.id}
                        className={`overflow-hidden transition-shadow cursor-pointer ${available ? 'hover:shadow-md' : 'opacity-60 grayscale'}`}
                        onClick={() => navigate(`/product/${product.id}`)}
                      >
                        <div className="relative bg-muted aspect-square">
                          {product.image_urls?.[0] ? (
                            <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground/30" /></div>
                          )}
                          {product.is_featured && (
                            <Badge className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] px-1 py-0">⭐</Badge>
                          )}
                          {product.discount_value && product.discount_value > 0 && (
                            <Badge className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] px-1 py-0">
                              {product.discount_type === 'percentage' ? `${product.discount_value}%` : `₹${product.discount_value}`} OFF
                            </Badge>
                          )}
                          {!available && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-20">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-1.5">
                          <h3 className="font-medium text-[10px] line-clamp-2 leading-tight">{product.name}</h3>
                          {product.mrp && product.mrp > product.price && (
                            <p className="text-[9px] text-muted-foreground line-through leading-none">₹{product.mrp.toLocaleString()}</p>
                          )}
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs font-bold text-foreground">₹{product.price.toLocaleString()}</span>
                            <div className="flex gap-0.5">
                              <Button size="sm" variant="outline" className="h-5 text-[9px] px-1" onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }} disabled={!available}>
                                <ShoppingCart className="h-3 w-3" />
                              </Button>
                              <Button size="sm" className="h-5 text-[9px] px-1.5" onClick={(e) => { e.stopPropagation(); handleBuyNow(product); }} disabled={!available}>
                                {available ? 'Buy' : 'N/A'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Checkout Dialog */}
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {orderComplete ? 'Order Confirmed!' : 'Complete Your Purchase'}
              </DialogTitle>
              <DialogDescription>
                {orderComplete 
                  ? 'Thank you for your order. A confirmation has been sent to your email.'
                  : `Purchase ${selectedProduct?.name}`
                }
              </DialogDescription>
            </DialogHeader>

            {orderComplete ? (
              <div className="py-8 text-center">
                <CheckCircle className="h-16 w-16 text-earnings mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Order Successful!</p>
                <p className="text-muted-foreground mb-2">
                  Total: ₹{((selectedProduct?.price || 0) * quantity).toLocaleString()}
                </p>
                {selectedProduct?.is_digital && (
                  <p className="text-sm text-info">
                    Your digital product will be sent to your email shortly.
                  </p>
                )}
                <Button className="mt-6" onClick={() => setCheckoutOpen(false)}>
                  Continue Shopping
                </Button>
              </div>
            ) : checkoutStep === 'details' ? (
              <>
                {selectedProduct && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      {selectedProduct.image_urls && selectedProduct.image_urls[0] ? (
                        <img
                          src={selectedProduct.image_urls[0]}
                          alt={selectedProduct.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold">{selectedProduct.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          ₹{selectedProduct.price.toLocaleString()} each
                        </p>
                        {selectedProduct.is_digital && (
                          <Badge variant="secondary" className="mt-1">Digital Product</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="buyerName">Name</Label>
                        <Input
                          id="buyerName"
                          placeholder="Your name"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={buyerEmail}
                          onChange={(e) => setBuyerEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Delivery Address for Physical Products */}
                    {!selectedProduct.is_digital && (
                      <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h4 className="font-medium">Delivery Address</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="deliveryName">Full Name *</Label>
                            <Input
                              id="deliveryName"
                              placeholder="Receiver name"
                              value={deliveryAddress.name}
                              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number *</Label>
                            <Input
                              id="phone"
                              placeholder="10-digit number"
                              value={deliveryAddress.phone}
                              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Address *</Label>
                          <Textarea
                            id="address"
                            placeholder="House/Flat No., Building, Street"
                            value={deliveryAddress.address}
                            onChange={(e) => setDeliveryAddress({ ...deliveryAddress, address: e.target.value })}
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="city">City *</Label>
                            <Input
                              id="city"
                              placeholder="City"
                              value={deliveryAddress.city}
                              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="state">State *</Label>
                            <Input
                              id="state"
                              placeholder="State"
                              value={deliveryAddress.state}
                              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, state: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="pincode">Pincode *</Label>
                            <Input
                              id="pincode"
                              placeholder="6-digit"
                              value={deliveryAddress.pincode}
                              onChange={(e) => setDeliveryAddress({ ...deliveryAddress, pincode: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Email Notice for Digital Products */}
                    {selectedProduct.is_digital && (
                      <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-info" />
                          <h4 className="font-medium text-info">Digital Delivery</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Your digital product will be sent to the email address provided above immediately after payment.
                        </p>
                      </div>
                    )}

                    {/* Promoter Code Section */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <h4 className="font-medium">Have a Promoter Code?</h4>
                      </div>
                      {promoterCodeInfo?.verified ? (
                        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                              Code applied: <span className="text-primary">{promoterCodeInfo.link_code}</span>
                            </span>
                            {promoterCodeInfo.promoter_tier === 'premium' && selectedProduct.promoter_code_discount && (
                              <span className="text-xs text-primary">
                                ({selectedProduct.promoter_code_discount}% off)
                              </span>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={removePromoterCode}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter promoter code"
                            value={promoterCode}
                            onChange={(e) => setPromoterCode(e.target.value.toUpperCase())}
                            className="flex-1"
                          />
                          <Button 
                            onClick={() => verifyPromoterCode(promoterCode)}
                            disabled={verifyingCode || !promoterCode.trim()}
                          >
                            {verifyingCode ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Apply'
                            )}
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Enter a promoter code to get discounts and support your promoter!
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="10"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>

                    {/* Order Summary */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      {verifyingCode && (
                        <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Validating promoter code...</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>₹{(selectedProduct.price * quantity).toLocaleString()}</span>
                      </div>
                      {promoterCodeInfo?.verified && promoterCodeInfo.promoter_tier === 'premium' && getDiscountAmount() > 0 && (
                        <div className="flex justify-between text-sm text-primary">
                          <span>Promoter Discount ({selectedProduct.promoter_code_discount}%)</span>
                          <span>-₹{getDiscountAmount().toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Total</span>
                        <span>₹{((selectedProduct.price * quantity) - getDiscountAmount()).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleProceedToPayment} disabled={verifyingCode}>
                    Proceed to Payment
                  </Button>
                </DialogFooter>
              </>
            ) : (
              /* Step 2: Payment (read-only summary, no input fields) */
              <>
                {selectedProduct && (
                  <div className="space-y-4">
                    {/* Order Summary - Read Only */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex items-center gap-4">
                        {selectedProduct.image_urls && selectedProduct.image_urls[0] ? (
                          <img
                            src={selectedProduct.image_urls[0]}
                            alt={selectedProduct.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{selectedProduct.name}</p>
                          <p className="text-sm text-muted-foreground">Qty: {quantity} × ₹{selectedProduct.price.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {/* Price breakdown */}
                      <div className="pt-3 border-t space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span>₹{(selectedProduct.price * quantity).toLocaleString()}</span>
                        </div>
                        {promoterCodeInfo?.verified && promoterCodeInfo.promoter_tier === 'premium' && getDiscountAmount() > 0 && (
                          <div className="flex justify-between text-sm text-primary">
                            <span>Discount</span>
                            <span>-₹{getDiscountAmount().toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2">
                          <span>Total</span>
                          <span>₹{((selectedProduct.price * quantity) - getDiscountAmount()).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Info - Read Only */}
                    {!selectedProduct.is_digital && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="h-4 w-4 text-primary" />
                          <span className="font-medium">Delivering to</span>
                        </div>
                        <p className="text-sm">{deliveryAddress.name}</p>
                        <p className="text-sm text-muted-foreground">{deliveryAddress.address}</p>
                        <p className="text-sm text-muted-foreground">{deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}</p>
                        <p className="text-sm text-muted-foreground">Phone: {deliveryAddress.phone}</p>
                      </div>
                    )}

                    {/* In-App Browser Warning */}
                    {paymentGatewayError && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                          <div>
                            <p className="font-medium text-destructive">Payment Not Available</p>
                            <p className="text-sm text-muted-foreground">{paymentGatewayError}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Loading State */}
                    {isPreparing && (
                      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Preparing payment...</span>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="gap-2">
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
                      `Pay ₹${(((selectedProduct?.price || 0) * quantity) - getDiscountAmount()).toLocaleString()}`
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Product Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedProduct.name}</DialogTitle>
                  <DialogDescription>
                    {selectedProduct.category} • {selectedProduct.unit_quantity} {selectedProduct.unit}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 && (
                    <ImageGallery
                      images={selectedProduct.image_urls}
                      alt={selectedProduct.name}
                    />
                  )}
                  
                  <div className="flex items-center gap-4">
                    {selectedProduct.mrp && selectedProduct.mrp > selectedProduct.price && (
                      <span className="text-lg text-muted-foreground line-through">
                        ₹{selectedProduct.mrp.toLocaleString()}
                      </span>
                    )}
                    <span className="text-2xl font-bold">₹{selectedProduct.price.toLocaleString()}</span>
                    {selectedProduct.discount_value && selectedProduct.discount_value > 0 && (
                      <Badge className="bg-destructive">
                        {selectedProduct.discount_type === 'percentage' 
                          ? `${selectedProduct.discount_value}% OFF` 
                          : `₹${selectedProduct.discount_value} OFF`}
                      </Badge>
                    )}
                  </div>

                  <p className="text-muted-foreground">{selectedProduct.description}</p>

                  <div className="flex gap-2">
                    {selectedProduct.is_digital && (
                      <Badge variant="secondary">Digital Product</Badge>
                    )}
                  </div>

                  <Button className="w-full" onClick={() => {
                    setDetailOpen(false);
                    handleBuyNow(selectedProduct);
                  }}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy Now - ₹{selectedProduct.price.toLocaleString()}
                  </Button>

                  {/* Reviews Section */}
                  <ProductReviews productId={selectedProduct.id} productName={selectedProduct.name} />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Track Orders Dialog */}
        <Dialog open={ordersOpen} onOpenChange={setOrdersOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Your Order History</DialogTitle>
              <DialogDescription>
                {user ? `Orders for ${user.email}` : 'Please log in to view your orders'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {loadingOrders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !user ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Log in to view your order history</p>
                  <Button onClick={() => navigate('/auth')}>Log In</Button>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No orders found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Show processing orders first */}
                  {orders.filter(o => o.status === 'processing' || o.status === 'pending' || o.status === 'shipped').length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Active Orders</h4>
                      {orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).map((order) => {
                        const product = getProductById(order.product_id);
                        return (
                          <Card key={order.id} className="p-4 border-primary/30 bg-primary/5 mb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={getStatusColor(order.status)}>
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                  </Badge>
                                  {order.is_digital && <Badge variant="outline">Digital</Badge>}
                                </div>
                                <p className="font-medium">{product?.name || 'Product'}</p>
                                <p className="text-sm text-muted-foreground">
                                  Qty: {order.quantity} • ₹{order.total_amount.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Ordered: {new Date(order.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => viewOrderDetails(order)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {order.status === 'pending' && (
                                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => cancelOrder(order.id)}>
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Past orders */}
                  {orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Past Orders</h4>
                      {orders.filter(o => ['delivered', 'cancelled'].includes(o.status)).map((order) => {
                        const product = getProductById(order.product_id);
                        return (
                          <Card key={order.id} className="p-4 mb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={getStatusColor(order.status)}>
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                  </Badge>
                                </div>
                                <p className="font-medium">{product?.name || 'Product'}</p>
                                <p className="text-sm text-muted-foreground">
                                  Qty: {order.quantity} • ₹{order.total_amount.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Ordered: {new Date(order.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => viewOrderDetails(order)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Order Detail Dialog */}
        <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
          <DialogContent className="max-w-lg">
            {selectedOrder && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOrderDetailOpen(false)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    Order Details
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Order ID</span>
                    <span className="font-mono text-sm">{selectedOrder.order_id}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className={getStatusColor(selectedOrder.status)}>
                      {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="font-medium">{getProductById(selectedOrder.product_id)?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {selectedOrder.quantity} × ₹{selectedOrder.unit_price.toLocaleString()}
                    </p>
                    <p className="font-bold">Total: ₹{selectedOrder.total_amount.toLocaleString()}</p>
                  </div>

                  {selectedOrder.delivery_address && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Delivery Address
                      </h4>
                      <p className="text-sm">{selectedOrder.delivery_address.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrder.delivery_address.address}<br />
                        {selectedOrder.delivery_address.city}, {selectedOrder.delivery_address.state} - {selectedOrder.delivery_address.pincode}<br />
                        Phone: {selectedOrder.delivery_address.phone}
                      </p>
                    </div>
                  )}

                  {selectedOrder.tracking_info && (
                    <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Tracking Information
                      </h4>
                      <p className="text-sm">Carrier: {selectedOrder.tracking_info.carrier}</p>
                      <p className="text-sm">Tracking #: {selectedOrder.tracking_info.tracking_number}</p>
                      {selectedOrder.tracking_info.url && (
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a href={selectedOrder.tracking_info.url} target="_blank" rel="noopener noreferrer">
                            Track Package →
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Ordered: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                    {selectedOrder.delivered_at && (
                      <p>Delivered: {new Date(selectedOrder.delivered_at).toLocaleString()}</p>
                    )}
                    {selectedOrder.cancelled_at && (
                      <p>Cancelled: {new Date(selectedOrder.cancelled_at).toLocaleString()}</p>
                    )}
                  </div>

                  {selectedOrder.status === 'pending' && (
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => {
                        cancelOrder(selectedOrder.id);
                        setOrderDetailOpen(false);
                      }}
                    >
                      Cancel Order
                    </Button>
                  )}
                </div>
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
      </div>
      <ShopperNavFooter />
    </Layout>
  );
}