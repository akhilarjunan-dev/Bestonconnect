import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Truck, Package, Send, CalendarIcon, Ruler, Weight } from 'lucide-react';
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
}

export function VendorShipmentSchedule() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [manifestedOrders, setManifestedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (user) {
      fetchOrders();
      checkDelhivery();
    }
  }, [user]);

  const checkDelhivery = async () => {
    try {
      const { data } = await supabase.functions.invoke('delhivery', {
        body: { action: 'check_status' }
      });
      setDelhiveryEnabled(data?.enabled || false);
    } catch { /* ignore */ }
  };

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);

    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .eq('vendor_id', user.id);

    if (!products?.length) {
      setLoading(false);
      return;
    }

    const productIds = products.map(p => p.id);
    const productMap = new Map(products.map(p => [p.id, p.name]));

    // Fetch orders without waybill (need shipment creation)
    const { data: pendingData } = await supabase
      .from('orders')
      .select('*')
      .in('product_id', productIds)
      .in('status', ['pending', 'processing'])
      .is('delhivery_waybill', null)
      .order('created_at', { ascending: false });

    // Fetch manifested orders (need pickup scheduling)
    const { data: manifestedData } = await supabase
      .from('orders')
      .select('*')
      .in('product_id', productIds)
      .eq('delhivery_status', 'Manifested')
      .in('status', ['processing'])
      .not('delhivery_waybill', 'is', null)
      .order('created_at', { ascending: false });

    const mapOrder = (o: any) => ({
      ...o,
      product_name: productMap.get(o.product_id) || 'Unknown',
      delivery_address: o.delivery_address as Record<string, string> | null,
    });

    setOrders((pendingData || []).map(mapOrder));
    setManifestedOrders((manifestedData || []).map(mapOrder));
    setLoading(false);
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

      toast.success(`Shipment created! Waybill: ${data.waybill}`);
      setScheduleOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreatingShipment(false);
    }
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
          <p className="text-muted-foreground">Delhivery integration is not enabled by admin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Schedule Pickup & Create Shipment
          </CardTitle>
          <CardDescription>
            Enter package dimensions and schedule pickup for pending orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No pending orders to ship</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(order => (
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
                      <Badge variant="outline">{order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {order.delivery_address ? (
                        <Button size="sm" variant="outline" onClick={() => openSchedule(order)} className="gap-1">
                          <Send className="h-4 w-4" />
                          Schedule
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

      {/* Manifested Orders - Need Pickup Scheduling */}
      {manifestedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Schedule Pickup
              <Badge variant="destructive" className="ml-1">{manifestedOrders.length}</Badge>
            </CardTitle>
            <CardDescription>
              These orders are created in Delhivery but pickup hasn't been scheduled. Schedule pickup to move them to "Ready for Pickup".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Waybill</TableHead>
                  <TableHead>Amount</TableHead>
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
                    <TableCell className="font-mono text-xs">{order.delhivery_waybill}</TableCell>
                    <TableCell>₹{Number(order.total_amount).toFixed(2)}</TableCell>
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
          </CardContent>
        </Card>
      )}

      {/* Create Shipment Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Create Shipment
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">{selectedOrder.product_name}</p>
                <p className="text-muted-foreground">
                  Order: {(selectedOrder.order_id || selectedOrder.id).slice(0, 12)}... · Qty: {selectedOrder.quantity} · ₹{Number(selectedOrder.total_amount).toFixed(2)}
                </p>
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
                    <CalendarComponent
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
                    <RadioGroupItem value="before_noon" id="vendor_before_noon" />
                    <Label htmlFor="vendor_before_noon">Before Noon (10:00 AM)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after_noon" id="vendor_after_noon" />
                    <Label htmlFor="vendor_after_noon">After Noon (2:00 PM)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateShipment} disabled={creatingShipment} className="gap-2">
              {creatingShipment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Create Shipment
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
                    <CalendarComponent
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
                    <RadioGroupItem value="before_noon" id="vendor_pickup_before_noon" />
                    <Label htmlFor="vendor_pickup_before_noon">Before Noon (10:00 AM)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after_noon" id="vendor_pickup_after_noon" />
                    <Label htmlFor="vendor_pickup_after_noon">After Noon (2:00 PM)</Label>
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
