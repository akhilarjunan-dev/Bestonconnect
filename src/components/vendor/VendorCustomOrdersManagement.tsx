import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { toast } from 'sonner';
import { Loader2, ClipboardList, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface CustomOrder {
  id: string;
  product_id: string;
  user_id: string;
  form_data: Record<string, any>;
  status: string;
  vendor_notes: string | null;
  total_amount: number | null;
  created_at: string;
  products?: { name: string } | null;
}

export function VendorCustomOrdersManagement() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => { if (user) fetchOrders(); }, [user]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('custom_orders')
      .select('*, products(name)')
      .eq('vendor_id', user?.id)
      .order('created_at', { ascending: false });

    setOrders((data as any) || []);
    setLoading(false);
  };

  const updateOrder = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    const { error } = await supabase
      .from('custom_orders')
      .update({ status, vendor_notes: notes[orderId] || null })
      .eq('id', orderId);

    if (error) toast.error('Failed to update');
    else { toast.success('Order updated'); fetchOrders(); }
    setUpdatingId(null);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'bg-warning/10 text-warning';
      case 'in_progress': return 'bg-info/10 text-info';
      case 'completed': return 'bg-earnings/10 text-earnings';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Custom Orders</h2>
        <Badge variant="secondary">{orders.length}</Badge>
      </div>

      {orders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No custom orders yet.</CardContent></Card>
      ) : (
        orders.map(order => (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{(order as any).products?.name || 'Product'}</CardTitle>
                <Badge className={statusColor(order.status)}>{order.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Customer Form Data:</p>
                {Object.entries(order.form_data || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>

              {order.status === 'pending' && (
                <div className="space-y-2 pt-2">
                  <Textarea
                    placeholder="Add notes for the customer..."
                    value={notes[order.id] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateOrder(order.id, 'in_progress')} disabled={updatingId === order.id}>
                      {updatingId === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageSquare className="h-4 w-4 mr-1" />}
                      Accept
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateOrder(order.id, 'rejected')} disabled={updatingId === order.id}>
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {order.status === 'in_progress' && (
                <Button size="sm" onClick={() => updateOrder(order.id, 'completed')} disabled={updatingId === order.id}>
                  Mark Completed
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
