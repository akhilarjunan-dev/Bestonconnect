import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Download, Search, RefreshCw, Receipt, X } from 'lucide-react';
import { format } from 'date-fns';

interface SalesAccountEntry {
  sno: number;
  date: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  promoterName: string;
  promoterId: string | null;
  vendorName: string;
  vendorId: string | null;
  salesAmount: number;
  deliveryCharge: number;
  productAmount: number;
  promoterAmount: number;
  vendorAmount: number;
  tierMargin: number;
  profit: number;
  isPromoterSale: boolean;
  shopperDiscount: number;
  promoterCommission: number;
  platformCommission: number;
}

type DrillDownType = 'vendor' | 'promoter' | 'customer';

export function SalesAccountsDashboard() {
  const [entries, setEntries] = useState<SalesAccountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('all');
  const [drillDown, setDrillDown] = useState<{ type: DrillDownType; name: string; id: string } | null>(null);

  useEffect(() => {
    fetchSalesAccounts();
  }, [dateFrom, dateTo, saleTypeFilter]);

  const fetchSalesAccounts = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('orders')
        .select(`
          id, order_id, created_at, buyer_name, buyer_email, user_id,
          product_id, quantity, unit_price, total_amount, status,
          promoter_id, delivery_address
        `)
        .in('status', ['completed', 'delivered', 'shipped', 'processing', 'pending'])
        .order('created_at', { ascending: false });

      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

      const { data: orders, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const productIds = [...new Set(orders.map(o => o.product_id))];
      const { data: products } = await supabase
        .from('products')
        .select('id, name, commission_rate, promoter_code_discount, platform_commission, vendor_id, shipping_charge')
        .in('id', productIds);

      const productMap: Record<string, any> = {};
      (products || []).forEach(p => { productMap[p.id] = p; });

      const vendorIds = [...new Set((products || []).map(p => p.vendor_id).filter(Boolean))];
      let vendorMap: Record<string, string> = {};
      if (vendorIds.length > 0) {
        const { data: vendorProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', vendorIds);
        (vendorProfiles || []).forEach(v => {
          vendorMap[v.id] = v.full_name || v.email;
        });
      }

      const promoterIds = [...new Set(orders.map(o => o.promoter_id).filter(Boolean))];
      let promoterMap: Record<string, string> = {};
      if (promoterIds.length > 0) {
        const { data: promoterProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', promoterIds);
        (promoterProfiles || []).forEach(p => {
          promoterMap[p.id] = p.full_name || p.email;
        });
      }

      // Get tier-adjusted earnings
      const { data: earningsData } = await supabase
        .from('earnings')
        .select('formula_breakdown, amount, base_amount');

      const earningBySaleMap: Record<string, { amount: number; baseAmount: number }> = {};
      (earningsData || []).forEach(e => {
        const breakdown = e.formula_breakdown as any;
        if (breakdown?.sale_id) {
          earningBySaleMap[breakdown.sale_id] = {
            amount: Number(e.amount),
            baseAmount: Number(e.base_amount)
          };
        }
      });

      const { data: salesData } = await supabase
        .from('sales')
        .select('id, product_id, promoter_id, commission_amount, commission_rate, total_amount, buyer_email');

      const salesByOrder: Record<string, any> = {};
      (salesData || []).forEach(s => {
        const key = `${s.buyer_email}_${s.product_id}`;
        salesByOrder[key] = s;
      });

      const accountEntries: SalesAccountEntry[] = orders.map((order, index) => {
        const product = productMap[order.product_id] || {};
        const isPromoterSale = !!order.promoter_id;
        const promoterCommissionRate = Number(product.commission_rate || 10);
        const shopperDiscountRate = Number(product.promoter_code_discount || 0);
        const platformCommissionRate = Number(product.platform_commission || 0);
        const vendorId = product.vendor_id;

        const salesAmount = Number(order.total_amount);
        const productAmount = Number(order.unit_price) * Number(order.quantity);
        const deliveryCharge = Math.max(0, salesAmount - productAmount);

        // Base promoter amount (before tier adjustment)
        const basePromoterAmount = isPromoterSale ? (promoterCommissionRate / 100) * productAmount : 0;

        // Find actual tier-adjusted earning
        const saleKey = `${order.buyer_email}_${order.product_id}`;
        const matchedSale = salesByOrder[saleKey];
        const earning = matchedSale ? earningBySaleMap[matchedSale.id] : null;
        const actualPromoterPaid = earning ? earning.amount : basePromoterAmount;

        // Tier Margin = base - actual paid
        const tierMargin = isPromoterSale ? Math.max(0, basePromoterAmount - actualPromoterPaid) : 0;
        const promoterAmount = actualPromoterPaid;

        // CORRECTED: Vendor Amount = Product Amount - (Shopper Discount + Promoter Commission + Platform Commission)
        const shopperDiscountAmount = (shopperDiscountRate / 100) * productAmount;
        const promoterCommissionAmount = (promoterCommissionRate / 100) * productAmount;
        const platformAmount = (platformCommissionRate / 100) * productAmount;
        const vendorAmount = productAmount - shopperDiscountAmount - promoterCommissionAmount - platformAmount;

        // Platform profit
        let profit: number;
        if (isPromoterSale) {
          profit = platformAmount;
        } else {
          // Non-promoter: platform gets platform + promoter + shopper (all unclaimed)
          profit = platformAmount + promoterCommissionAmount + shopperDiscountAmount;
        }

        return {
          sno: index + 1,
          date: order.created_at,
          orderId: order.order_id || order.id.slice(0, 8),
          customerName: order.buyer_name || order.buyer_email || 'Unknown',
          customerEmail: order.buyer_email,
          productName: product.name || 'Unknown',
          promoterName: order.promoter_id ? (promoterMap[order.promoter_id] || 'Unknown') : '-',
          promoterId: order.promoter_id || null,
          vendorName: vendorId ? (vendorMap[vendorId] || 'Unknown') : 'Platform',
          vendorId: vendorId || null,
          salesAmount,
          deliveryCharge,
          productAmount,
          promoterAmount,
          vendorAmount: Math.max(0, vendorAmount),
          tierMargin,
          profit: Math.max(0, profit),
          isPromoterSale,
          shopperDiscount: shopperDiscountRate,
          promoterCommission: promoterCommissionRate,
          platformCommission: platformCommissionRate
        };
      });

      let filtered = accountEntries;
      if (saleTypeFilter === 'promoter') {
        filtered = accountEntries.filter(e => e.isPromoterSale);
      } else if (saleTypeFilter === 'direct') {
        filtered = accountEntries.filter(e => !e.isPromoterSale);
      }

      setEntries(filtered);
    } catch (error) {
      console.error('Error fetching sales accounts:', error);
      toast.error('Failed to load sales accounts');
    }

    setLoading(false);
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.customerName.toLowerCase().includes(q) ||
      entry.productName.toLowerCase().includes(q) ||
      entry.promoterName.toLowerCase().includes(q) ||
      entry.vendorName.toLowerCase().includes(q) ||
      entry.orderId.toLowerCase().includes(q)
    );
  });

  // Drill-down filtered entries
  const drillDownEntries = drillDown
    ? filteredEntries.filter(e => {
        if (drillDown.type === 'vendor') return e.vendorId === drillDown.id || e.vendorName === drillDown.name;
        if (drillDown.type === 'promoter') return e.promoterId === drillDown.id;
        if (drillDown.type === 'customer') return e.customerEmail === drillDown.id;
        return false;
      })
    : [];

  const calcTotals = (list: SalesAccountEntry[]) =>
    list.reduce((acc, e) => ({
      salesAmount: acc.salesAmount + e.salesAmount,
      deliveryCharge: acc.deliveryCharge + e.deliveryCharge,
      productAmount: acc.productAmount + e.productAmount,
      promoterAmount: acc.promoterAmount + e.promoterAmount,
      vendorAmount: acc.vendorAmount + e.vendorAmount,
      tierMargin: acc.tierMargin + e.tierMargin,
      profit: acc.profit + e.profit,
    }), { salesAmount: 0, deliveryCharge: 0, productAmount: 0, promoterAmount: 0, vendorAmount: 0, tierMargin: 0, profit: 0 });

  const totals = calcTotals(filteredEntries);

  const exportCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'S.No', 'Date', 'Order ID', 'Customer Name', 'Product', 'Promoter', 'Vendor',
      'Sale Type', 'Sales Amount (₹)', 'Delivery Charge (₹)', 'Product Amount (₹)',
      'Promoter Amount (₹)', 'Vendor Amount (₹)', 'Tier Margin (₹)', 'Profit (₹)',
      'Shopper Discount %', 'Promoter Commission %', 'Platform Commission %'
    ];

    const rows = filteredEntries.map(e => [
      e.sno,
      format(new Date(e.date), 'yyyy-MM-dd HH:mm'),
      e.orderId,
      `"${e.customerName}"`,
      `"${e.productName}"`,
      `"${e.promoterName}"`,
      `"${e.vendorName}"`,
      e.isPromoterSale ? 'Promoter' : 'Direct',
      e.salesAmount.toFixed(2),
      e.deliveryCharge.toFixed(2),
      e.productAmount.toFixed(2),
      e.promoterAmount.toFixed(2),
      e.vendorAmount.toFixed(2),
      e.tierMargin.toFixed(2),
      e.profit.toFixed(2),
      e.shopperDiscount,
      e.promoterCommission,
      e.platformCommission
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_accounts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const openDrillDown = (type: DrillDownType, name: string, id: string) => {
    setDrillDown({ type, name, id });
  };

  const renderTable = (data: SalesAccountEntry[], totalsData: ReturnType<typeof calcTotals>, compact = false) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">S.No</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Promoter</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Sales Amt</TableHead>
            <TableHead className="text-right">Delivery</TableHead>
            <TableHead className="text-right">Product Amt</TableHead>
            <TableHead className="text-right">Promoter Amt</TableHead>
            <TableHead className="text-right">Vendor Amt</TableHead>
            <TableHead className="text-right">Tier Margin</TableHead>
            <TableHead className="text-right">Profit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry) => (
            <TableRow key={`${entry.orderId}-${entry.sno}`}>
              <TableCell className="font-medium">{entry.sno}</TableCell>
              <TableCell className="whitespace-nowrap">
                {format(new Date(entry.date), 'MMM d, yyyy')}
                <br />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(entry.date), 'h:mm a')}
                </span>
              </TableCell>
              <TableCell className="max-w-[120px] truncate">
                {!compact ? (
                  <button
                    className="text-left underline decoration-dotted hover:text-primary transition-colors"
                    onClick={() => openDrillDown('customer', entry.customerName, entry.customerEmail)}
                  >
                    {entry.customerName}
                  </button>
                ) : entry.customerName}
              </TableCell>
              <TableCell className="max-w-[120px] truncate">{entry.productName}</TableCell>
              <TableCell>
                {entry.isPromoterSale ? (
                  !compact ? (
                    <button
                      className="text-left underline decoration-dotted hover:text-primary transition-colors text-sm"
                      onClick={() => openDrillDown('promoter', entry.promoterName, entry.promoterId!)}
                    >
                      {entry.promoterName}
                    </button>
                  ) : (
                    <span className="text-sm">{entry.promoterName}</span>
                  )
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="max-w-[100px] truncate">
                {!compact ? (
                  <button
                    className="text-left underline decoration-dotted hover:text-primary transition-colors"
                    onClick={() => openDrillDown('vendor', entry.vendorName, entry.vendorId || entry.vendorName)}
                  >
                    {entry.vendorName}
                  </button>
                ) : entry.vendorName}
              </TableCell>
              <TableCell>
                <Badge variant={entry.isPromoterSale ? 'default' : 'secondary'} className="text-xs">
                  {entry.isPromoterSale ? 'Promoter' : 'Direct'}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">₹{entry.salesAmount.toLocaleString()}</TableCell>
              <TableCell className="text-right">₹{entry.deliveryCharge.toLocaleString()}</TableCell>
              <TableCell className="text-right">₹{entry.productAmount.toLocaleString()}</TableCell>
              <TableCell className="text-right text-earnings">
                ₹{entry.promoterAmount.toLocaleString()}
                {entry.isPromoterSale && (
                  <span className="text-xs text-muted-foreground ml-1">({entry.promoterCommission}%)</span>
                )}
              </TableCell>
              <TableCell className="text-right">₹{entry.vendorAmount.toLocaleString()}</TableCell>
              <TableCell className="text-right text-surge">
                ₹{entry.tierMargin.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-medium text-primary">
                ₹{entry.profit.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">({entry.platformCommission}%)</span>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 font-bold bg-muted/30">
            <TableCell colSpan={7} className="text-right">TOTALS</TableCell>
            <TableCell className="text-right">₹{totalsData.salesAmount.toLocaleString()}</TableCell>
            <TableCell className="text-right">₹{totalsData.deliveryCharge.toLocaleString()}</TableCell>
            <TableCell className="text-right">₹{totalsData.productAmount.toLocaleString()}</TableCell>
            <TableCell className="text-right text-earnings">₹{totalsData.promoterAmount.toLocaleString()}</TableCell>
            <TableCell className="text-right">₹{totalsData.vendorAmount.toLocaleString()}</TableCell>
            <TableCell className="text-right text-surge">₹{totalsData.tierMargin.toLocaleString()}</TableCell>
            <TableCell className="text-right text-primary">₹{totalsData.profit.toLocaleString()}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Sales</p>
            <p className="text-lg font-bold">₹{totals.salesAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Delivery</p>
            <p className="text-lg font-bold">₹{totals.deliveryCharge.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Product Amt</p>
            <p className="text-lg font-bold">₹{totals.productAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Promoter</p>
            <p className="text-lg font-bold text-earnings">₹{totals.promoterAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vendor</p>
            <p className="text-lg font-bold">₹{totals.vendorAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tier Margin</p>
            <p className="text-lg font-bold text-surge">₹{totals.tierMargin.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Profit</p>
            <p className="text-lg font-bold text-primary">₹{totals.profit.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Sales Accounts
              </CardTitle>
              <CardDescription>Detailed financial breakdown per order — click any name to drill down</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchSalesAccounts} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, product, promoter, vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={saleTypeFilter} onValueChange={setSaleTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Sale Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sales</SelectItem>
                <SelectItem value="promoter">Promoter Sales</SelectItem>
                <SelectItem value="direct">Direct Sales</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To date"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading sales accounts...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales records found</p>
            </div>
          ) : (
            renderTable(filteredEntries, totals)
          )}
        </CardContent>
      </Card>

      {/* Drill-Down Dialog */}
      <Dialog open={!!drillDown} onOpenChange={() => setDrillDown(null)}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drillDown?.type === 'vendor' && '🏪'}
              {drillDown?.type === 'promoter' && '📣'}
              {drillDown?.type === 'customer' && '🛒'}
              {drillDown?.type?.charAt(0).toUpperCase()}{drillDown?.type?.slice(1)} Transactions: {drillDown?.name}
            </DialogTitle>
          </DialogHeader>
          {drillDownEntries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No transactions found</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-lg font-bold">{drillDownEntries.length}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="text-lg font-bold">₹{calcTotals(drillDownEntries).salesAmount.toLocaleString()}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Vendor Amt</p>
                  <p className="text-lg font-bold">₹{calcTotals(drillDownEntries).vendorAmount.toLocaleString()}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className="text-lg font-bold text-primary">₹{calcTotals(drillDownEntries).profit.toLocaleString()}</p>
                </CardContent></Card>
              </div>
              {renderTable(drillDownEntries, calcTotals(drillDownEntries), true)}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
