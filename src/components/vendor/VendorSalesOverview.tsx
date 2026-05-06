import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ShoppingBag, Search, DollarSign, TrendingUp, Package } from 'lucide-react';
import { format } from 'date-fns';

interface Sale {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
  buyer_email: string | null;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalCommissionPaid: number;
  pendingRevenue: number;
}

export function VendorSalesOverview() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalCommissionPaid: 0,
    pendingRevenue: 0
  });

  useEffect(() => {
    fetchSales();
  }, [user]);

  const fetchSales = async () => {
    if (!user) return;

    setLoading(true);
    
    // First get vendor's product IDs
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

    // Fetch orders for vendor's products (includes both promoter-referred and direct)
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('id, product_id, quantity, unit_price, total_amount, status, created_at, buyer_email, promoter_id')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch sales data');
      setLoading(false);
      return;
    }

    // Also fetch vendor_earnings for commission info
    const { data: vendorEarnings } = await supabase
      .from('vendor_earnings')
      .select('order_id, commission_deducted, net_earning, status')
      .eq('vendor_id', user.id);

    const earningsMap = new Map(vendorEarnings?.map(e => [e.order_id, e]) || []);

    const formattedSales: Sale[] = (ordersData || []).map(order => {
      const earning = earningsMap.get(order.id);
      return {
        id: order.id,
        product_id: order.product_id,
        product_name: productMap.get(order.product_id) || 'Unknown Product',
        quantity: order.quantity,
        unit_price: order.unit_price,
        total_amount: order.total_amount,
        commission_amount: earning ? Number(earning.commission_deducted) : 0,
        status: order.status === 'completed' || order.status === 'delivered' ? 'completed' : order.status,
        created_at: order.created_at,
        buyer_email: order.buyer_email
      };
    });

    setSales(formattedSales);

    // Calculate stats
    const completedSales = formattedSales.filter(s => s.status === 'completed');
    const pendingSales = formattedSales.filter(s => s.status === 'pending' || s.status === 'processing' || s.status === 'shipped');

    setStats({
      totalSales: completedSales.length,
      totalRevenue: completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
      totalCommissionPaid: completedSales.reduce((sum, s) => sum + Number(s.commission_amount), 0),
      pendingRevenue: pendingSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    });

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-earnings/20 text-earnings border-earnings/30">Completed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning/50">Pending</Badge>;
      case 'refunded':
        return <Badge variant="destructive">Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.buyer_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalSales}</p>
              <p className="text-sm text-muted-foreground">Total Sales</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-earnings/10">
              <DollarSign className="w-5 h-5 text-earnings" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
              <TrendingUp className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{stats.totalCommissionPaid.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Commission Paid</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
              <Package className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{stats.pendingRevenue.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Pending Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Sales History
          </CardTitle>
          <CardDescription>View all sales of your products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by product or buyer..."
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No sales found</p>
            </div>
          ) : (
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
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-sm">
                        {format(new Date(sale.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{sale.product_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sale.buyer_email || 'N/A'}
                      </TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
