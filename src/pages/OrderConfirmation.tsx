import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  Package, 
  Truck, 
  MapPin, 
  CreditCard, 
  ArrowRight,
  Home,
  ShoppingBag,
  Bell,
  Loader2,
  Copy,
  Download,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ShopperNavFooter } from '@/components/navigation/ShopperNavFooter';

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_digital: boolean;
  delivery_address: DeliveryAddress | null;
  status: string;
  created_at: string;
  payment_id: string | null;
  order_id: string | null;
  product?: {
    name: string;
    image_urls: string[] | null;
  };
}

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const paymentId = searchParams.get('payment_id');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    if (paymentId || orderId) {
      fetchOrderDetails();
    } else {
      setLoading(false);
    }
  }, [paymentId, orderId]);

  const fetchOrderDetails = async () => {
    try {
      // Get current user for secure filtering
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from('orders')
        .select('*');

      if (paymentId) {
        query = query.eq('payment_id', paymentId);
      } else if (orderId) {
        query = query.eq('order_id', orderId);
      }

      // Filter by user_id for security
      if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch product details
        const productIds = [...new Set(data.map(o => o.product_id))];
        const { data: products } = await supabase
          .from('products')
          .select('id, name, image_urls')
          .in('id', productIds);

        const ordersWithProducts = data.map(order => ({
          ...order,
          delivery_address: order.delivery_address as unknown as DeliveryAddress | null,
          product: products?.find(p => p.id === order.product_id)
        }));

        setOrders(ordersWithProducts);
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const copyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Order ID copied to clipboard');
  };

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const totalItems = orders.reduce((sum, order) => sum + order.quantity, 0);
  const hasPhysicalItems = orders.some(o => !o.is_digital);
  const hasDigitalItems = orders.some(o => o.is_digital);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (orders.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 min-h-[60vh] flex items-center justify-center">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <Package className="h-16 w-16 text-muted-foreground mx-auto" />
              <h1 className="text-xl font-bold">No Order Found</h1>
              <p className="text-muted-foreground">
                We couldn't find the order you're looking for.
              </p>
              <div className="flex flex-col gap-2 pt-4">
                <Button onClick={() => navigate('/my-orders')}>
                  View My Orders
                </Button>
                <Button variant="outline" onClick={() => navigate('/shop')}>
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <ShopperNavFooter />
      </Layout>
    );
  }

  const deliveryAddress = orders.find(o => o.delivery_address)?.delivery_address;
  const orderDate = orders[0]?.created_at;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 pb-24 max-w-4xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-earnings/20 mb-4">
            <CheckCircle className="h-10 w-10 text-earnings" />
          </div>
          <h1 className="text-3xl font-bold font-display text-earnings mb-2">
            Order Confirmed!
          </h1>
          <p className="text-muted-foreground">
            Thank you for your purchase. We've received your order successfully.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Order Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Order Summary
                </CardTitle>
                <Badge variant="outline" className="bg-earnings/10 text-earnings border-earnings/30">
                  Confirmed
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Order Date</p>
                  <p className="font-medium">{format(new Date(orderDate), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment ID</p>
                  <div className="flex items-center gap-1">
                    <p className="font-mono font-medium truncate">
                      {orders[0]?.payment_id?.slice(0, 12)}...
                    </p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => copyOrderId(orders[0]?.payment_id || '')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Items</p>
                  <p className="font-medium">{totalItems} item{totalItems > 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-lg text-primary">₹{totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Items Ordered ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {orders.map((order, index) => (
                <div key={order.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {order.product?.image_urls?.[0] ? (
                        <img 
                          src={order.product.image_urls[0]} 
                          alt={order.product?.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{order.product?.name || 'Product'}</h4>
                      <p className="text-sm text-muted-foreground">
                        Qty: {order.quantity} × ₹{Number(order.unit_price).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {order.is_digital ? 'Digital' : 'Physical'}
                        </Badge>
                        {order.is_digital && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{Number(order.total_amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {order.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Delivery Address (for physical items) */}
          {hasPhysicalItems && deliveryAddress && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium">{deliveryAddress.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {deliveryAddress.address}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Phone: {deliveryAddress.phone}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hasPhysicalItems && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Shipping Updates</p>
                      <p className="text-sm text-muted-foreground">
                        We'll notify you when your order is shipped with tracking details.
                        Expected delivery: 3-7 business days.
                      </p>
                    </div>
                  </div>
                )}
                
                {hasDigitalItems && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-earnings/20 flex items-center justify-center flex-shrink-0">
                      <Download className="h-4 w-4 text-earnings" />
                    </div>
                    <div>
                      <p className="font-medium">Digital Products Ready</p>
                      <p className="text-sm text-muted-foreground">
                        Your digital products are available for download in My Orders.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-info/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="font-medium">Order Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Track your order status in the <Link to="/notifications" className="text-primary underline">Notifications</Link> page.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">Payment Confirmation</p>
                    <p className="text-sm text-muted-foreground">
                      A confirmation email has been sent to your registered email address.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => navigate('/my-orders')} 
              className="flex-1 gap-2"
            >
              <Package className="h-4 w-4" />
              View My Orders
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/shop')} 
              className="flex-1 gap-2"
            >
              <ShoppingBag className="h-4 w-4" />
              Continue Shopping
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')} 
              className="flex-1 gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </div>
        </div>
      </div>
      <ShopperNavFooter />
    </Layout>
  );
}
