import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, ShoppingBag, Eye, IndianRupee, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

interface Customer {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  total_orders: number;
  total_spent: number;
}

interface CustomerOrder {
  id: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  status: string;
  created_at: string;
}

export function RegisteredCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Get all profiles referred by this promoter
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, created_at')
        .eq('referred_by_promoter_id', user.id);

      if (profilesError) {
        console.error('Error fetching customers:', profilesError);
        setLoading(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      // Get order stats for each customer by their email
      const customerEmails = profiles.map(p => p.email);
      
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('buyer_email, total_amount')
        .in('buyer_email', customerEmails);

      if (ordersError) {
        console.error('Error fetching order stats:', ordersError);
      }

      // Aggregate order stats by email (case-insensitive)
      const statsByEmail: Record<string, { count: number; total: number }> = {};
      (orders || []).forEach(order => {
        const email = order.buyer_email.toLowerCase();
        if (!statsByEmail[email]) {
          statsByEmail[email] = { count: 0, total: 0 };
        }
        statsByEmail[email].count++;
        statsByEmail[email].total += Number(order.total_amount) || 0;
      });

      const customersWithStats: Customer[] = profiles.map(profile => {
        const emailKey = profile.email.toLowerCase();
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          created_at: profile.created_at,
          total_orders: statsByEmail[emailKey]?.count || 0,
          total_spent: statsByEmail[emailKey]?.total || 0,
        };
      });

      // Sort by registration date (newest first)
      customersWithStats.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setCustomers(customersWithStats);
    } catch (error) {
      console.error('Error in fetchCustomers:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewCustomerOrders = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
    setLoadingOrders(true);

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        quantity,
        total_amount,
        status,
        created_at,
        products:product_id (name)
      `)
      .ilike('buyer_email', customer.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer orders:', error);
      setLoadingOrders(false);
      return;
    }

    const formattedOrders: CustomerOrder[] = (orders || []).map(order => ({
      id: order.id,
      product_name: (order.products as any)?.name || 'Unknown Product',
      quantity: order.quantity,
      total_amount: order.total_amount,
      status: order.status,
      created_at: order.created_at,
    }));

    setCustomerOrders(formattedOrders);
    setLoadingOrders(false);
  };

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.total_orders, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-sm text-muted-foreground">Registered Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-earnings/10">
                <IndianRupee className="w-6 h-6 text-earnings" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-surge/10">
                <ShoppingBag className="w-6 h-6 text-surge" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalOrders}</p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            My Registered Customers
          </CardTitle>
          <CardDescription>
            Customers who registered through your referral links
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No customers yet</p>
              <p className="text-sm text-muted-foreground">
                Share your referral links to get customers registered under you
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={customer.avatar_url || ''} />
                            <AvatarFallback>
                              {customer.full_name?.charAt(0)?.toUpperCase() || customer.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{customer.full_name || 'Unnamed'}</p>
                            <p className="text-sm text-muted-foreground">{customer.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(customer.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={customer.total_orders > 0 ? 'default' : 'secondary'}>
                          {customer.total_orders}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{customer.total_spent.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewCustomerOrders(customer)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Orders
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Orders Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Orders by {selectedCustomer?.full_name || selectedCustomer?.email}
            </DialogTitle>
          </DialogHeader>

          {loadingOrders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : customerOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.product_name}</TableCell>
                      <TableCell className="text-center">{order.quantity}</TableCell>
                      <TableCell className="text-right">₹{order.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          order.status === 'delivered' ? 'default' :
                          order.status === 'cancelled' ? 'destructive' :
                          'secondary'
                        }>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
