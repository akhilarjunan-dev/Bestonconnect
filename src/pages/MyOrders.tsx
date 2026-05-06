import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Package, Truck, CheckCircle, XCircle, Clock, RotateCcw, Loader2, Copy, ExternalLink, Box, RefreshCw } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Link, Navigate } from 'react-router-dom';
import { OrderTrackingTimeline } from '@/components/orders/OrderTrackingTimeline';

interface TrackingInfo {
  tracking_number?: string;
  carrier?: string;
  url?: string;
}

interface Order {
  id: string;
  product_id: string;
  quantity: number;
  total_amount: number;
  unit_price: number;
  status: string;
  created_at: string;
  delivered_at: string | null;
  tracking_info: TrackingInfo | null;
  delivery_address: unknown;
  is_digital: boolean;
  delhivery_waybill: string | null;
  delhivery_status: string | null;
  payment_id: string | null;
  product?: {
    name: string;
    image_urls: string[] | null;
  };
}

interface ReturnRequest {
  id: string;
  order_id: string;
  request_type: 'return' | 'replacement' | 'cancellation';
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
  reason: string;
  admin_notes: string | null;
  created_at: string;
  shipping_label_url: string | null;
  return_tracking_number: string | null;
  return_carrier: string | null;
  return_tracking_url: string | null;
}

interface OrderSettings {
  return_period_days: number;
  replacement_period_days: number;
  cancel_period_hours: number;
}

export default function MyOrders() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [requestType, setRequestType] = useState<'return' | 'replacement'>('return');
  const [submitting, setSubmitting] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<string | null>(null);
  const [liveTrackingData, setLiveTrackingData] = useState<Record<string, { status: string; scans: Array<{ time: string; location: string; activity: string }> }>>({});
  const [orderSettings, setOrderSettings] = useState<OrderSettings>({
    return_period_days: 7,
    replacement_period_days: 7,
    cancel_period_hours: 24
  });

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchReturnRequests();
      fetchOrderSettings();
    }
  }, [user]);

  const fetchLiveTracking = async (orderId: string, waybill: string) => {
    setTrackingOrder(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('delhivery', {
        body: { action: 'track_shipment', waybill }
      });

      if (error) {
        toast.error('Failed to fetch tracking');
        return;
      }

      const shipmentData = data?.data?.ShipmentData?.[0]?.Shipment;
      if (shipmentData) {
        const scans = shipmentData.Scans?.map((scan: { ScanDetail?: { ScanDateTime?: string; ScannedLocation?: string; Instructions?: string } }) => ({
          time: scan.ScanDetail?.ScanDateTime || '',
          location: scan.ScanDetail?.ScannedLocation || '',
          activity: scan.ScanDetail?.Instructions || ''
        })) || [];

        setLiveTrackingData(prev => ({
          ...prev,
          [orderId]: {
            status: shipmentData.Status?.Status || 'Unknown',
            scans
          }
        }));
        
        toast.success('Tracking updated!');
      } else {
        toast.error('No tracking data available');
      }
    } catch (err) {
      console.error('Failed to fetch tracking:', err);
      toast.error('Failed to fetch tracking');
    } finally {
      setTrackingOrder(null);
    }
  };

  const fetchOrderSettings = async () => {
    const { data } = await supabase
      .from('order_settings')
      .select('setting_key, setting_value');

    if (data) {
      const newSettings: OrderSettings = { ...orderSettings };
      data.forEach((item) => {
        const key = item.setting_key as keyof OrderSettings;
        if (key in newSettings) {
          newSettings[key] = Number(item.setting_value);
        }
      });
      setOrderSettings(newSettings);
    }
  };

  const fetchReturnRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('return_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setReturnRequests(data as ReturnRequest[]);
    }
  };


  const fetchOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        product:products(name, image_urls)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch orders');
      console.error(error);
    } else {
      setOrders((data || []) as Order[]);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <Box className="h-4 w-4" />;
      case 'shipped':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'delivered') return 'Completed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'default';
      case 'shipped':
      case 'processing':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Return/replacement only for physical products, within configured days of delivery
  const canRequestReturn = (order: Order) => {
    // Digital products cannot be returned
    if (order.is_digital) return false;
    // Check if already has pending/processing return request
    const existingRequest = returnRequests.find(r => r.order_id === order.id && ['pending', 'approved', 'processing'].includes(r.status));
    if (existingRequest) return false;
    if ((order.status !== 'delivered' && order.status !== 'completed') || !order.delivered_at) return false;
    const deliveredDate = new Date(order.delivered_at);
    const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceDelivery <= orderSettings.return_period_days;
  };

  // Cancel order within configured hours of delivery (for physical products only)
  const canCancelAfterDelivery = (order: Order) => {
    // Digital products cannot be cancelled after delivery
    if (order.is_digital) return false;
    if ((order.status !== 'delivered' && order.status !== 'completed') || !order.delivered_at) return false;
    const deliveredDate = new Date(order.delivered_at);
    const hoursSinceDelivery = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60);
    return hoursSinceDelivery <= orderSettings.cancel_period_hours;
  };

  // Can cancel pending or processing orders (before shipping)
  const canCancelOrder = (order: Order) => {
    return order.status === 'pending' || order.status === 'processing';
  };

  const getRemainingReturnDays = (order: Order) => {
    if (!order.delivered_at || order.is_digital) return null;
    const deliveredDate = new Date(order.delivered_at);
    const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = orderSettings.return_period_days - daysSinceDelivery;
    return remaining > 0 ? remaining : 0;
  };

  const getRemainingCancelHours = (order: Order) => {
    if (!order.delivered_at || order.is_digital) return null;
    const deliveredDate = new Date(order.delivered_at);
    const hoursSinceDelivery = (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60);
    const remaining = Math.floor(orderSettings.cancel_period_hours - hoursSinceDelivery);
    return remaining > 0 ? remaining : 0;
  };

  const getOrderReturnRequest = (orderId: string) => {
    return returnRequests.find(r => r.order_id === orderId);
  };

  const notifyAdminsAndManagers = async (order: Order, productName: string) => {
    // Fetch admin and manager user IDs
    const { data: adminManagerRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'manager']);

    if (adminManagerRoles && adminManagerRoles.length > 0) {
      const notifications = adminManagerRoles.map(r => ({
        user_id: r.user_id,
        title: '💰 Refund Required - Order Cancelled',
        message: `Prepaid order for "${productName}" (₹${Number(order.total_amount).toLocaleString()}, Order: ${order.id.slice(0, 8)}...) was cancelled by the customer. Refund action required.`,
        type: 'warning',
        is_read: false,
      }));
      await supabase.from('notifications').insert(notifications);
    }
  };

  const cancelDelhiveryShipment = async (order: Order) => {
    if (!order.delhivery_waybill) return;
    try {
      await supabase.functions.invoke('delhivery', {
        body: { 
          action: 'cancel_shipment', 
          waybill: order.delhivery_waybill, 
          order_id: order.id 
        }
      });
      console.log('Delhivery shipment cancelled for order:', order.id);
    } catch (err) {
      console.error('Failed to cancel Delhivery shipment:', err);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelled by customer'
      })
      .eq('id', order.id);

    if (error) {
      toast.error('Failed to cancel order');
      console.error('Cancel order error:', error);
    } else {
      const productName = order.product?.name || 'your product';
      const isCOD = order.payment_id === 'COD';

      // Cancel Delhivery shipment if waybill exists
      if (order.delhivery_waybill) {
        await cancelDelhiveryShipment(order);
      }

      // Send cancellation notification to buyer
      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: '❌ Order Cancelled',
          message: isCOD
            ? `Your COD order for "${productName}" has been cancelled successfully. No refund needed.`
            : `Your prepaid order for "${productName}" has been cancelled. A refund will be processed shortly.`,
          type: 'info',
          is_read: false,
        });
      }

      // For prepaid orders, notify admins and managers for refund
      if (!isCOD) {
        await notifyAdminsAndManagers(order, productName);
      }

      toast.success(isCOD ? 'Order cancelled successfully' : 'Order cancelled. Refund will be processed by admin.');
      fetchOrders();
    }
  };

  const handleReturnRequest = async () => {
    if (!selectedOrder || !returnReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setSubmitting(true);
    
    // Save to return_requests table
    const { error } = await supabase
      .from('return_requests')
      .insert({
        order_id: selectedOrder.id,
        user_id: user!.id,
        request_type: requestType,
        reason: returnReason,
        status: 'pending'
      });

    setSubmitting(false);

    if (error) {
      console.error(error);
      toast.error(`Failed to submit ${requestType} request`);
    } else {
      const requestLabel = requestType === 'return' ? 'Return' : 'Replacement';
      toast.success(`${requestLabel} request submitted. Our team will review it soon.`);
      setReturnDialogOpen(false);
      setReturnReason('');
      setRequestType('return');
      setSelectedOrder(null);
      fetchReturnRequests();
    }
  };

  const getReturnRequestStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'default',
      processing: 'secondary',
      completed: 'default',
      rejected: 'destructive'
    };
    return variants[status] || 'outline';
  };

  const handleCancelAfterDelivery = async (order: Order) => {
    if (!confirm('Are you sure you want to cancel this delivered order?')) return;
    
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelled by customer within 24 hours of delivery'
      })
      .eq('id', order.id);

    if (error) {
      toast.error('Failed to cancel order');
      console.error('Cancel order error:', error);
    } else {
      const productName = order.product?.name || 'your product';
      const isCOD = order.payment_id === 'COD';

      // Cancel Delhivery shipment if waybill exists
      if (order.delhivery_waybill) {
        await cancelDelhiveryShipment(order);
      }

      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: '❌ Order Cancelled',
          message: isCOD
            ? `Your COD order for "${productName}" has been cancelled after delivery. No refund needed.`
            : `Your prepaid order for "${productName}" has been cancelled after delivery. A refund will be processed shortly.`,
          type: 'info',
          is_read: false,
        });
      }

      if (!isCOD) {
        await notifyAdminsAndManagers(order, productName);
      }

      toast.success(isCOD ? 'Order cancelled successfully' : 'Order cancelled. Refund will be processed by admin.');
      fetchOrders();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            My Orders
          </h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
              <Link to="/shop">
                <Button>Start Shopping</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {order.product?.image_urls?.[0] ? (
                        <img 
                          src={order.product.image_urls[0]} 
                          alt={order.product?.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <div>
                          <h3 className="font-medium">{order.product?.name || 'Product'}</h3>
                          <p className="text-sm text-muted-foreground">
                            Order ID: {order.id.slice(0, 8)}... • Qty: {order.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{order.total_amount}</p>
                          <Badge variant={getStatusVariant(order.status)} className="gap-1">
                            {getStatusIcon(order.status)}
                            {getStatusLabel(order.status)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Ordered: {format(new Date(order.created_at), 'PPP')}</span>
                        {order.delivered_at && (
                          <span>• Completed: {format(new Date(order.delivered_at), 'PPP')}</span>
                        )}
                      </div>

                      {/* Tracking Timeline */}
                      {order.status !== 'cancelled' && !order.is_digital && (
                        <div className="pt-2">
                          <OrderTrackingTimeline 
                            status={order.status}
                            createdAt={order.created_at}
                            completedAt={order.delivered_at}
                          />
                        </div>
                      )}

                      {/* Delhivery Live Tracking - for orders with waybill */}
                      {order.delhivery_waybill && (
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Truck className="h-4 w-4 text-primary" />
                              Delhivery Tracking
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {order.delhivery_status || 'Manifested'}
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-7 gap-1"
                                onClick={() => fetchLiveTracking(order.id, order.delhivery_waybill!)}
                                disabled={trackingOrder === order.id}
                              >
                                {trackingOrder === order.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                <span className="hidden sm:inline">Refresh</span>
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div className="p-2 bg-background rounded">
                              <p className="text-xs text-muted-foreground">Carrier</p>
                              <p className="font-medium">Delhivery</p>
                            </div>
                            <div className="flex items-center justify-between gap-2 p-2 bg-background rounded">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">AWB Number</p>
                                <p className="font-mono font-medium truncate">{order.delhivery_waybill}</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => copyToClipboard(order.delhivery_waybill!, 'AWB Number')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Live Tracking Scans */}
                          {liveTrackingData[order.id]?.scans && liveTrackingData[order.id].scans.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Recent Activity</p>
                              <div className="max-h-40 overflow-y-auto space-y-2">
                                {liveTrackingData[order.id].scans.slice(0, 5).map((scan, idx) => (
                                  <div key={idx} className="flex gap-2 text-xs p-2 bg-background rounded">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium">{scan.activity}</p>
                                      <p className="text-muted-foreground truncate">
                                        {scan.location} • {scan.time && format(new Date(scan.time), 'PPp')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button 
                            variant="default" 
                            size="sm" 
                            className="gap-2 w-full"
                            asChild
                          >
                            <a 
                              href={`https://www.delhivery.com/track/package/${order.delhivery_waybill}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Track on Delhivery
                            </a>
                          </Button>
                        </div>
                      )}

                      {/* Tracking Info Display - Only when shipped or completed and no delhivery */}
                      {!order.delhivery_waybill && 
                       (order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed') && 
                       order.tracking_info?.tracking_number && (
                        <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Truck className="h-4 w-4 text-primary" />
                            Tracking Information
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center justify-between gap-2 p-2 bg-background rounded">
                              <div>
                                <p className="text-xs text-muted-foreground">Carrier</p>
                                <p className="font-medium">{order.tracking_info.carrier || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 p-2 bg-background rounded">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Tracking ID</p>
                                <p className="font-mono font-medium truncate">{order.tracking_info.tracking_number}</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => copyToClipboard(order.tracking_info!.tracking_number!, 'Tracking ID')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {order.tracking_info.url && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => copyToClipboard(order.tracking_info!.url!, 'Tracking URL')}
                              >
                                <Copy className="h-3 w-3" />
                                Copy URL
                              </Button>
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="gap-2"
                                asChild
                              >
                                <a href={order.tracking_info.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                  Track Delivery
                                </a>
                              </Button>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Delivery is handled by our logistics partner. Track your order using the link above.
                          </p>
                        </div>
                      )}

                      {/* Return Request Status - if exists */}
                      {(() => {
                        const returnRequest = getOrderReturnRequest(order.id);
                        if (returnRequest) {
                          return (
                            <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium flex items-center gap-2">
                                  {returnRequest.request_type === 'return' ? (
                                    <RotateCcw className="h-4 w-4 text-primary" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 text-primary" />
                                  )}
                                  {returnRequest.request_type.charAt(0).toUpperCase() + returnRequest.request_type.slice(1)} Request
                                </p>
                                <Badge variant={getReturnRequestStatusBadge(returnRequest.status)}>
                                  {returnRequest.status.charAt(0).toUpperCase() + returnRequest.status.slice(1)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Submitted: {format(new Date(returnRequest.created_at), 'PPp')}
                              </p>
                              {returnRequest.admin_notes && (
                                <p className="text-xs bg-background p-2 rounded">
                                  <span className="font-medium">Admin Note:</span> {returnRequest.admin_notes}
                                </p>
                              )}
                              
                              {/* Return Shipping Info */}
                              {(returnRequest.status === 'approved' || returnRequest.status === 'processing') && returnRequest.request_type === 'return' && (
                                <div className="mt-2 p-2 bg-primary/10 rounded border border-primary/20 space-y-2">
                                  <p className="text-xs font-medium flex items-center gap-1">
                                    <Truck className="h-3 w-3" />
                                    Return Shipping Details
                                  </p>
                                  
                                  {returnRequest.shipping_label_url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full gap-2"
                                      onClick={() => window.open(returnRequest.shipping_label_url!, '_blank')}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Download Shipping Label
                                    </Button>
                                  )}
                                  
                                  {returnRequest.return_tracking_number && (
                                    <div className="text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Carrier:</span>
                                        <span className="font-medium">{returnRequest.return_carrier}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Tracking:</span>
                                        <div className="flex items-center gap-1">
                                          <span className="font-mono font-medium">{returnRequest.return_tracking_number}</span>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5"
                                            onClick={() => copyToClipboard(returnRequest.return_tracking_number!, 'Tracking number')}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      {returnRequest.return_tracking_url && (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          className="w-full gap-2 mt-2"
                                          onClick={() => window.open(returnRequest.return_tracking_url!, '_blank')}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Track Return Package
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                  
                                  {!returnRequest.shipping_label_url && !returnRequest.return_tracking_number && (
                                    <p className="text-xs text-muted-foreground">
                                      Shipping details will be provided soon.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Return/Replacement Period Info - Physical products only */}
                      {!order.is_digital && (order.status === 'delivered' || order.status === 'completed') && order.delivered_at && !getOrderReturnRequest(order.id) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {canRequestReturn(order) && (
                            <span className="text-amber-600 block">
                              {getRemainingReturnDays(order)} days left for return/replacement
                            </span>
                          )}
                          {canCancelAfterDelivery(order) && (
                            <span className="text-orange-600 block">
                              {getRemainingCancelHours(order)} hours left to cancel order
                            </span>
                          )}
                          {!canRequestReturn(order) && !canCancelAfterDelivery(order) && (
                            <span>Return/replacement period has ended</span>
                          )}
                        </div>
                      )}
                      
                      {/* Digital products - no return info */}
                      {order.is_digital && (order.status === 'delivered' || order.status === 'completed') && (
                        <div className="text-xs text-muted-foreground">
                          <span>Digital products are non-returnable</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {/* Cancel before shipping */}
                        {canCancelOrder(order) && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => handleCancelOrder(order)}
                          >
                            <XCircle className="h-3 w-3" />
                            Cancel Order
                          </Button>
                        )}
                        
                        {/* Cancel within 1 day of delivery - Physical only */}
                        {canCancelAfterDelivery(order) && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => handleCancelAfterDelivery(order)}
                          >
                            <XCircle className="h-3 w-3" />
                            Cancel Order
                          </Button>
                        )}
                        
                        {/* Return/Replacement within 7 days - Physical only */}
                        {canRequestReturn(order) && (
                          <Dialog open={returnDialogOpen && selectedOrder?.id === order.id} onOpenChange={(open) => {
                            setReturnDialogOpen(open);
                            if (open) {
                              setSelectedOrder(order);
                              setRequestType('return');
                              setReturnReason('');
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1">
                                <RotateCcw className="h-3 w-3" />
                                Return / Replace
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Request Return or Replacement</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Choose an option and provide a reason for your request.
                                </p>
                                
                                <RadioGroup value={requestType} onValueChange={(v) => setRequestType(v as 'return' | 'replacement')}>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="return" id="return" />
                                    <Label htmlFor="return" className="flex items-center gap-2 cursor-pointer">
                                      <RotateCcw className="h-4 w-4" />
                                      Product Return (Refund)
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="replacement" id="replacement" />
                                    <Label htmlFor="replacement" className="flex items-center gap-2 cursor-pointer">
                                      <RefreshCw className="h-4 w-4" />
                                      Product Replacement
                                    </Label>
                                  </div>
                                </RadioGroup>
                                
                                <Textarea
                                  placeholder={`Reason for ${requestType}...`}
                                  value={returnReason}
                                  onChange={(e) => setReturnReason(e.target.value)}
                                  rows={4}
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleReturnRequest} disabled={submitting}>
                                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Submit Request
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        <Link to={`/product/${order.product_id}`}>
                          <Button variant="ghost" size="sm">View Product</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
