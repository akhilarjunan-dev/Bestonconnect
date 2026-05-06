import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, Legend 
} from 'recharts';
import { 
  BarChart3, TrendingUp, DollarSign, 
  Calendar, CalendarDays, CalendarRange 
} from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface TierEarningsChartProps {
  userId: string;
  className?: string;
}

interface DailySalesTier {
  id: string;
  tier_name: string;
  min_sales: number;
  max_sales: number | null;
  commission_percent: number;
}

interface ChartDataPoint {
  label: string;
  earnings: number;
  sales: number;
  tier: string;
  tierPercent: number;
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

export function TierEarningsChart({ userId, className }: TierEarningsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [tiers, setTiers] = useState<DailySalesTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ earnings: 0, sales: 0 });

  useEffect(() => {
    fetchTiers();
  }, []);

  useEffect(() => {
    if (tiers.length > 0) {
      fetchData();
    }
  }, [userId, timeRange, tiers]);

  const fetchTiers = async () => {
    const { data, error } = await supabase
      .from('daily_sales_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_sales', { ascending: true });

    if (!error && data) {
      setTiers(data);
    }
  };

  const getTierForSalesCount = (salesCount: number): DailySalesTier | null => {
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i];
      if (salesCount >= tier.min_sales && 
          (tier.max_sales === null || salesCount <= tier.max_sales)) {
        return tier;
      }
    }
    return tiers[0] || null;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    let startDate: Date;
    let groupBy: 'day' | 'week' | 'month';

    switch (timeRange) {
      case 'daily':
        startDate = subDays(now, 7);
        groupBy = 'day';
        break;
      case 'weekly':
        startDate = subDays(now, 28);
        groupBy = 'week';
        break;
      case 'monthly':
        startDate = subDays(now, 365);
        groupBy = 'month';
        break;
    }

    // Fetch earnings data
    const { data: earnings, error } = await supabase
      .from('earnings')
      .select('amount, sale_date, created_at')
      .eq('promoter_id', userId)
      .gte('sale_date', startDate.toISOString().split('T')[0])
      .order('sale_date', { ascending: true });

    if (error) {
      console.error('Error fetching earnings:', error);
      setLoading(false);
      return;
    }

    // Process data based on time range
    const processedData: ChartDataPoint[] = [];
    let totalEarnings = 0;
    let totalSales = 0;

    if (groupBy === 'day') {
      const days = eachDayOfInterval({ start: startDate, end: now });
      days.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayEarnings = (earnings || []).filter(e => e.sale_date === dayStr);
        const salesCount = dayEarnings.length;
        const earningsSum = dayEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
        const tier = getTierForSalesCount(salesCount);
        
        totalEarnings += earningsSum;
        totalSales += salesCount;

        processedData.push({
          label: format(day, 'EEE'),
          earnings: Math.round(earningsSum),
          sales: salesCount,
          tier: tier?.tier_name || 'No Sales',
          tierPercent: tier?.commission_percent || 0,
        });
      });
    } else if (groupBy === 'week') {
      const weeks = eachWeekOfInterval({ start: startDate, end: now });
      weeks.forEach((weekStart, idx) => {
        const weekEnd = idx < weeks.length - 1 ? weeks[idx + 1] : now;
        const weekEarnings = (earnings || []).filter(e => {
          const saleDate = new Date(e.sale_date);
          return saleDate >= weekStart && saleDate < weekEnd;
        });
        const salesCount = weekEarnings.length;
        const earningsSum = weekEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
        
        // For weekly, we calculate average daily tier
        const avgDailySales = Math.round(salesCount / 7);
        const tier = getTierForSalesCount(avgDailySales);
        
        totalEarnings += earningsSum;
        totalSales += salesCount;

        processedData.push({
          label: format(weekStart, 'MMM d'),
          earnings: Math.round(earningsSum),
          sales: salesCount,
          tier: tier?.tier_name || 'Mixed',
          tierPercent: tier?.commission_percent || 0,
        });
      });
    } else {
      // Monthly grouping
      const months: Date[] = [];
      let current = startOfMonth(startDate);
      while (current <= now) {
        months.push(new Date(current));
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
      
      months.forEach((monthStart, idx) => {
        const monthEnd = idx < months.length - 1 
          ? months[idx + 1] 
          : new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const monthEarnings = (earnings || []).filter(e => {
          const saleDate = new Date(e.sale_date);
          return saleDate >= monthStart && saleDate <= monthEnd;
        });
        const salesCount = monthEarnings.length;
        const earningsSum = monthEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
        
        totalEarnings += earningsSum;
        totalSales += salesCount;

        processedData.push({
          label: format(monthStart, 'MMM'),
          earnings: Math.round(earningsSum),
          sales: salesCount,
          tier: salesCount > 0 ? 'Various' : 'No Sales',
          tierPercent: 0,
        });
      });
    }

    setChartData(processedData);
    setTotals({ earnings: totalEarnings, sales: totalSales });
    setLoading(false);
  }, [userId, timeRange, tiers]);

  const getBarColor = (tierPercent: number) => {
    if (tierPercent >= 100) return 'hsl(152 69% 40%)'; // earnings color
    if (tierPercent >= 50) return 'hsl(16 90% 55%)'; // surge color  
    if (tierPercent >= 25) return 'hsl(43 96% 56%)'; // warning color
    return 'hsl(var(--primary))';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          <div className="space-y-1 mt-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Earnings:</span>{' '}
              <span className="font-medium text-earnings">₹{data.earnings.toLocaleString()}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Sales:</span>{' '}
              <span className="font-medium">{data.sales}</span>
            </p>
            {data.tier !== 'Various' && data.tier !== 'Mixed' && (
              <p className="text-sm">
                <span className="text-muted-foreground">Tier:</span>{' '}
                <Badge variant="outline" className="ml-1 text-xs">
                  {data.tier} ({data.tierPercent}%)
                </Badge>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tier Status & Earnings
          </CardTitle>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <TabsList className="grid grid-cols-3 w-auto">
              <TabsTrigger value="daily" className="flex items-center gap-1 px-3">
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Daily</span>
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex items-center gap-1 px-3">
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Weekly</span>
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex items-center gap-1 px-3">
                <CalendarRange className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Monthly</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-earnings/10">
            <DollarSign className="w-5 h-5 text-earnings" />
            <div>
              <p className="text-xs text-muted-foreground">Total Earnings</p>
              <p className="text-lg font-bold text-earnings">₹{totals.earnings.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Sales</p>
              <p className="text-lg font-bold">{totals.sales}</p>
            </div>
          </div>
        </div>

        {/* Tier Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tiers.slice(0, 4).map((tier) => (
            <Badge 
              key={tier.id} 
              variant="outline" 
              className="text-xs"
              style={{ borderColor: getBarColor(tier.commission_percent) }}
            >
              {tier.tier_name}: {tier.commission_percent}%
            </Badge>
          ))}
        </div>

        {/* Bar Chart */}
        <div className="h-[250px]">
          {chartData.every(d => d.earnings === 0) ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No earnings data for this period</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="earnings" 
                  radius={[4, 4, 0, 0]}
                  name="Earnings"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getBarColor(entry.tierPercent)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick Stats Below Chart */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {timeRange === 'daily' && 'Last 7 days'}
              {timeRange === 'weekly' && 'Last 4 weeks'}
              {timeRange === 'monthly' && 'Last 12 months'}
            </span>
            <span className="font-medium">
              Avg: ₹{chartData.length > 0 ? Math.round(totals.earnings / chartData.length).toLocaleString() : 0}/{timeRange === 'daily' ? 'day' : timeRange === 'weekly' ? 'week' : 'month'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
