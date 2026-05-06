import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown, 
  CreditCard, ShoppingBag, Users, DollarSign, CalendarIcon, 
  Download, RefreshCw, PiggyBank, Banknote, Receipt
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

interface FinancialSummary {
  totalInflow: number;
  totalOutflow: number;
  netProfit: number;
  productSalesInflow: number;
  subscriptionInflow: number;
  commissionsOutflow: number;
  withdrawalsOutflow: number;
  pendingWithdrawals: number;
  refundsOutflow: number;
}

interface TransactionRecord {
  id: string;
  date: string;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  amount: number;
  status: string;
}

interface DailyMetric {
  date: string;
  inflow: number;
  outflow: number;
  netProfit: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--earnings))', 'hsl(var(--surge))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

export function CEOFinancialDashboard() {
  const [summary, setSummary] = useState<FinancialSummary>({
    totalInflow: 0,
    totalOutflow: 0,
    netProfit: 0,
    productSalesInflow: 0,
    subscriptionInflow: 0,
    commissionsOutflow: 0,
    withdrawalsOutflow: 0,
    pendingWithdrawals: 0,
    refundsOutflow: 0,
  });
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    fetchFinancialData();
  }, [dateRange]);

  const fetchFinancialData = async () => {
    setLoading(true);
    const fromDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const toDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : format(endOfMonth(new Date()), 'yyyy-MM-dd');

    // Fetch all sales (product revenue)
    const { data: sales } = await supabase
      .from('sales')
      .select('id, created_at, total_amount, commission_amount, status, buyer_email, product_id')
      .gte('created_at', fromDate)
      .lte('created_at', toDate + 'T23:59:59');

    // Fetch subscriptions (subscription revenue)
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('id, created_at, amount, status, user_id')
      .gte('created_at', fromDate)
      .lte('created_at', toDate + 'T23:59:59');

    // Fetch withdrawals (outflow)
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('id, created_at, amount, status, promoter_id');

    // Fetch orders for refund data
    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_at, total_amount, status')
      .eq('status', 'cancelled')
      .gte('created_at', fromDate)
      .lte('created_at', toDate + 'T23:59:59');

    // Fetch product names for transactions
    const productIds = [...new Set(sales?.map(s => s.product_id) || [])];
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);

    // Calculate summary
    const completedSales = sales?.filter(s => s.status === 'completed') || [];
    const refundedSales = sales?.filter(s => s.status === 'refunded') || [];
    const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];
    const approvedWithdrawals = withdrawals?.filter(w => w.status === 'approved') || [];
    const pendingWithdrawals = withdrawals?.filter(w => w.status === 'pending') || [];

    const productSalesInflow = completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const subscriptionInflow = activeSubscriptions.reduce((sum, s) => sum + Number(s.amount), 0);
    const commissionsOutflow = completedSales.reduce((sum, s) => sum + Number(s.commission_amount), 0);
    const withdrawalsOutflow = approvedWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
    const refundsOutflow = refundedSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const pendingWithdrawalsAmount = pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);

    const totalInflow = productSalesInflow + subscriptionInflow;
    const totalOutflow = commissionsOutflow + withdrawalsOutflow + refundsOutflow;
    const netProfit = totalInflow - totalOutflow;

    setSummary({
      totalInflow,
      totalOutflow,
      netProfit,
      productSalesInflow,
      subscriptionInflow,
      commissionsOutflow,
      withdrawalsOutflow,
      pendingWithdrawals: pendingWithdrawalsAmount,
      refundsOutflow,
    });

    // Build transaction records
    const allTransactions: TransactionRecord[] = [];

    completedSales.forEach(sale => {
      const productName = products?.find(p => p.id === sale.product_id)?.name || 'Product';
      allTransactions.push({
        id: sale.id,
        date: sale.created_at,
        type: 'inflow',
        category: 'Product Sale',
        description: `Sale: ${productName} to ${sale.buyer_email}`,
        amount: Number(sale.total_amount),
        status: 'completed',
      });
      allTransactions.push({
        id: `comm-${sale.id}`,
        date: sale.created_at,
        type: 'outflow',
        category: 'Commission',
        description: `Commission for ${productName}`,
        amount: Number(sale.commission_amount),
        status: 'completed',
      });
    });

    activeSubscriptions.forEach(sub => {
      allTransactions.push({
        id: sub.id,
        date: sub.created_at,
        type: 'inflow',
        category: 'Subscription',
        description: 'Premium subscription payment',
        amount: Number(sub.amount),
        status: 'active',
      });
    });

    approvedWithdrawals.forEach(w => {
      allTransactions.push({
        id: w.id,
        date: w.created_at,
        type: 'outflow',
        category: 'Withdrawal',
        description: 'Promoter withdrawal payout',
        amount: Number(w.amount),
        status: 'approved',
      });
    });

    refundedSales.forEach(sale => {
      allTransactions.push({
        id: `refund-${sale.id}`,
        date: sale.created_at,
        type: 'outflow',
        category: 'Refund',
        description: `Refund for ${sale.buyer_email}`,
        amount: Number(sale.total_amount),
        status: 'refunded',
      });
    });

    // Sort by date descending
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(allTransactions);

    // Calculate daily metrics
    const dailyMap = new Map<string, { inflow: number; outflow: number }>();
    
    allTransactions.forEach(t => {
      const day = format(new Date(t.date), 'yyyy-MM-dd');
      const existing = dailyMap.get(day) || { inflow: 0, outflow: 0 };
      if (t.type === 'inflow') {
        existing.inflow += t.amount;
      } else {
        existing.outflow += t.amount;
      }
      dailyMap.set(day, existing);
    });

    const dailyData: DailyMetric[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date: format(new Date(date), 'dd MMM'),
        inflow: data.inflow,
        outflow: data.outflow,
        netProfit: data.inflow - data.outflow,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setDailyMetrics(dailyData);
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const inflowBreakdown = [
    { name: 'Product Sales', value: summary.productSalesInflow, color: 'hsl(var(--primary))' },
    { name: 'Subscriptions', value: summary.subscriptionInflow, color: 'hsl(var(--earnings))' },
  ].filter(item => item.value > 0);

  const outflowBreakdown = [
    { name: 'Commissions', value: summary.commissionsOutflow, color: 'hsl(var(--warning))' },
    { name: 'Withdrawals', value: summary.withdrawalsOutflow, color: 'hsl(var(--surge))' },
    { name: 'Refunds', value: summary.refundsOutflow, color: 'hsl(var(--destructive))' },
  ].filter(item => item.value > 0);

  const exportToCsv = () => {
    let csv = 'Date,Type,Category,Description,Amount,Status\n';
    transactions.forEach(t => {
      csv += `"${format(new Date(t.date), 'dd/MM/yyyy HH:mm')}","${t.type}","${t.category}","${t.description}",${t.amount},"${t.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Financial Overview</h2>
          <p className="text-muted-foreground">Complete inflow and outflow tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'LLL dd')} - {format(dateRange.to, 'LLL dd, y')}
                    </>
                  ) : (
                    format(dateRange.from, 'LLL dd, y')
                  )
                ) : (
                  'Pick a date range'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={fetchFinancialData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-earnings">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Inflow</p>
                <p className="text-3xl font-bold text-earnings">{formatCurrency(summary.totalInflow)}</p>
              </div>
              <div className="p-3 bg-earnings/10 rounded-full">
                <ArrowUpRight className="h-6 w-6 text-earnings" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Outflow</p>
                <p className="text-3xl font-bold text-destructive">{formatCurrency(summary.totalOutflow)}</p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-full">
                <ArrowDownRight className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${summary.netProfit >= 0 ? 'border-l-primary' : 'border-l-destructive'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-3xl font-bold ${summary.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(summary.netProfit)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${summary.netProfit >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                <PiggyBank className={`h-6 w-6 ${summary.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold">{formatCurrency(summary.productSalesInflow)}</p>
                <p className="text-xs text-muted-foreground">Product Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-earnings" />
              <div>
                <p className="text-lg font-bold">{formatCurrency(summary.subscriptionInflow)}</p>
                <p className="text-xs text-muted-foreground">Subscriptions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-warning" />
              <div>
                <p className="text-lg font-bold text-warning">{formatCurrency(summary.commissionsOutflow)}</p>
                <p className="text-xs text-muted-foreground">Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-surge" />
              <div>
                <p className="text-lg font-bold text-surge">{formatCurrency(summary.withdrawalsOutflow)}</p>
                <p className="text-xs text-muted-foreground">Withdrawals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{formatCurrency(summary.pendingWithdrawals)}</p>
                <p className="text-xs text-muted-foreground">Pending Payouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-lg font-bold text-destructive">{formatCurrency(summary.refundsOutflow)}</p>
                <p className="text-xs text-muted-foreground">Refunds</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
            <CardDescription>Daily inflow vs outflow</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Area type="monotone" dataKey="inflow" stackId="1" stroke="hsl(var(--earnings))" fill="hsl(var(--earnings))" fillOpacity={0.3} name="Inflow" />
                <Area type="monotone" dataKey="outflow" stackId="2" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.3} name="Outflow" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Breakdown Charts */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Inflow Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={inflowBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {inflowBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs">
                {inflowBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Outflow Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={outflowBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {outflowBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs flex-wrap">
                {outflowBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
          <CardDescription>Complete record of all financial transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({transactions.length})</TabsTrigger>
              <TabsTrigger value="inflow">Inflow ({transactions.filter(t => t.type === 'inflow').length})</TabsTrigger>
              <TabsTrigger value="outflow">Outflow ({transactions.filter(t => t.type === 'outflow').length})</TabsTrigger>
            </TabsList>

            {['all', 'inflow', 'outflow'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions
                        .filter(t => tab === 'all' || t.type === tab)
                        .map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="text-sm">
                              {format(new Date(transaction.date), 'dd MMM yyyy HH:mm')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={transaction.type === 'inflow' ? 'default' : 'destructive'}>
                                {transaction.type === 'inflow' ? (
                                  <ArrowUpRight className="h-3 w-3 mr-1" />
                                ) : (
                                  <ArrowDownRight className="h-3 w-3 mr-1" />
                                )}
                                {transaction.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{transaction.category}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate text-sm">
                              {transaction.description}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${transaction.type === 'inflow' ? 'text-earnings' : 'text-destructive'}`}>
                              {transaction.type === 'inflow' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{transaction.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      {transactions.filter(t => tab === 'all' || t.type === tab).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
