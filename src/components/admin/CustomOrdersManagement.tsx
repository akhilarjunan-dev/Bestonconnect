import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ClipboardList, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface CustomOrder {
  id: string;
  product_id: string;
  user_id: string;
  vendor_id: string | null;
  form_data: Record<string, any>;
  status: string;
  admin_notes: string | null;
  vendor_notes: string | null;
  total_amount: number | null;
  created_at: string;
  product_name?: string;
  customer_email?: string;
  customer_name?: string;
  vendor_name?: string;
}

export function CustomOrdersManagement() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CustomOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('custom_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to fetch custom orders'); setLoading(false); return; }

    // Enrich with product and user names
    const enriched: CustomOrder[] = [];
    for (const order of (data || [])) {
      const { data: product } = await supabase.from('products').select('name').eq('id', order.product_id).maybeSingle();
      const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', order.user_id).maybeSingle();
      let vendorName: string | undefined;
      if (order.vendor_id) {
        const { data: vp } = await supabase.from('profiles').select('full_name').eq('id', order.vendor_id).maybeSingle();
        vendorName = vp?.full_name || undefined;
      }
      enriched.push({
        ...order,
        form_data: order.form_data as Record<string, any>,
        product_name: product?.name,
        customer_email: profile?.email,
        customer_name: profile?.full_name || undefined,
        vendor_name: vendorName,
      });
    }
    setOrders(enriched);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('custom_orders').update({ status, admin_notes: adminNotes || null }).eq('id', orderId);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Order updated');
    setDetailOpen(false);
    fetchOrders();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'secondary';
      case 'accepted': return 'default';
      case 'in_progress': return 'default';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  if (loading) return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Custom Orders</CardTitle>
                <CardDescription>Track and manage custom order requests from customers</CardDescription>
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No custom orders found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="text-sm">{format(new Date(order.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="font-medium">{order.product_name || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm">{order.customer_name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                    </TableCell>
                    <TableCell>{order.vendor_name || 'Admin'}</TableCell>
                    <TableCell><Badge variant={statusColor(order.status)}>{order.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(order); setAdminNotes(order.admin_notes || ''); setDetailOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Product:</span> {selectedOrder.product_name}</div>
                <div><span className="text-muted-foreground">Customer:</span> {selectedOrder.customer_name}</div>
                <div><span className="text-muted-foreground">Email:</span> {selectedOrder.customer_email}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusColor(selectedOrder.status)}>{selectedOrder.status}</Badge></div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Form Responses</h4>
                {Object.entries(selectedOrder.form_data).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground">{key}:</span> <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>

              {selectedOrder.vendor_notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-1">Vendor Notes</h4>
                  <p className="text-sm">{selectedOrder.vendor_notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Add notes..." rows={2} />
              </div>

              <div className="flex gap-2">
                <Select defaultValue={selectedOrder.status} onValueChange={v => updateOrderStatus(selectedOrder.id, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
