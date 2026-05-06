import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Truck, Search, Package, Clock, CheckCircle, XCircle, Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Order {
  id: string;
  order_id: string | null;
  product_id: string;
  product_name: string;
  buyer_name: string | null;
  buyer_email: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  created_at: string;
  delivered_at: string | null;
  payment_id: string | null;
  delhivery_waybill: string | null;
  delhivery_status: string | null;
  delivery_address: Record<string, string> | null;
}

export function VendorOrdersManagement() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    
    // Get vendor's product IDs
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .eq('vendor_id', user.id);

    if (!products || products.length === 0) {
      setLoading(false);
      return;
    }

    const productIds = products.map(p => p.id);
    const productMap = new Map(products.map(p => [p.id, p.name]));

    // Fetch orders for vendor's products
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('*')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch orders');
      setLoading(false);
      return;
    }

    const formattedOrders: Order[] = (ordersData || []).map(order => ({
      ...order,
      product_name: productMap.get(order.product_id) || 'Unknown Product',
      delivery_address: order.delivery_address as Record<string, string> | null,
    }));

    setOrders(formattedOrders);
    setLoading(false);
  };

  const handlePrintLabel = async (order: Order) => {
    if (!order.delhivery_waybill) {
      toast.error('No Delhivery waybill found');
      return;
    }
    try {
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
      doc.text(`Address: ${order.delivery_address.address || ''}, ${order.delivery_address.city || ''}`, 14, 90);
      doc.text(`${order.delivery_address.state || ''} - ${order.delivery_address.pincode || ''}, Phone: ${order.delivery_address.phone || ''}`, 14, 97);
    }

    doc.setFontSize(12);
    doc.text('Order Details', 14, 112);
    doc.setFontSize(10);
    doc.text(`Product: ${order.product_name}`, 14, 120);
    doc.text(`Quantity: ${order.quantity}`, 14, 127);
    doc.text(`Unit Price: Rs.${order.unit_price.toLocaleString()}`, 14, 134);
    doc.setFontSize(14);
    doc.text(`Total: Rs.${Number(order.total_amount).toLocaleString()}`, 14, 148);
    
    doc.save(`invoice-${(order.order_id || order.id).slice(0, 8)}.pdf`);
    toast.success('Invoice downloaded');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-earnings/20 text-earnings border-earnings/30">Delivered</Badge>;
      case 'shipped':
        return <Badge className="bg-info/20 text-info border-info/30">Shipped</Badge>;
      case 'processing':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Processing</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning/50">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-earnings" />;
      case 'shipped':
        return <Truck className="w-4 h-4 text-info" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing' || o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
              <Truck className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.processing}</p>
              <p className="text-sm text-muted-foreground">In Transit</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-earnings/10">
              <CheckCircle className="w-5 h-5 text-earnings" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.delivered}</p>
              <p className="text-sm text-muted-foreground">Delivered</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Orders
          </CardTitle>
          <CardDescription>View orders for your products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.order_id?.slice(0, 8) || order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(order.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{order.product_name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{order.buyer_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{order.quantity}</TableCell>
                      <TableCell>₹{Number(order.total_amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            {getStatusBadge(order.status)}
                          </div>
                          {order.delhivery_waybill && (
                            <Badge variant="outline" className="text-xs">
                              <Truck className="h-3 w-3 mr-1" />
                              {order.delhivery_status || 'Manifested'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {order.delhivery_waybill && (
                            <Button size="sm" variant="ghost" onClick={() => handlePrintLabel(order)} title="Print Label">
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
