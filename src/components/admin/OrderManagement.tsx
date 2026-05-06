import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Package, Truck, Eye, Search, RefreshCw, MapPin, X, CheckSquare, Loader2, Send, CalendarIcon, Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface TrackingInfo {
  carrier?: string;
  tracking_number?: string;
  url?: string;
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
  tracking_info: TrackingInfo | null;
  payment_id: string | null;
  order_id: string | null;
  created_at: string;
  cancelled_at: string | null;
  delivered_at: string | null;
  delhivery_waybill: string | null;
  delhivery_status: string | null;
  product?: {
    name: string;
    image_urls: string[] | null;
  };
}

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

const getStatusDisplayName = (status: string) => {
  if (status === 'delivered') return 'Completed';
  if (status === 'completed') return 'Completed';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingForm, setTrackingForm] = useState({
    carrier: '',
    tracking_number: '',
    url: ''
  });
  
  // Bulk selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  
  // Delhivery state
  const [delhiveryEnabled, setDelhiveryEnabled] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState<string | null>(null);
  const [shipmentDialogOpen, setShipmentDialogOpen] = useState(false);
  const [shipmentOrder, setShipmentOrder] = useState<Order | null>(null);
  const [shipmentForm, setShipmentForm] = useState({
    weight: '500',
    length: '20',
    width: '15',
    height: '10',
    pickup_date: undefined as Date | undefined,
    pickup_slot: '' as string,
  });

  useEffect(() => {
    fetchOrders();
    checkDelhiveryStatus();
  }, []);

  const checkDelhiveryStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('delhivery', {
        body: { action: 'check_status' }
      });
      if (!error && data?.enabled) {
        setDelhiveryEnabled(true);
      }
    } catch (err) {
      console.error('Failed to check Delhivery status:', err);
    }
  };

  const openShipmentDialog = (order: Order) => {
    setShipmentOrder(order);
    setShipmentForm({
      weight: '500',
      length: '20',
      width: '15',
      height: '10',
      pickup_date: undefined,
      pickup_slot: '',
    });
    setShipmentDialogOpen(true);
  };

  const createDelhiveryShipment = async () => {
    if (!shipmentOrder) return;
    const order = shipmentOrder;

    if (!order.delivery_address) {
      toast.error('Order has no delivery address');
      return;
    }

    setCreatingShipment(order.id);

    try {
      const isCOD = order.payment_id === 'COD';
      const { data, error } = await supabase.functions.invoke('delhivery', {
        body: {
          action: 'create_shipment',
          order_id: order.id,
          product_name: order.product?.name || 'Product',
          quantity: order.quantity,
          total_amount: order.total_amount,
          delivery_address: order.delivery_address,
          weight: parseInt(shipmentForm.weight) || 500,
          dimensions: {
            length: parseInt(shipmentForm.length) || 20,
            width: parseInt(shipmentForm.width) || 15,
            height: parseInt(shipmentForm.height) || 10,
          },
          pickup_time: shipmentForm.pickup_date ? `${format(shipmentForm.pickup_date, 'yyyy-MM-dd')} ${shipmentForm.pickup_slot === 'before_noon' ? '10:00' : '14:00'}` : undefined,
          payment_mode: isCOD ? 'COD' : 'Prepaid'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to connect to Delhivery');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.success) {
        throw new Error('Unexpected response from Delhivery');
      }

      toast.success(`Shipment created! Waybill: ${data.waybill}`);
      setShipmentDialogOpen(false);
      fetchOrders();
    } catch (err) {
      console.error('Failed to create shipment:', err);
      toast.error(`Failed to create shipment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreatingShipment(null);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to fetch orders');
      setLoading(false);
      return;
    }

    // Fetch product details for each order
    const productIds = [...new Set((data || []).map(o => o.product_id))];
    const { data: products } = await supabase
      .from('products')
      .select('id, name, image_urls')
      .in('id', productIds);

    const ordersWithProducts = (data || []).map(order => ({
      ...order,
      delivery_address: order.delivery_address as unknown as DeliveryAddress | null,
      tracking_info: order.tracking_info as unknown as TrackingInfo | null,
      product: products?.find(p => p.id === order.product_id)
    }));

    setOrders(ordersWithProducts);
    setLoading(false);
  };

  const sendOrderStatusNotification = async (order: Order, newStatus: string) => {
    // Find the user by email to send notification
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', order.buyer_email)
      .maybeSingle();

    if (!profile) return; // User not registered, skip notification

    const statusMessages: Record<string, { title: string; message: string; type: string }> = {
      processing: {
        title: '📋 Order Being Processed',
        message: `Your order for "${order.product?.name || 'your product'}" is now being processed. We'll notify you once it's shipped!`,
        type: 'info',
      },
      shipped: {
        title: '📦 Your Order Has Been Shipped!',
        message: `Great news! Your order for "${order.product?.name || 'your product'}" has been shipped and is on its way. ${order.tracking_info?.tracking_number ? `Tracking: ${order.tracking_info.tracking_number}` : 'Tracking info will be updated soon.'}`,
        type: 'info',
      },
      completed: {
        title: '✅ Order Delivered Successfully!',
        message: `Your order for "${order.product?.name || 'your product'}" has been delivered. Thank you for shopping with us! We hope you enjoy your purchase.`,
        type: 'success',
      },
      cancelled: {
        title: '❌ Order Cancelled',
        message: `Your order for "${order.product?.name || 'your product'}" has been cancelled. If you have any questions, please contact our support team.`,
        type: 'error',
      },
    };

    const notification = statusMessages[newStatus];
    if (!notification) return;

    await supabase.from('notifications').insert({
      user_id: profile.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      is_read: false,
    });
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    const updates: Record<string, unknown> = { status: newStatus };
    
    if (newStatus === 'completed' || newStatus === 'delivered') {
      updates.status = 'completed';
      updates.delivered_at = new Date().toISOString();
    }
    if (newStatus === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      updates.cancellation_reason = 'Cancelled by admin';
    }

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update order status');
      return;
    }

    // Update vendor_earnings status when order is completed
    if (newStatus === 'completed' || newStatus === 'delivered') {
      await supabase
        .from('vendor_earnings')
        .update({ status: 'completed' })
        .eq('order_id', orderId);
    }

    // Send notification for status changes
    if (order && ['processing', 'shipped', 'completed', 'cancelled'].includes(newStatus === 'delivered' ? 'completed' : newStatus)) {
      await sendOrderStatusNotification(order, newStatus === 'delivered' ? 'completed' : newStatus);
    }

    toast.success(`Order status updated to ${getStatusDisplayName(newStatus)}`);
    fetchOrders();
  };

  // Bulk operations
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const selectableOrders = filteredOrders.filter(
      o => o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'completed'
    );
    
    if (selectedOrderIds.size === selectableOrders.length && selectableOrders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(selectableOrders.map(o => o.id)));
    }
  };

  const clearSelection = () => {
    setSelectedOrderIds(new Set());
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedOrderIds.size === 0) return;
    
    setBulkProcessing(true);
    
    const updates: Record<string, unknown> = { status: newStatus };
    
    if (newStatus === 'completed' || newStatus === 'delivered') {
      updates.status = 'completed';
      updates.delivered_at = new Date().toISOString();
    }
    if (newStatus === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      updates.cancellation_reason = 'Cancelled by admin';
    }

    const orderIdArray = Array.from(selectedOrderIds);

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .in('id', orderIdArray);

    if (error) {
      setBulkProcessing(false);
      toast.error('Failed to update orders');
      return;
    }

    // Update vendor_earnings for completed orders
    if (newStatus === 'completed' || newStatus === 'delivered') {
      await supabase
        .from('vendor_earnings')
        .update({ status: 'completed' })
        .in('order_id', orderIdArray);
    }

    // Send notifications for each order
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
    const notificationStatus = newStatus === 'delivered' ? 'completed' : newStatus;
    if (['processing', 'shipped', 'completed', 'cancelled'].includes(notificationStatus)) {
      await Promise.all(
        selectedOrders.map(order => sendOrderStatusNotification(order, notificationStatus))
      );
    }

    setBulkProcessing(false);
    toast.success(`${selectedOrderIds.size} orders updated to ${newStatus}`);
    setSelectedOrderIds(new Set());
    fetchOrders();
  };

  const openTrackingDialog = (order: Order) => {
    setSelectedOrder(order);
    setTrackingForm({
      carrier: order.tracking_info?.carrier || '',
      tracking_number: order.tracking_info?.tracking_number || '',
      url: order.tracking_info?.url || ''
    });
    setTrackingOpen(true);
  };

  const saveTrackingInfo = async () => {
    if (!selectedOrder) return;

    const { error } = await supabase
      .from('orders')
      .update({ 
        tracking_info: trackingForm,
        status: selectedOrder.status === 'pending' || selectedOrder.status === 'processing' 
          ? 'shipped' 
          : selectedOrder.status
      })
      .eq('id', selectedOrder.id);

    if (error) {
      toast.error('Failed to save tracking info');
      return;
    }

    toast.success('Tracking info saved');
    setTrackingOpen(false);
    fetchOrders();
  };

  const handlePrintLabel = async (order: Order) => {
    if (!order.delhivery_waybill) {
      toast.error('No Delhivery waybill found');
      return;
    }
    try {
      // Use fetch directly to get raw PDF bytes (supabase.functions.invoke auto-parses JSON)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;
      
      const res = await fetch(`${supabaseUrl}/functions/v1/delhivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ action: 'generate_label', waybill: order.delhivery_waybill })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error || 'Failed to get shipping label');
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf')) {
        // Edge function returned JSON error (label not ready or invalid)
        const errData = await res.json().catch(() => ({ error: 'Shipping label is not ready yet. Try again after pickup is scheduled.' }));
        toast.error(errData?.error || 'Failed to get shipping label');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shipping-label-${order.delhivery_waybill}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Shipping label downloaded');
    } catch {
      toast.error('Failed to generate label');
    }
  };

  const handlePrintInvoice = async (order: Order) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('INVOICE', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Order ID: ${order.order_id || order.id}`, 14, 35);
    doc.text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`, 14, 42);
    doc.text(`Payment: ${order.payment_id === 'COD' ? 'Cash on Delivery' : 'Prepaid'}`, 14, 49);
    if (order.delhivery_waybill) doc.text(`AWB: ${order.delhivery_waybill}`, 14, 56);
    
    doc.setFontSize(12);
    doc.text('Customer Details', 14, 68);
    doc.setFontSize(10);
    doc.text(`Name: ${order.buyer_name || 'N/A'}`, 14, 76);
    doc.text(`Email: ${order.buyer_email}`, 14, 83);
    if (order.delivery_address) {
      const addr = order.delivery_address;
      doc.text(`Address: ${addr.address}, ${addr.city}`, 14, 90);
      doc.text(`${addr.state} - ${addr.pincode}, Phone: ${addr.phone}`, 14, 97);
    }

    doc.setFontSize(12);
    doc.text('Order Details', 14, 112);
    doc.setFontSize(10);
    doc.text(`Product: ${order.product?.name || 'Product'}`, 14, 120);
    doc.text(`Quantity: ${order.quantity}`, 14, 127);
    doc.text(`Unit Price: Rs.${order.unit_price.toLocaleString()}`, 14, 134);
    doc.setFontSize(14);
    doc.text(`Total: Rs.${order.total_amount.toLocaleString()}`, 14, 148);
    
    doc.save(`invoice-${(order.order_id || order.id).slice(0, 8)}.pdf`);
    toast.success('Invoice downloaded');
  };

  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.buyer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'shipped': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'delivered': 
      case 'completed': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    completed: orders.filter(o => o.status === 'delivered' || o.status === 'completed').length,
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
            <p className="text-sm text-muted-foreground">Processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.shipped}</p>
            <p className="text-sm text-muted-foreground">Shipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
          </div>

          {/* Bulk Action Bar */}
          {selectedOrderIds.size > 0 && (
            <div className="flex items-center gap-4 p-4 mb-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedOrderIds.size} orders selected</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Bulk update status:</span>
                {['processing', 'shipped', 'completed', 'cancelled'].map(status => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === 'cancelled' ? 'destructive' : 'outline'}
                    onClick={() => bulkUpdateStatus(status)}
                    disabled={bulkProcessing}
                  >
                    {bulkProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      getStatusDisplayName(status)
                    )}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Management
            </CardTitle>
            <CardDescription>View and manage customer orders</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, order ID, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {ORDER_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredOrders.filter(o => o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'completed').length > 0 &&
                        selectedOrderIds.size === filteredOrders.filter(o => o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'completed').length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const isSelectable = order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'completed';
                  return (
                  <TableRow key={order.id} className={selectedOrderIds.has(order.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrderIds.has(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                        disabled={!isSelectable}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm">{order.order_id?.slice(0, 15)}...</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.buyer_name || 'Customer'}</p>
                        <p className="text-sm text-muted-foreground">{order.buyer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {order.product?.image_urls?.[0] ? (
                          <img 
                            src={order.product.image_urls[0]} 
                            alt="" 
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{order.product?.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {order.quantity}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₹{order.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {order.is_digital ? 'Digital' : 'Physical'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Select 
                          value={order.status === 'delivered' ? 'completed' : order.status} 
                          onValueChange={(v) => updateOrderStatus(order.id, v)}
                          disabled={order.status === 'cancelled' || order.status === 'delivered' || order.status === 'completed'}
                        >
                          <SelectTrigger className={`w-28 ${getStatusColor(order.status)}`}>
                            <SelectValue>{getStatusDisplayName(order.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ORDER_STATUSES.map(status => (
                              <SelectItem key={status} value={status}>
                                {getStatusDisplayName(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {order.delhivery_waybill && (
                          <Badge variant="outline" className="text-xs">
                            <Truck className="h-3 w-3 mr-1" />
                            {order.delhivery_status || 'Manifested'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => viewOrderDetails(order)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!order.is_digital && order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'completed' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openTrackingDialog(order)}>
                              <Truck className="h-4 w-4" />
                            </Button>
                            {delhiveryEnabled && !order.delhivery_waybill && order.delivery_address && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => openShipmentDialog(order)}
                                disabled={creatingShipment === order.id}
                                className="gap-1"
                              >
                                {creatingShipment === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                                <span className="hidden lg:inline">Delhivery</span>
                              </Button>
                            )}
                          </>
                        )}
                        {/* Print Label & Invoice buttons */}
                        {order.delhivery_waybill && (
                          <Button size="sm" variant="ghost" onClick={() => handlePrintLabel(order)} title="Print Shipping Label">
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        {order.status !== 'cancelled' && (
                          <Button size="sm" variant="ghost" onClick={() => handlePrintInvoice(order)} title="Print Invoice">
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}

              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Order Details</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Order ID</p>
                    <p className="font-mono">{selectedOrder.order_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment ID</p>
                    <p className="font-mono">{selectedOrder.payment_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={getStatusColor(selectedOrder.status)}>
                      {getStatusDisplayName(selectedOrder.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <Badge variant="outline">
                      {selectedOrder.is_digital ? 'Digital' : 'Physical'}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Customer</h4>
                  <p>{selectedOrder.buyer_name || 'Customer'}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.buyer_email}</p>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Product</h4>
                  <p>{selectedOrder.product?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.quantity} × ₹{selectedOrder.unit_price.toLocaleString()}
                  </p>
                  <p className="font-bold mt-2">Total: ₹{selectedOrder.total_amount.toLocaleString()}</p>
                </div>

                {selectedOrder.delivery_address && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Delivery Address
                    </h4>
                    <p>{selectedOrder.delivery_address.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.delivery_address.address}<br />
                      {selectedOrder.delivery_address.city}, {selectedOrder.delivery_address.state} - {selectedOrder.delivery_address.pincode}<br />
                      Phone: {selectedOrder.delivery_address.phone}
                    </p>
                  </div>
                )}

                {selectedOrder.tracking_info?.tracking_number && (
                  <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Tracking Information
                    </h4>
                    <p className="text-sm">Carrier: {selectedOrder.tracking_info.carrier}</p>
                    <p className="text-sm">Tracking #: {selectedOrder.tracking_info.tracking_number}</p>
                    {selectedOrder.tracking_info.url && (
                      <Button variant="link" className="p-0 h-auto mt-2" asChild>
                        <a href={selectedOrder.tracking_info.url} target="_blank" rel="noopener noreferrer">
                          Track Package →
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Created: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                  {selectedOrder.delivered_at && (
                    <p>Completed: {new Date(selectedOrder.delivered_at).toLocaleString()}</p>
                  )}
                  {selectedOrder.cancelled_at && (
                    <p>Cancelled: {new Date(selectedOrder.cancelled_at).toLocaleString()}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Tracking Info Dialog */}
      <Dialog open={trackingOpen} onOpenChange={setTrackingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking Information</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier Name</Label>
              <Input
                id="carrier"
                placeholder="e.g., FedEx, DTDC, BlueDart"
                value={trackingForm.carrier}
                onChange={(e) => setTrackingForm({ ...trackingForm, carrier: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking_number">Tracking Number</Label>
              <Input
                id="tracking_number"
                placeholder="Enter tracking number"
                value={trackingForm.tracking_number}
                onChange={(e) => setTrackingForm({ ...trackingForm, tracking_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Tracking URL (optional)</Label>
              <Input
                id="url"
                placeholder="https://..."
                value={trackingForm.url}
                onChange={(e) => setTrackingForm({ ...trackingForm, url: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingOpen(false)}>Cancel</Button>
            <Button onClick={saveTrackingInfo}>Save & Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipment Creation Dialog with Dimensions */}
      <Dialog open={shipmentDialogOpen} onOpenChange={setShipmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Create Delhivery Shipment
            </DialogTitle>
          </DialogHeader>

          {shipmentOrder && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">{shipmentOrder.product?.name}</p>
                <p className="text-muted-foreground">
                  Order: {(shipmentOrder.order_id || shipmentOrder.id).slice(0, 12)}... · Qty: {shipmentOrder.quantity} · ₹{shipmentOrder.total_amount.toLocaleString()}
                </p>
                {shipmentOrder.payment_id === 'COD' && (
                  <Badge variant="outline" className="mt-1">COD</Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>Package Weight (grams)</Label>
                <Input
                  type="number"
                  value={shipmentForm.weight}
                  onChange={e => setShipmentForm({ ...shipmentForm, weight: e.target.value })}
                  placeholder="500"
                />
              </div>

              <div>
                <Label className="mb-2 block">Dimensions (cm)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Length</Label>
                    <Input
                      type="number"
                      value={shipmentForm.length}
                      onChange={e => setShipmentForm({ ...shipmentForm, length: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Width</Label>
                    <Input
                      type="number"
                      value={shipmentForm.width}
                      onChange={e => setShipmentForm({ ...shipmentForm, width: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Height</Label>
                    <Input
                      type="number"
                      value={shipmentForm.height}
                      onChange={e => setShipmentForm({ ...shipmentForm, height: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preferred Pickup Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !shipmentForm.pickup_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {shipmentForm.pickup_date ? format(shipmentForm.pickup_date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={shipmentForm.pickup_date}
                      onSelect={(date) => setShipmentForm({ ...shipmentForm, pickup_date: date })}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Pickup Time Slot</Label>
                <RadioGroup value={shipmentForm.pickup_slot} onValueChange={(val) => setShipmentForm({ ...shipmentForm, pickup_slot: val })}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="before_noon" id="admin_before_noon" />
                    <Label htmlFor="admin_before_noon">Before Noon (10:00 AM)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after_noon" id="admin_after_noon" />
                    <Label htmlFor="admin_after_noon">After Noon (2:00 PM)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShipmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={createDelhiveryShipment} disabled={!!creatingShipment} className="gap-2">
              {creatingShipment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create Shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}