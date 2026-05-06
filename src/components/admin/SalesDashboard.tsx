import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  ShoppingBag, DollarSign, TrendingUp, Users, 
  Search, Filter, RefreshCw, Undo2, Calendar,
  ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';

interface Sale {
  id: string;
  product_id: string;
  promoter_id: string;
  buyer_email: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  created_at: string;
  refunded_at: string | null;
  product?: { name: string };
  promoter?: { full_name: string; email: string };
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalCommissions: number;
  uniquePromoters: number;
}

export function SalesDashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalCommissions: 0,
    uniquePromoters: 0
  });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [promoterFilter, setPromoterFilter] = useState('all');
  
  // Refund dialog
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Promoters for filter
  const [promoters, setPromoters] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchSales();
    fetchPromoters();
  }, [statusFilter, dateFrom, dateTo, promoterFilter]);

  const fetchPromoters = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    
    if (data) {
      setPromoters(data.map(p => ({ 
        id: p.id, 
        name: p.full_name || p.email 
      })));
    }
  };

  const fetchSales = async () => {
    setLoading(true);
    
    let query = supabase
      .from('sales')
      .select(`
        *,
        product:products(name)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59');
    }

    if (promoterFilter !== 'all') {
      query = query.eq('promoter_id', promoterFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sales:', error);
      toast.error('Failed to fetch sales');
      setLoading(false);
      return;
    }

    // Fetch promoter profiles separately
    const promoterIds = [...new Set((data || []).map(s => s.promoter_id))];
    let promoterMap: Record<string, { full_name: string; email: string }> = {};
    
    if (promoterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', promoterIds);
      
      if (profiles) {
        promoterMap = profiles.reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name || '', email: p.email };
          return acc;
        }, {} as Record<string, { full_name: string; email: string }>);
      }
    }

    const salesData = (data || []).map(sale => ({
      ...sale,
      promoter: promoterMap[sale.promoter_id] || { full_name: '', email: '' }
    })) as Sale[];
    
    setSales(salesData);
    setSales(salesData);

    // Calculate stats
    const completedSales = salesData.filter(s => s.status === 'completed');
    setStats({
      totalSales: completedSales.length,
      totalRevenue: completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
      totalCommissions: completedSales.reduce((sum, s) => sum + Number(s.commission_amount), 0),
      uniquePromoters: new Set(completedSales.map(s => s.promoter_id)).size
    });

    setLoading(false);
  };

  const handleRefund = async () => {
    if (!selectedSale) return;

    setProcessing(true);

    try {
      const { error } = await supabase
        .from('sales')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString()
        })
        .eq('id', selectedSale.id);

      if (error) throw error;

      toast.success('Sale refunded successfully');
      setRefundDialogOpen(false);
      setSelectedSale(null);
      setRefundReason('');
      fetchSales();
    } catch (error) {
      console.error('Refund error:', error);
      toast.error('Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const openRefundDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setRefundReason('');
    setRefundDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-earnings">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'refunded':
        return <Badge variant="destructive">Refunded</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredSales = sales.filter(sale => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      sale.buyer_email?.toLowerCase().includes(query) ||
      sale.product?.name?.toLowerCase().includes(query) ||
      sale.promoter?.full_name?.toLowerCase().includes(query) ||
      sale.promoter?.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-earnings/10">
                <DollarSign className="h-6 w-6 text-earnings" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-surge/10">
                <TrendingUp className="h-6 w-6 text-surge" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commissions Paid</p>
                <p className="text-2xl font-bold">₹{stats.totalCommissions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-info/10">
                <Users className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Promoters</p>
                <p className="text-2xl font-bold">{stats.uniquePromoters}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Sales Records
              </CardTitle>
              <CardDescription>View and manage all sales transactions</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSales} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={promoterFilter} onValueChange={setPromoterFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Promoter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Promoters</SelectItem>
                {promoters.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading sales...
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Promoter</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(sale.created_at), 'MMM d, yyyy')}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(sale.created_at), 'h:mm a')}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {sale.product?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {sale.promoter?.full_name || sale.promoter?.email || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.buyer_email || '-'}
                      </TableCell>
                      <TableCell className="text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{Number(sale.total_amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-earnings">
                        ₹{Number(sale.commission_amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                      <TableCell>
                        {sale.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRefundDialog(sale)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <Undo2 className="h-4 w-4" />
                            Refund
                          </Button>
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
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              This will mark the sale as refunded. The promoter's commission will be affected.
            </DialogDescription>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-medium">{selectedSale.product?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">₹{Number(selectedSale.total_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Commission</span>
                  <span className="font-medium text-earnings">₹{Number(selectedSale.commission_amount).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Refund Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for refund..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRefund}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}