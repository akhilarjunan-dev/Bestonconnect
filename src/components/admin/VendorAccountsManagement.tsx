import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Loader2, 
  Store, 
  Search, 
  Eye, 
  Package, 
  ShoppingBag, 
  DollarSign, 
  Boxes,
  AlertTriangle,
  TrendingUp,
  Truck
} from 'lucide-react';
import { format } from 'date-fns';

interface Vendor {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalWithdrawn: number;
  availableBalance: number;
  deliveryType: string | null;
  coveragePincodes: string[];
  coverageStates: string[];
}

interface VendorProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_quantity: number | null;
  is_active: boolean;
  is_digital: boolean;
}

interface VendorSale {
  id: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
  buyer_email: string | null;
}

interface VendorOrder {
  id: string;
  order_id: string | null;
  product_name: string;
  buyer_name: string | null;
  buyer_email: string;
  quantity: number;
  total_amount: number;
  status: string;
  created_at: string;
}

export function VendorAccountsManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorDetails, setVendorDetails] = useState<{
    products: VendorProduct[];
    sales: VendorSale[];
    orders: VendorOrder[];
  }>({ products: [], sales: [], orders: [] });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);

    // Get all users with vendor role
    const { data: vendorRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'vendor');

    if (!vendorRoles || vendorRoles.length === 0) {
      setVendors([]);
      setLoading(false);
      return;
    }

    const vendorIds = vendorRoles.map(r => r.user_id);

    // Get vendor profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, created_at')
      .in('id', vendorIds);

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Get vendor delivery profiles
    const { data: vendorProfiles } = await supabase
      .from('vendor_profiles')
      .select('user_id, delivery_type, coverage_pincodes, coverage_states')
      .in('user_id', vendorIds);

    const vendorProfileMap = new Map(vendorProfiles?.map(vp => [vp.user_id, vp]) || []);

    // Get products for each vendor
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, vendor_id, is_active, stock_quantity, is_digital')
      .in('vendor_id', vendorIds);

    // Get vendor earnings from vendor_earnings table (both pending and completed)
    const { data: allVendorEarnings } = await supabase
      .from('vendor_earnings')
      .select('vendor_id, net_earning, status')
      .in('vendor_id', vendorIds)
      .in('status', ['pending', 'completed']);

    // Get withdrawals for vendors
    const { data: allWithdrawals } = await supabase
      .from('withdrawals')
      .select('promoter_id, amount, status')
      .in('promoter_id', vendorIds)
      .eq('status', 'approved');

    // Calculate stats for each vendor
    const vendorsWithStats: Vendor[] = profiles.map(profile => {
      const vendorProducts = allProducts?.filter(p => p.vendor_id === profile.id) || [];
      const vendorEarnings = allVendorEarnings?.filter(e => e.vendor_id === profile.id) || [];
      const vendorWithdrawals = allWithdrawals?.filter(w => w.promoter_id === profile.id) || [];
      const totalEarnings = vendorEarnings.reduce((sum, e) => sum + Number(e.net_earning), 0);
      const totalWithdrawn = vendorWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
      const vProfile = vendorProfileMap.get(profile.id);

      return {
        ...profile,
        totalProducts: vendorProducts.length,
        activeProducts: vendorProducts.filter(p => p.is_active).length,
        lowStockProducts: vendorProducts.filter(p => 
          !p.is_digital && p.stock_quantity !== null && (p.stock_quantity || 0) < 10
        ).length,
        totalSales: vendorEarnings.length,
        totalRevenue: totalEarnings,
        totalWithdrawn: totalWithdrawn,
        availableBalance: Math.max(0, totalEarnings - totalWithdrawn),
        deliveryType: (vProfile as any)?.delivery_type || null,
        coveragePincodes: (vProfile as any)?.coverage_pincodes || [],
        coverageStates: (vProfile as any)?.coverage_states || [],
      };
    });

    setVendors(vendorsWithStats);
    setLoading(false);
  };

  const fetchVendorDetails = async (vendor: Vendor) => {
    setDetailsLoading(true);
    setSelectedVendor(vendor);
    setDialogOpen(true);

    // Fetch products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, category, price, stock_quantity, is_active, is_digital')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false });

    const productIds = products?.map(p => p.id) || [];
    const productMap = new Map(products?.map(p => [p.id, p.name]) || []);

    // Fetch sales
    let sales: VendorSale[] = [];
    if (productIds.length > 0) {
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .in('product_id', productIds)
        .order('created_at', { ascending: false })
        .limit(50);

      sales = (salesData || []).map(s => ({
        ...s,
        product_name: productMap.get(s.product_id) || 'Unknown'
      }));
    }

    // Fetch orders
    let orders: VendorOrder[] = [];
    if (productIds.length > 0) {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .in('product_id', productIds)
        .order('created_at', { ascending: false })
        .limit(50);

      orders = (ordersData || []).map(o => ({
        ...o,
        product_name: productMap.get(o.product_id) || 'Unknown'
      }));
    }

    setVendorDetails({
      products: products || [],
      sales,
      orders
    });
    setDetailsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return <Badge className="bg-earnings/20 text-earnings border-earnings/30">{status}</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning/50">{status}</Badge>;
      case 'refunded':
      case 'cancelled':
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.phone?.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{vendors.length}</p>
              <p className="text-sm text-muted-foreground">Total Vendors</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
              <Package className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{vendors.reduce((sum, v) => sum + v.totalProducts, 0)}</p>
              <p className="text-sm text-muted-foreground">Total Products</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-earnings/10">
              <ShoppingBag className="w-5 h-5 text-earnings" />
            </div>
            <div>
              <p className="text-2xl font-bold">{vendors.reduce((sum, v) => sum + v.totalSales, 0)}</p>
              <p className="text-sm text-muted-foreground">Total Sales</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surge/10">
              <DollarSign className="w-5 h-5 text-surge" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{vendors.reduce((sum, v) => sum + v.totalRevenue, 0).toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Vendor Accounts
          </CardTitle>
          <CardDescription>Manage vendor accounts, view their products, sales, and inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredVendors.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No vendors found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Delivery Type</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Low Stock</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Net Earnings</TableHead>
                    <TableHead>Withdrawn</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{vendor.full_name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{vendor.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.deliveryType ? (
                          <Badge variant="outline" className={
                            vendor.deliveryType === 'in_hand' ? 'text-primary border-primary/50' :
                            vendor.deliveryType === 'self_shipping' ? 'text-info border-info/50' :
                            'text-earnings border-earnings/50'
                          }>
                            {vendor.deliveryType === 'in_hand' ? 'In-Hand' :
                             vendor.deliveryType === 'self_shipping' ? 'Self Ship' : 'Auto (Delhivery)'}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{vendor.totalProducts}</Badge>
                          <span className="text-sm text-muted-foreground">
                            ({vendor.activeProducts} active)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.lowStockProducts > 0 ? (
                          <Badge variant="outline" className="text-warning border-warning/50">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {vendor.lowStockProducts}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-earnings/20 text-earnings border-earnings/30">
                          {vendor.totalSales}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{vendor.totalRevenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ₹{vendor.totalWithdrawn.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-medium text-earnings">
                        ₹{vendor.availableBalance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(vendor.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchVendorDetails(vendor)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
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

      {/* Vendor Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              {selectedVendor?.full_name || selectedVendor?.email}
            </DialogTitle>
            <DialogDescription>
              View vendor details, products, sales, and orders
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Package className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedVendor?.totalProducts}</p>
                      <p className="text-sm text-muted-foreground">Products</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="w-8 h-8 text-earnings mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedVendor?.totalSales}</p>
                      <p className="text-sm text-muted-foreground">Total Sales</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Boxes className="w-8 h-8 text-warning mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedVendor?.lowStockProducts}</p>
                      <p className="text-sm text-muted-foreground">Low Stock</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-earnings/30 bg-earnings/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Net Earnings</p>
                      <p className="text-2xl font-bold text-earnings">₹{selectedVendor?.totalRevenue.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-warning/30 bg-warning/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Total Withdrawn</p>
                      <p className="text-2xl font-bold text-warning">₹{selectedVendor?.totalWithdrawn.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Available Balance</p>
                      <p className="text-2xl font-bold text-primary">₹{selectedVendor?.availableBalance.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedVendor?.email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedVendor?.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Joined</p>
                        <p className="font-medium">
                          {selectedVendor && format(new Date(selectedVendor.created_at), 'MMMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Active Products</p>
                        <p className="font-medium">{selectedVendor?.activeProducts} / {selectedVendor?.totalProducts}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Delivery Type</p>
                        <p className="font-medium">
                          {selectedVendor?.deliveryType === 'in_hand' ? 'In-Hand Delivery' :
                           selectedVendor?.deliveryType === 'self_shipping' ? 'Self Shipping' :
                           selectedVendor?.deliveryType === 'auto_shipping' ? 'Auto Shipping (Delhivery)' :
                           'Not configured'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Coverage</p>
                        <p className="font-medium">
                          {selectedVendor?.deliveryType === 'in_hand' 
                            ? `${selectedVendor.coveragePincodes.length} pincodes`
                            : selectedVendor?.deliveryType === 'self_shipping'
                            ? `${selectedVendor.coverageStates.length} states`
                            : 'All India'}
                        </p>
                      </div>
                    </div>
                    {selectedVendor?.deliveryType === 'in_hand' && selectedVendor.coveragePincodes.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Coverage Pincodes:</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedVendor.coveragePincodes.map(pin => (
                            <Badge key={pin} variant="secondary" className="text-xs">{pin}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedVendor?.deliveryType === 'self_shipping' && selectedVendor.coverageStates.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Coverage States:</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedVendor.coverageStates.map(state => (
                            <Badge key={state} variant="secondary" className="text-xs">{state}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="products" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorDetails.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>₹{product.price}</TableCell>
                          <TableCell>
                            {product.is_digital ? (
                              <Badge variant="secondary">Digital</Badge>
                            ) : (
                              <Badge variant={(product.stock_quantity || 0) < 10 ? 'destructive' : 'secondary'}>
                                {product.stock_quantity || 0}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.is_active ? 'default' : 'secondary'}>
                              {product.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="sales" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorDetails.sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="text-sm">
                            {format(new Date(sale.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">{sale.product_name}</TableCell>
                          <TableCell className="text-sm">{sale.buyer_email || 'N/A'}</TableCell>
                          <TableCell>{sale.quantity}</TableCell>
                          <TableCell>₹{Number(sale.total_amount).toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            ₹{Number(sale.commission_amount).toFixed(2)}
                          </TableCell>
                          <TableCell>{getStatusBadge(sale.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="orders" className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorDetails.orders.map((order) => (
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
                          <TableCell>₹{Number(order.total_amount).toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
