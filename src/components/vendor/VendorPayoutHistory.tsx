import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Clock, CheckCircle, TrendingUp, Wallet, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  type: 'earning' | 'withdrawal';
  amount: number;
  status: string;
  created_at: string;
  processed_at?: string;
  description?: string;
  transaction_id?: string;
}

interface PayoutSummary {
  totalEarnings: number;
  pendingEarnings: number;
  completedPayouts: number;
  availableBalance: number;
}

export function VendorPayoutHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PayoutSummary>({
    totalEarnings: 0,
    pendingEarnings: 0,
    completedPayouts: 0,
    availableBalance: 0
  });
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user) {
      fetchPayoutHistory();
    }
  }, [user]);

  const fetchPayoutHistory = async () => {
    setLoading(true);

    let allTransactions: Transaction[] = [];

    // Fetch vendor earnings from vendor_earnings table
    const { data: vendorEarnings } = await supabase
      .from('vendor_earnings')
      .select('id, order_id, product_id, total_amount, commission_deducted, net_earning, status, created_at')
      .eq('vendor_id', user?.id)
      .order('created_at', { ascending: false });

    let totalCompletedEarnings = 0;
    let pendingEarnings = 0;

    if (vendorEarnings) {
      // Get product names for display
      const productIds = [...new Set(vendorEarnings.map(e => e.product_id))];
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      const productMap = new Map(products?.map(p => [p.id, p.name]) || []);

      vendorEarnings.forEach(earning => {
        allTransactions.push({
          id: earning.id,
          type: 'earning',
          amount: Number(earning.net_earning),
          status: earning.status,
          created_at: earning.created_at,
          description: `Sale: ${productMap.get(earning.product_id) || 'Product'} (Commission: ₹${Number(earning.commission_deducted).toFixed(2)})`
        });
        if (earning.status === 'completed') {
          totalCompletedEarnings += Number(earning.net_earning);
        } else if (earning.status === 'pending') {
          pendingEarnings += Number(earning.net_earning);
        }
      });
    }

    // Fetch withdrawals
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('promoter_id', user?.id)
      .order('created_at', { ascending: false });

    let completedPayouts = 0;
    let pendingPayouts = 0;

    if (withdrawals) {
      withdrawals.forEach(w => {
        allTransactions.push({
          id: w.id,
          type: 'withdrawal',
          amount: Number(w.amount),
          status: w.status || 'pending',
          created_at: w.created_at,
          processed_at: w.processed_at || undefined,
          transaction_id: w.transaction_id || undefined,
          description: w.rejection_reason || 'Withdrawal request'
        });

        if (w.status === 'approved') {
          completedPayouts += Number(w.amount);
        } else if (w.status === 'pending') {
          pendingPayouts += Number(w.amount);
        }
      });
    }

    // Sort all transactions by date
    allTransactions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setTransactions(allTransactions);
    setSummary({
      totalEarnings: totalCompletedEarnings,
      pendingEarnings,
      completedPayouts,
      availableBalance: Math.max(0, totalCompletedEarnings - completedPayouts - pendingPayouts)
    });
    setLoading(false);
  };

  const getStatusBadge = (status: string, type: 'earning' | 'withdrawal') => {
    if (type === 'earning') {
      if (status === 'completed') return <Badge className="bg-earnings">Completed</Badge>;
      if (status === 'pending') return <Badge variant="secondary">Pending</Badge>;
      if (status === 'refunded') return <Badge variant="destructive">Refunded</Badge>;
      return <Badge variant="secondary">{status}</Badge>;
    } else {
      if (status === 'approved') return <Badge className="bg-earnings">Approved</Badge>;
      if (status === 'pending') return <Badge variant="secondary">Pending</Badge>;
      if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (activeTab === 'all') return true;
    if (activeTab === 'earnings') return t.type === 'earning';
    if (activeTab === 'withdrawals') return t.type === 'withdrawal';
    if (activeTab === 'pending') return t.status === 'pending';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-earnings/30 bg-earnings/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-earnings/20">
              <TrendingUp className="w-5 h-5 text-earnings" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{summary.totalEarnings.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Completed Earnings</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/20">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{summary.pendingEarnings.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Pending Earnings</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/20">
              <CheckCircle className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{summary.completedPayouts.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Withdrawn</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{summary.availableBalance.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Available Balance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription>View all your earnings and payout history</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={`${transaction.type}-${transaction.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(transaction.created_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={transaction.type === 'earning' ? 'default' : 'outline'}>
                          {transaction.type === 'earning' ? 'Earning' : 'Withdrawal'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {transaction.description}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          transaction.type === 'earning' ? 'text-earnings' : 'text-foreground'
                        }`}>
                          {transaction.type === 'earning' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(transaction.status, transaction.type)}
                      </TableCell>
                      <TableCell>
                        {transaction.transaction_id ? (
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {transaction.transaction_id}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
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
    </div>
  );
}
