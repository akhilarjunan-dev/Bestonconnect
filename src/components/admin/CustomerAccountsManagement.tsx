import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Search, 
  Eye, 
  Loader2, 
  Mail, 
  Phone, 
  MapPin, 
  ShoppingBag, 
  IndianRupee,
  UserPlus,
  Link as LinkIcon,
  Calendar,
  Package,
  Percent,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type PromoterTier = 'free' | 'premium';

interface Customer {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_pincode: string | null;
  promoter_tier: string | null;
  referred_by_promoter_id: string | null;
  roles: string[];
}

interface CustomerOrder {
  id: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  unit_price: number;
  status: string;
  created_at: string;
  promoter_code?: string;
  discount_received?: number;
}

interface CustomerReferral {
  id: string;
  referred_email: string;
  referred_name: string | null;
  created_at: string;
  type: 'customer' | 'promoter';
}

interface CustomerSale {
  id: string;
  product_name: string;
  total_amount: number;
  commission_amount: number;
  commission_rate: number;
  created_at: string;
  buyer_email: string;
}

interface CustomerDetails {
  customer: Customer;
  orders: CustomerOrder[];
  referredBy: { name: string | null; email: string } | null;
  referrals: CustomerReferral[];
  sales: CustomerSale[];
  totalSpent: number;
  totalDiscountReceived: number;
  totalCommissionEarned: number;
}

export function CustomerAccountsManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleUpdatePromoterTier = async (userId: string, tier: PromoterTier) => {
    const { error } = await supabase
      .from('profiles')
      .update({ promoter_tier: tier })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update tier');
      console.error('Error updating tier:', error);
      return;
    }

    // Update local state
    setCustomers(prev => prev.map(c => 
      c.id === userId ? { ...c, promoter_tier: tier } : c
    ));
    
    toast.success(`Promoter tier updated to ${tier}`);
  };

  const fetchCustomers = async () => {
    setLoading(true);

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching customers:', profilesError);
      setLoading(false);
      return;
    }

    // Fetch all roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const customersWithRoles: Customer[] = (profiles || []).map(profile => ({
      ...profile,
      roles: (roles || [])
        .filter(r => r.user_id === profile.id)
        .map(r => r.role)
    }));

    setCustomers(customersWithRoles);
    setLoading(false);
  };

  const fetchCustomerDetails = async (customer: Customer) => {
    setLoadingDetails(true);
    setDialogOpen(true);

    try {
      // Fetch orders with product names
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          quantity,
          total_amount,
          unit_price,
          status,
          created_at,
          promoter_id,
          products:product_id (name)
        `)
        .ilike('buyer_email', customer.email)
        .order('created_at', { ascending: false });

      // Fetch sales (if promoter)
      const { data: sales } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          commission_amount,
          commission_rate,
          created_at,
          buyer_email,
          products:product_id (name)
        `)
        .eq('promoter_id', customer.id)
        .order('created_at', { ascending: false });

      // Fetch referred by promoter info
      let referredBy = null;
      if (customer.referred_by_promoter_id) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', customer.referred_by_promoter_id)
          .maybeSingle();
        
        if (referrer) {
          referredBy = { name: referrer.full_name, email: referrer.email };
        }
      }

      // Fetch customers referred by this user
      const { data: referredCustomers } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .eq('referred_by_promoter_id', customer.id);

      // Fetch promoters referred by this user (if promoter)
      const { data: referredPromoters } = await supabase
        .from('promoter_referrals')
        .select(`
          id,
          created_at,
          referred_promoter_id
        `)
        .eq('referrer_promoter_id', customer.id);

      // Get referred promoter profiles
      let referredPromoterProfiles: any[] = [];
      if (referredPromoters && referredPromoters.length > 0) {
        const promoterIds = referredPromoters.map(r => r.referred_promoter_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', promoterIds);
        referredPromoterProfiles = profiles || [];
      }

      // Format orders
      const formattedOrders: CustomerOrder[] = (orders || []).map(order => ({
        id: order.id,
        product_name: (order.products as any)?.name || 'Unknown Product',
        quantity: order.quantity,
        total_amount: order.total_amount,
        unit_price: order.unit_price,
        status: order.status,
        created_at: order.created_at,
      }));

      // Format sales
      const formattedSales: CustomerSale[] = (sales || []).map(sale => ({
        id: sale.id,
        product_name: (sale.products as any)?.name || 'Unknown Product',
        total_amount: sale.total_amount,
        commission_amount: sale.commission_amount,
        commission_rate: sale.commission_rate,
        created_at: sale.created_at,
        buyer_email: sale.buyer_email || '',
      }));

      // Format referrals
      const customerReferrals: CustomerReferral[] = (referredCustomers || []).map(c => ({
        id: c.id,
        referred_email: c.email,
        referred_name: c.full_name,
        created_at: c.created_at,
        type: 'customer' as const
      }));

      const promoterReferrals: CustomerReferral[] = (referredPromoters || []).map(r => {
        const profile = referredPromoterProfiles.find(p => p.id === r.referred_promoter_id);
        return {
          id: r.id,
          referred_email: profile?.email || '',
          referred_name: profile?.full_name || null,
          created_at: r.created_at,
          type: 'promoter' as const
        };
      });

      const allReferrals = [...customerReferrals, ...promoterReferrals];

      // Calculate totals
      const totalSpent = formattedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const totalCommissionEarned = formattedSales.reduce((sum, s) => sum + s.commission_amount, 0);

      setSelectedCustomer({
        customer,
        orders: formattedOrders,
        referredBy,
        referrals: allReferrals,
        sales: formattedSales,
        totalSpent,
        totalDiscountReceived: 0, // Would need to calculate from order history if stored
        totalCommissionEarned
      });
    } catch (error) {
      console.error('Error fetching customer details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery ||
      c.full_name?.toLowerCase().includes(searchLower) ||
      c.email.toLowerCase().includes(searchLower) ||
      c.phone?.includes(searchQuery);
  });

  const exportToCSV = () => {
    if (filteredCustomers.length === 0) {
      toast.error('No customers to export');
      return;
    }

    const headers = [
      'Name',
      'Email',
      'Phone',
      'Roles',
      'Promoter Tier',
      'Delivery Name',
      'Delivery Phone',
      'Delivery Address',
      'Delivery City',
      'Delivery State',
      'Delivery Pincode',
      'Joined Date'
    ];

    const csvRows = [
      headers.join(','),
      ...filteredCustomers.map(c => [
        `"${c.full_name || ''}"`,
        `"${c.email}"`,
        `"${c.phone || ''}"`,
        `"${c.roles.join(', ')}"`,
        `"${c.promoter_tier || ''}"`,
        `"${c.delivery_name || ''}"`,
        `"${c.delivery_phone || ''}"`,
        `"${c.delivery_address || ''}"`,
        `"${c.delivery_city || ''}"`,
        `"${c.delivery_state || ''}"`,
        `"${c.delivery_pincode || ''}"`,
        `"${format(new Date(c.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `customers_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${filteredCustomers.length} customers to CSV`);
  };

  const exportCustomerOrders = (customerDetails: CustomerDetails) => {
    if (customerDetails.orders.length === 0) {
      toast.error('No orders to export');
      return;
    }

    const customerName = customerDetails.customer.full_name || customerDetails.customer.email;
    
    const headers = [
      'Order ID',
      'Product',
      'Quantity',
      'Unit Price',
      'Total Amount',
      'Status',
      'Order Date'
    ];

    const csvRows = [
      headers.join(','),
      ...customerDetails.orders.map(order => [
        `"${order.id}"`,
        `"${order.product_name}"`,
        order.quantity,
        order.unit_price,
        order.total_amount,
        `"${order.status}"`,
        `"${format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `orders_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${customerDetails.orders.length} orders for ${customerName}`);
  };

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
      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Customer Accounts
              </CardTitle>
              <CardDescription>
                View all registered users and their complete information
              </CardDescription>
            </div>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            Total: {filteredCustomers.length} users
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
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
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">{customer.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{customer.phone || 'Not provided'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {customer.roles.map(role => (
                          <Badge 
                            key={role} 
                            variant={role === 'admin' ? 'default' : role === 'promoter' ? 'secondary' : 'outline'}
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.roles.includes('promoter') ? (
                        <Select
                          value={customer.promoter_tier || 'free'}
                          onValueChange={(v) => handleUpdatePromoterTier(customer.id, v as PromoterTier)}
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(customer.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchCustomerDetails(customer)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Customer Details
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : selectedCustomer ? (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-4">
                {/* Basic Info */}
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedCustomer.customer.avatar_url || ''} />
                    <AvatarFallback className="text-xl">
                      {selectedCustomer.customer.full_name?.charAt(0)?.toUpperCase() || 
                       selectedCustomer.customer.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{selectedCustomer.customer.full_name || 'Unnamed User'}</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedCustomer.customer.roles.map(role => (
                        <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact & Address Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedCustomer.customer.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedCustomer.customer.phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Joined {format(new Date(selectedCustomer.customer.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Saved Delivery Address
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {selectedCustomer.customer.delivery_address ? (
                        <div className="space-y-1">
                          <p className="font-medium">{selectedCustomer.customer.delivery_name || 'N/A'}</p>
                          <p>{selectedCustomer.customer.delivery_phone || ''}</p>
                          <p>{selectedCustomer.customer.delivery_address}</p>
                          <p>
                            {selectedCustomer.customer.delivery_city}, {selectedCustomer.customer.delivery_state} - {selectedCustomer.customer.delivery_pincode}
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No saved address</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <ShoppingBag className="w-6 h-6 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">₹{selectedCustomer.totalSpent.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Package className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold">{selectedCustomer.orders.length}</p>
                      <p className="text-xs text-muted-foreground">Orders</p>
                    </CardContent>
                  </Card>
                  {selectedCustomer.customer.roles.includes('promoter') && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <IndianRupee className="w-6 h-6 mx-auto text-green-500 mb-2" />
                        <p className="text-2xl font-bold">₹{selectedCustomer.totalCommissionEarned.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Commission Earned</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Referred By */}
                {selectedCustomer.referredBy && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        Referred By
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{selectedCustomer.referredBy.name || 'Unnamed'}</span>
                        <span className="text-muted-foreground">({selectedCustomer.referredBy.email})</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                {/* Tabs for detailed data */}
                <Tabs defaultValue="orders" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="orders">Orders ({selectedCustomer.orders.length})</TabsTrigger>
                    <TabsTrigger value="referrals">Referrals ({selectedCustomer.referrals.length})</TabsTrigger>
                    {selectedCustomer.customer.roles.includes('promoter') && (
                      <TabsTrigger value="sales">Sales ({selectedCustomer.sales.length})</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="orders">
                    {selectedCustomer.orders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No orders yet</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-end mb-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportCustomerOrders(selectedCustomer)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export Orders
                          </Button>
                        </div>
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
                            {selectedCustomer.orders.map((order) => (
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
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="referrals">
                    {selectedCustomer.referrals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No referrals yet</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCustomer.referrals.map((ref) => (
                            <TableRow key={ref.id}>
                              <TableCell className="font-medium">{ref.referred_name || 'Unnamed'}</TableCell>
                              <TableCell>{ref.referred_email}</TableCell>
                              <TableCell>
                                <Badge variant={ref.type === 'promoter' ? 'default' : 'secondary'}>
                                  {ref.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(ref.created_at), 'MMM d, yyyy')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  {selectedCustomer.customer.roles.includes('promoter') && (
                    <TabsContent value="sales">
                      {selectedCustomer.sales.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Percent className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No sales yet</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Buyer</TableHead>
                              <TableHead className="text-right">Sale Amount</TableHead>
                              <TableHead className="text-right">Commission</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedCustomer.sales.map((sale) => (
                              <TableRow key={sale.id}>
                                <TableCell className="font-medium">{sale.product_name}</TableCell>
                                <TableCell className="text-sm">{sale.buyer_email}</TableCell>
                                <TableCell className="text-right">₹{sale.total_amount.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-green-600">
                                  ₹{sale.commission_amount.toLocaleString()}
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({sale.commission_rate}%)
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(sale.created_at), 'MMM d, yyyy')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
