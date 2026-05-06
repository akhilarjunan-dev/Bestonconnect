import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeEarnings } from '@/hooks/useRealtimeEarnings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  TrendingUp, DollarSign, ShoppingBag, Target, 
  ArrowUpRight, ArrowDownRight, Trophy,
  Clock, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { 
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, subDays, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

interface EarningsData {
  id: string;
  amount: number;
  base_amount: number;
  sale_date: string;
  status: string;
  created_at: string;
  formula_breakdown: unknown;
  earning_type: string | null;
  return_window_ends_at: string | null;
}

interface ChartData {
  date: string;
  earnings: number;
  sales: number;
}

type TimeRange = '7d' | '30d' | '90d' | '12m';

export function EarningsReport() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [chartData, setChartData] = useState<ChartData[]>([]);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
    const days = daysMap[timeRange];
    const startDate = subDays(new Date(), days);

    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .eq('promoter_id', user?.id)
      .gte('sale_date', startDate.toISOString().split('T')[0])
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error fetching earnings:', error);
      setLoading(false);
      return;
    }

    setEarnings(data || []);
    processChartData(data || [], startDate);
    setLoading(false);
  }, [user?.id, timeRange]);

  // Real-time updates
  useRealtimeEarnings({
    userId: user?.id,
    onEarningsChange: fetchEarnings
  });

  useEffect(() => {
    if (user) {
      fetchEarnings();
    }
  }, [user, fetchEarnings]);


  const processChartData = (data: EarningsData[], startDate: Date) => {
    const endDate = new Date();
    let intervals: Date[];
    let formatStr: string;

    if (timeRange === '7d' || timeRange === '30d') {
      intervals = eachDayOfInterval({ start: startDate, end: endDate });
      formatStr = 'MMM d';
    } else if (timeRange === '90d') {
      intervals = eachWeekOfInterval({ start: startDate, end: endDate });
      formatStr = 'MMM d';
    } else {
      intervals = eachMonthOfInterval({ start: startDate, end: endDate });
      formatStr = 'MMM yyyy';
    }

    const chartData = intervals.map(interval => {
      const periodEarnings = data.filter(e => {
        const saleDate = new Date(e.sale_date);
        if (timeRange === '7d' || timeRange === '30d') {
          return saleDate.toDateString() === interval.toDateString();
        } else if (timeRange === '90d') {
          const weekStart = startOfWeek(interval);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          return saleDate >= weekStart && saleDate <= weekEnd;
        } else {
          const monthStart = startOfMonth(interval);
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthEnd.getMonth() + 1);
          return saleDate >= monthStart && saleDate < monthEnd;
        }
      });

      return {
        date: format(interval, formatStr),
        earnings: periodEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
        sales: periodEarnings.length
      };
    });

    setChartData(chartData);
  };

  const stats = {
    totalEarnings: earnings.reduce((sum, e) => sum + Number(e.amount), 0),
    baseEarnings: earnings.reduce((sum, e) => sum + Number(e.base_amount), 0),
    approvedEarnings: earnings.filter(e => e.status === 'approved').reduce((sum, e) => sum + Number(e.amount), 0),
    pendingEarnings: earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0),
    totalSales: earnings.filter(e => e.earning_type === 'direct_sale').length,
    avgPerSale: earnings.length > 0 ? earnings.reduce((sum, e) => sum + Number(e.amount), 0) / earnings.length : 0,
    referralEarnings: earnings.filter(e => e.earning_type?.includes('referral')).reduce((sum, e) => sum + Number(e.amount), 0),
  };

  // Calculate growth
  const midPoint = Math.floor(chartData.length / 2);
  const firstHalf = chartData.slice(0, midPoint).reduce((sum, d) => sum + d.earnings, 0);
  const secondHalf = chartData.slice(midPoint).reduce((sum, d) => sum + d.earnings, 0);
  const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-earnings" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-earnings/20 text-earnings border-earnings/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getEarningTypeBadge = (type: string | null) => {
    switch (type) {
      case 'direct_sale':
        return <Badge variant="outline" className="bg-primary/10 text-primary text-xs">Direct Sale</Badge>;
      case 'sales_referral':
        return <Badge variant="outline" className="bg-info/10 text-info text-xs">Referral Commission</Badge>;
      case 'subscription_referral':
        return <Badge variant="outline" className="bg-surge/10 text-surge text-xs">Subscription Referral</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Commission</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Earnings Report</h2>
          <p className="text-muted-foreground">Track your commission performance</p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-earnings/10">
                <DollarSign className="h-5 w-5 text-earnings" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{stats.totalEarnings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Earnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-surge/10">
                <Target className="h-5 w-5 text-surge" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{Math.round(stats.avgPerSale).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Avg per Sale</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${growth >= 0 ? 'bg-earnings/10' : 'bg-destructive/10'}`}>
                {growth >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-earnings" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <p className={`text-2xl font-bold ${growth >= 0 ? 'text-earnings' : 'text-destructive'}`}>
                  {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Growth</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Commission Breakdown
          </CardTitle>
          <CardDescription>Earnings by type based on daily sales tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">Base Commission</p>
              <p className="text-xl font-bold">₹{Math.round(stats.baseEarnings).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-sm text-muted-foreground">Direct Sales</p>
              <p className="text-xl font-bold text-primary">₹{Math.round(stats.totalEarnings - stats.referralEarnings).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-info/10 text-center">
              <p className="text-sm text-muted-foreground">Referral Earnings</p>
              <p className="text-xl font-bold text-info">₹{Math.round(stats.referralEarnings).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-earnings/10 text-center">
              <p className="text-sm text-muted-foreground">Total Commission</p>
              <p className="text-xl font-bold text-earnings">₹{Math.round(stats.totalEarnings).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border">
            <p className="text-sm text-muted-foreground mb-1">
              <strong>How commission works:</strong>
            </p>
            <p className="text-sm">
              Your commission rate is based on your daily sales tier. The more sales you make each day, 
              the higher your commission percentage. Check the Daily Sales Tier Progress for your current tier.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-earnings/20 bg-earnings/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-xl font-bold text-earnings">₹{stats.approvedEarnings.toLocaleString()}</p>
              </div>
              <Badge variant="default" className="bg-earnings">Ready</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-warning">₹{stats.pendingEarnings.toLocaleString()}</p>
              </div>
              <Badge variant="secondary">Processing</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Earnings Count</p>
                <p className="text-xl font-bold">{earnings.length}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Earnings Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(d => d.earnings === 0) ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No earnings data for this period</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--earnings))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--earnings))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Earnings']}
                />
                <Area 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="hsl(var(--earnings))" 
                  fillOpacity={1} 
                  fill="url(#colorEarnings)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detailed Earnings History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Earnings History
          </CardTitle>
          <CardDescription>Detailed breakdown of each earning</CardDescription>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No earnings for this period</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {earnings.map((earning) => (
                <AccordionItem key={earning.id} value={earning.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(earning.status)}
                        <div className="text-left">
                          <p className="font-medium">₹{Number(earning.amount).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(earning.sale_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getEarningTypeBadge(earning.earning_type)}
                        {getStatusBadge(earning.status)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-0 pb-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Base Amount</p>
                          <p className="font-medium">₹{Number(earning.base_amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Final Amount</p>
                          <p className="font-medium text-earnings">₹{Number(earning.amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Earning Type</p>
                          <p className="font-medium capitalize">{earning.earning_type?.replace(/_/g, ' ') || 'Commission'}</p>
                        </div>
                      </div>

                      {earning.formula_breakdown && typeof earning.formula_breakdown === 'object' && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground mb-2">Details:</p>
                          <div className="text-xs font-mono bg-background p-2 rounded">
                            {(earning.formula_breakdown as any).tier_info && (
                              <p>Tier: {(earning.formula_breakdown as any).tier_info.tierName} ({(earning.formula_breakdown as any).tier_info.commissionPercent}%)</p>
                            )}
                            {(earning.formula_breakdown as any).referral_percent && (
                              <p>Referral Commission: {(earning.formula_breakdown as any).referral_percent}%</p>
                            )}
                          </div>
                        </div>
                      )}

                      {earning.return_window_ends_at && earning.status === 'pending' && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Return window ends: {new Date(earning.return_window_ends_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
