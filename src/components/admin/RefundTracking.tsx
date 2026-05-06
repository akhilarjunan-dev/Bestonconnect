import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { RefreshCw, Search, DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface CancelledOrder {
  id: string;
  order_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  total_amount: number;
  payment_id: string | null;
  status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  product?: { name: string };
  // Refund tracking fields stored in tracking_info
  refund_status: 'pending' | 'refunded';
  refund_transaction_id: string | null;
  refund_notes: string | null;
  refunded_at: string | null;
}

export function RefundTracking() {
  const [orders, setOrders] = useState<CancelledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refundFilter, setRefundFilter] = useState<string>('pending');

  // Refund dialog
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CancelledOrder | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCancelledOrders();
  }, [refundFilter]);

  const fetchCancelledOrders = async () => {
    setLoading(true);

    // Fetch cancelled orders that are prepaid (payment_id is NOT 'COD' and NOT null)
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_id, buyer_email, buyer_name, total_amount, payment_id, status, cancelled_at, cancellation_reason, created_at, tracking_info')
      .eq('status', 'cancelled')
      .not('payment_id', 'eq', 'COD')
      .not('payment_id', 'is', null)
      .order('cancelled_at', { ascending: false });

    if (error) {
      console.error('Error fetching cancelled orders:', error);
      toast.error('Failed to fetch cancelled orders');
      setLoading(false);
      return;
    }

    // Fetch product names
    const _productIds = [...new Set((data || []).map(o => (o as any).product_id).filter(Boolean))];
    let productMap: Record<string, string> = {};

    // We need product_id too
    const { data: fullOrders } = await supabase
      .from('orders')
      .select('id, product_id')
      .in('id', (data || []).map(o => o.id));

    const pIds = [...new Set((fullOrders || []).map(o => o.product_id))];
    if (pIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', pIds);
      if (products) {
        productMap = products.reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {} as Record<string, string>);
      }
    }

    const productIdMap = (fullOrders || []).reduce((acc, o) => { acc[o.id] = o.product_id; return acc; }, {} as Record<string, string>);

    const mapped: CancelledOrder[] = (data || []).map(order => {
      const trackingInfo = order.tracking_info as any;
      const refundInfo = trackingInfo?.refund || {};
      return {
        ...order,
        product: { name: productMap[productIdMap[order.id]] || 'Unknown' },
        refund_status: refundInfo.status || 'pending',
        refund_transaction_id: refundInfo.transaction_id || null,
        refund_notes: refundInfo.notes || null,
        refunded_at: refundInfo.refunded_at || null,
      };
    });

    // Apply refund filter
    const filtered = refundFilter === 'all'
      ? mapped
      : mapped.filter(o => o.refund_status === refundFilter);

    setOrders(filtered);
    setLoading(false);
  };

  const openRefundDialog = (order: CancelledOrder) => {
    setSelectedOrder(order);
    setTransactionId(order.refund_transaction_id || '');
    setRefundNotes(order.refund_notes || '');
    setRefundDialogOpen(true);
  };

  const markAsRefunded = async () => {
    if (!selectedOrder) return;
    setProcessing(true);

    try {
      // Get current tracking_info
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('tracking_info')
        .eq('id', selectedOrder.id)
        .single();

      const existingInfo = (currentOrder?.tracking_info as any) || {};

      const updatedTrackingInfo = {
        ...existingInfo,
        refund: {
          status: 'refunded',
          transaction_id: transactionId || null,
          notes: refundNotes || null,
          refunded_at: new Date().toISOString(),
        }
      };

      const { error } = await supabase
        .from('orders')
        .update({ tracking_info: updatedTrackingInfo })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      // Notify the buyer
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', selectedOrder.buyer_email)
        .maybeSingle();

      if (profile) {
        await supabase.from('notifications').insert({
          user_id: profile.id,
          title: '💰 Refund Processed',
          message: `Your refund of ₹${selectedOrder.total_amount.toLocaleString()} for "${selectedOrder.product?.name}" has been processed.${transactionId ? ` Transaction ID: ${transactionId}` : ''}`,
          type: 'success',
        });
      }

      toast.success('Order marked as refunded');
      setRefundDialogOpen(false);
      setSelectedOrder(null);
      fetchCancelledOrders();
    } catch (error) {
      console.error('Refund error:', error);
      toast.error('Failed to mark as refunded');
    } finally {
      setProcessing(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.buyer_email.toLowerCase().includes(q) ||
      order.buyer_name?.toLowerCase().includes(q) ||
      order.order_id?.toLowerCase().includes(q) ||
      order.product?.name.toLowerCase().includes(q)
    );
  });

  const pendingCount = orders.filter(o => o.refund_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Refunds</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Refund Amount</p>
                <p className="text-2xl font-bold">
                  ₹{orders.filter(o => o.refund_status === 'pending').reduce((s, o) => s + o.total_amount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Refunded</p>
                <p className="text-2xl font-bold">
                  {orders.filter(o => o.refund_status === 'refunded').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Refund Tracking
              </CardTitle>
              <CardDescription>Track and process refunds for cancelled prepaid orders</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchCancelledOrders} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by buyer, order ID, product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={refundFilter} onValueChange={setRefundFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Refund Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending Refund</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cancelled prepaid orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cancelled Date</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Refund Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap">
                        {order.cancelled_at
                          ? format(new Date(order.cancelled_at), 'MMM d, yyyy')
                          : format(new Date(order.created_at), 'MMM d, yyyy')}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {order.cancelled_at
                            ? format(new Date(order.cancelled_at), 'h:mm a')
                            : ''}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.order_id || order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.product?.name}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{order.buyer_name || order.buyer_email}</p>
                          {order.buyer_name && (
                            <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{order.total_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {order.payment_id}
                      </TableCell>
                      <TableCell>
                        {order.refund_status === 'refunded' ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Refunded
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.refund_status === 'pending' ? (
                          <Button
                            size="sm"
                            onClick={() => openRefundDialog(order)}
                            className="gap-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Mark Refunded
                          </Button>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {order.refund_transaction_id && (
                              <p>TXN: {order.refund_transaction_id}</p>
                            )}
                            {order.refunded_at && (
                              <p>{format(new Date(order.refunded_at), 'MMM d, yyyy')}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Refunded</DialogTitle>
            <DialogDescription>
              Confirm that the refund has been processed for this order.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-medium">{selectedOrder.product?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buyer</span>
                  <span className="font-medium">{selectedOrder.buyer_name || selectedOrder.buyer_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refund Amount</span>
                  <span className="font-medium text-primary">₹{selectedOrder.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment ID</span>
                  <span className="font-mono text-xs">{selectedOrder.payment_id}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="txn-id">Refund Transaction ID (optional)</Label>
                <Input
                  id="txn-id"
                  placeholder="e.g., rfnd_ABC123..."
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refund-notes">Notes (optional)</Label>
                <Textarea
                  id="refund-notes"
                  placeholder="Any notes about the refund..."
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={markAsRefunded} disabled={processing}>
              {processing ? 'Processing...' : '✅ Confirm Refund Processed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
