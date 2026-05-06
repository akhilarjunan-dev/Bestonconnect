import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Truck, Package, Send, CalendarIcon, Ruler, Weight, RefreshCw, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_id: string | null;
  product_id: string;
  product_name: string;
  buyer_name: string | null;
  buyer_email: string;
  quantity: number;
  total_amount: number;
  status: string;
  created_at: string;
  delivery_address: Record<string, string> | null;
  delhivery_waybill: string | null;
  delhivery_status: string | null;
  payment_id: string | null;
  shipping_created_at: string | null;
}

export function AdminSchedulePickup() {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [manifestedOrders, setManifestedOrders] = useState<Order[]>([]);
  const [scheduledOrders, setScheduledOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [delhiveryEnabled, setDelhiveryEnabled] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pickupScheduleOpen, setPickupScheduleOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [schedulingPickup, setSchedulingPickup] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    weight: '500',
    length: '20',
    width: '15',
    height: '10',
    pickup_date: undefined as Date | undefined,
    pickup_slot: '' as string,
  });
  const [pickupForm, setPickupForm] = useState({
    pickup_date: undefined as Date | undefined,
    pickup_slot: '' as string,
  });

  useEffect(() => {
    fetchOrders();
    checkDelhivery();
  }, []);

  const checkDelhivery = async () => {
    try {
      const { data } = await supabase.functions.invoke('delhivery', {
        body: { action: 'check_status' }
      });
      setDelhiveryEnabled(data?.enabled || false);
    } catch { /* ignore */ }
  };

  const fetchOrders = async () => {
    setLoading(true);

    // Fetch ALL physical (non-digital) orders
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('is_digital', false)
      .not('status', 'in', '("cancelled")')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!ordersData?.length) {
      setPendingOrders([]);
      setScheduledOrders([]);
      setLoading(false);
      return;
    }

    // Fetch product names
    const productIds = [...new Set(ordersData.map(o => o.product_id))];
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);

    const productMap = new Map((products || []).map(p => [p.id, p.name]));

    const allOrders = ordersData.map(o => ({
      ...o,
      product_name: productMap.get(o.product_id) || 'Unknown',
      delivery_address: o.delivery_address as Record<string, string> | null,
    }));

    // Split into: no waybill (needs shipment creation), manifested (needs pickup scheduling), and in-progress/shipped
    setPendingOrders(allOrders.filter(o => !o.delhivery_waybill && ['pending', 'processing'].includes(o.status)));
    setManifestedOrders(allOrders.filter(o => o.delhivery_waybill && o.delhivery_status === 'Manifested' && ['processing'].includes(o.status)));
    setScheduledOrders(allOrders.filter(o => o.delhivery_waybill && o.delhivery_status !== 'Manifested'));
    setLoading(false);
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('delhivery', {
        body: { action: 'sync_all_shipments' }
      });
      if (error) throw new Error(error.message);
      toast.success(`Synced ${data?.synced || 0} of ${data?.total || 0} shipments`);
      fetchOrders();
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const openSchedule = (order: Order) => {
    setSelectedOrder(order);
    setShipmentForm({
      weight: '500',
      length: '20',
      width: '15',
      height: '10',
      pickup_date: undefined,
      pickup_slot: '',
    });
    setScheduleOpen(true);
  };

  const handleCreateShipment = async () => {
    if (!selectedOrder) return;

    setCreatingShipment(true);
    try {
      const isCOD = selectedOrder.payment_id === 'COD';
      const { data, error } = await supabase.functions.invoke('delhivery', {
        body: {
          action: 'create_shipment',
          order_id: selectedOrder.id,
          product_name: selectedOrder.product_name,
          quantity: selectedOrder.quantity,
          total_amount: selectedOrder.total_amount,
          delivery_address: selectedOrder.delivery_address,
          weight: parseInt(shipmentForm.weight) || 500,
          dimensions: {
            length: parseInt(shipmentForm.length) || 20,
            width: parseInt(shipmentForm.width) || 15,
            height: parseInt(shipmentForm.height) || 10,
          },
          pickup_time: shipmentForm.pickup_date ? `${format(shipmentForm.pickup_date, 'yyyy-MM-dd')} ${shipmentForm.pickup_slot === 'before_noon' ? '10:00' : '14:00'}` : undefined,
          payment_mode: isCOD ? 'COD' : 'Prepaid',
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error('Failed to create shipment');

      toast.success(`Shipment created! Waybill: ${data.waybill}. Pickup scheduled.`);
      setScheduleOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreatingShipment(false);
    }
  };

  const openPickupSchedule = (order: Order) => {
    setSelectedOrder(order);
    setPickupForm({ pickup_date: undefined, pickup_slot: '' });
    setPickupScheduleOpen(true);
  };

  const handleSchedulePickup = async () => {
    if (!selectedOrder) return;
    setSchedulingPickup(true);
    try {
      const { data, error } = await supabase.functions.invoke('delhivery', {
        body: {
          action: 'schedule_pickup',
          order_id: selectedOrder.id,
          pickup_time: pickupForm.pickup_date ? `${format(pickupForm.pickup_date, 'yyyy-MM-dd')} ${pickupForm.pickup_slot === 'before_noon' ? '10:00' : '14:00'}` : undefined,
        }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success('Pickup scheduled! Order moved to Ready for Pickup.');
      setPickupScheduleOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSchedulingPickup(false);
    }
  };

  const getDelhiveryStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">No Status</Badge>;
    const color = status === 'Delivered' ? 'default' :
      ['Picked Up', 'In Transit', 'Out For Delivery', 'Dispatched'].includes(status) ? 'secondary' :
      status === 'Manifested' ? 'outline' : 'destructive';
    return <Badge variant={color}>{status}</Badge>;
  };

  const getOrderStatusBadge = (status: string) => {
    const variant = status === 'completed' ? 'default' :
      status === 'shipped' ? 'secondary' :
      status === 'processing' ? 'outline' : 'outline';
    return <Badge variant={variant}>{status}</Badge>;
  };

  // Check if order was scheduled within acceptable time (e.g., < 24h from creation)
  const getTimingStatus = (order: Order) => {
    if (!order.shipping_created_at) return null;
    const created = new Date(order.created_at);
    const shipped = new Date(order.shipping_created_at);
    const hoursElapsed = (shipped.getTime() - created.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed <= 24) return 'on-time';
    if (hoursElapsed <= 48) return 'late';
    return 'very-late';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!delhiveryEnabled) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Delhivery integration is not enabled. Enable it in Delhivery Settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Delhivery Status
          </Button>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Package className="h-4 w-4" />
            Needs Shipment
            {pendingOrders.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingOrders.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="manifested" className="gap-2">
            <Send className="h-4 w-4" />
            Needs Pickup
            {manifestedOrders.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{manifestedOrders.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Truck className="h-4 w-4" />
            In Progress
            <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs">{scheduledOrders.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Pending Orders - need scheduling */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Schedule Pickup & Create Shipment
              </CardTitle>
              <CardDescription>
                Physical orders awaiting pickup scheduling. Vendors should schedule these — you can intervene if needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOrders.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">All orders have been scheduled!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">
                          {(order.order_id || order.id).slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">{order.product_name}</TableCell>
                        <TableCell>
                          <p className="text-sm">{order.buyer_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                        </TableCell>
                        <TableCell>₹{Number(order.total_amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {order.payment_id === 'COD' ? 'COD' : 'Prepaid'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          {getOrderStatusBadge(order.status)}
                        </TableCell>
                        <TableCell>
                          {order.delivery_address ? (
                            <Button size="sm" variant="outline" onClick={() => openSchedule(order)} className="gap-1">
                              <Send className="h-4 w-4" />
                              Schedule Pickup
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">No address</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manifested Orders - need pickup scheduling */}
        <TabsContent value="manifested">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Schedule Pickup for Manifested Orders
              </CardTitle>
              <CardDescription>
                These orders are created in Delhivery but pickup hasn't been scheduled yet. Schedule pickup to move them to "Ready for Pickup".
              </CardDescription>
            </CardHeader>
            <CardContent>
              {manifestedOrders.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">No manifested orders awaiting pickup</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Waybill</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Delhivery Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manifestedOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">
                          {(order.order_id || order.id).slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">{order.product_name}</TableCell>
                        <TableCell>
                          <p className="text-sm">{order.buyer_name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{order.delhivery_waybill}</TableCell>
                        <TableCell>₹{Number(order.total_amount).toFixed(2)}</TableCell>
                        <TableCell>{getDelhiveryStatusBadge(order.delhivery_status)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openPickupSchedule(order)} className="gap-1">
                            <Truck className="h-4 w-4" />
                            Schedule Pickup
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All scheduled orders - monitoring view */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                All Scheduled Orders
              </CardTitle>
              <CardDescription>
                Monitor all shipments — check if vendors scheduled pickups on time and track current Delhivery status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No scheduled shipments yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Waybill</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Scheduled At</TableHead>
                      <TableHead>Timing</TableHead>
                      <TableHead>Delhivery Status</TableHead>
                      <TableHead>Order Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledOrders.map(order => {
                      const timing = getTimingStatus(order);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            {(order.order_id || order.id).slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-medium">{order.product_name}</TableCell>
                          <TableCell>
                            <p className="text-sm">{order.buyer_name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {order.delhivery_waybill}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {order.shipping_created_at
                              ? new Date(order.shipping_created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </TableCell>
                          <TableCell>
            {timing === 'on-time' && (
                              <span className="flex items-center gap-1 text-xs text-primary">
                                <CheckCircle className="h-3 w-3" /> On Time
                              </span>
                            )}
                            {timing === 'late' && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> Late
                              </span>
                            )}
                            {timing === 'very-late' && (
                              <span className="flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="h-3 w-3" /> Very Late
                              </span>
                            )}
                            {!timing && <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {getDelhiveryStatusBadge(order.delhivery_status)}
                          </TableCell>
                          <TableCell>
                            {getOrderStatusBadge(order.status)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Pickup Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Schedule Pickup
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">{selectedOrder.product_name}</p>
                <p className="text-muted-foreground">
                  Order: {(selectedOrder.order_id || selectedOrder.id).slice(0, 12)}... · Qty: {selectedOrder.quantity} · ₹{Number(selectedOrder.total_amount).toFixed(2)}
                </p>
                {selectedOrder.payment_id === 'COD' && (
                  <Badge variant="outline" className="mt-1">COD</Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Weight className="h-4 w-4" /> Package Weight (grams)
                </Label>
                <Input
                  type="number"
                  value={shipmentForm.weight}
                  onChange={e => setShipmentForm({ ...shipmentForm, weight: e.target.value })}
                  placeholder="500"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Ruler className="h-4 w-4" /> Dimensions (cm)
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Length</Label>
                    <Input
                      type="number"
                      value={shipmentForm.length}
                      onChange={e => setShipmentForm({ ...shipmentForm, length: e.target.value })}
                      placeholder="20"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Width</Label>
                    <Input
                      type="number"
                      value={shipmentForm.width}
                      onChange={e => setShipmentForm({ ...shipmentForm, width: e.target.value })}
                      placeholder="15"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Height</Label>
                    <Input
                      type="number"
                      value={shipmentForm.height}
                      onChange={e => setShipmentForm({ ...shipmentForm, height: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Preferred Pickup Date (optional)
                </Label>
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
                    <RadioGroupItem value="before_noon" id="admin_pickup_before_noon" />
                    <Label htmlFor="admin_pickup_before_noon">Before Noon (10:00 AM)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after_noon" id="admin_pickup_after_noon" />
                    <Label htmlFor="admin_pickup_after_noon">After Noon (2:00 PM)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateShipment} disabled={creatingShipment} className="gap-2">
              {creatingShipment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create Shipment & Schedule Pickup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Pickup Dialog (for manifested orders) */}
      <Dialog open={pickupScheduleOpen} onOpenChange={setPickupScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Schedule Pickup
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">{selectedOrder.product_name}</p>
                <p className="text-muted-foreground">
                  Waybill: {selectedOrder.delhivery_waybill} · ₹{Number(selectedOrder.total_amount).toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Pickup Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !pickupForm.pickup_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pickupForm.pickup_date ? format(pickupForm.pickup_date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pickupForm.pickup_date}
                      onSelect={(date) => setPickupForm({ ...pickupForm, pickup_date: date })}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Pickup Time Slot</Label>
                <RadioGroup value={pickupForm.pickup_slot} onValueChange={(val) => setPickupForm({ ...pickupForm, pickup_slot: val })}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="before_noon" id="pickup_before_noon" />
                    <Label htmlFor="pickup_before_noon">Before Noon (10:00 AM)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after_noon" id="pickup_after_noon" />
                    <Label htmlFor="pickup_after_noon">After Noon (2:00 PM)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleSchedulePickup} disabled={schedulingPickup} className="gap-2">
              {schedulingPickup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Schedule Pickup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
