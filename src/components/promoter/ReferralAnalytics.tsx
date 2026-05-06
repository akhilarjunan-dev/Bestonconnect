import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MousePointerClick, 
  TrendingUp, 
  Target, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Zap,
  Package
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { cn } from '@/lib/utils';

interface ReferralLink {
  id: string;
  product_id: string | null;
  link_code: string;
  clicks: number;
  conversions: number;
  created_at: string;
  products?: {
    name: string;
    price: number;
    commission_rate: number;
    image_urls: string[] | null;
  };
}

interface Sale {
  id: string;
  referral_link_id: string | null;
  total_amount: number;
  commission_amount: number;
  created_at: string;
}

interface ReferralAnalyticsProps {
  userId: string;
  referralLinks: ReferralLink[];
}

const CHART_COLORS = ['hsl(152 69% 40%)', 'hsl(16 90% 55%)', 'hsl(217 91% 60%)', 'hsl(280 65% 60%)', 'hsl(45 93% 47%)'];

export function ReferralAnalytics({ userId, referralLinks }: ReferralAnalyticsProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchSales();
  }, [userId, timeRange]);

  const fetchSales = async () => {
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const { data, error } = await supabase
      .from('sales')
      .select('id, referral_link_id, total_amount, commission_amount, created_at')
      .eq('promoter_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (!error && data) {
      setSales(data);
    }
    setLoading(false);
  };

  // Calculate overall stats
  const totalClicks = referralLinks.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const totalConversions = referralLinks.reduce((sum, l) => sum + (l.conversions || 0), 0);
  const overallCVR = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0.0';
  const totalRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalCommission = sales.reduce((sum, s) => sum + s.commission_amount, 0);

  // Top performing links by conversion rate
  const topPerformingLinks = [...referralLinks]
    .filter(l => l.clicks > 0)
    .map(l => ({
      ...l,
      cvr: (l.conversions / l.clicks) * 100
    }))
    .sort((a, b) => b.cvr - a.cvr)
    .slice(0, 5);

  // Links by clicks (for pie chart)
  const clicksDistribution = referralLinks
    .filter(l => l.clicks > 0)
    .map(l => ({
      name: l.products?.name || 'Unknown',
      value: l.clicks,
      conversions: l.conversions
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Daily performance data
  const dailyData = (() => {
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const dataMap = new Map<string, { clicks: number; conversions: number; revenue: number }>();
    
    // Initialize all days
    for (let i = daysAgo - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dataMap.set(dateKey, { clicks: 0, conversions: 0, revenue: 0 });
    }

    // Fill in sales data
    sales.forEach(sale => {
      const dateKey = sale.created_at.split('T')[0];
      if (dataMap.has(dateKey)) {
        const existing = dataMap.get(dateKey)!;
        existing.conversions += 1;
        existing.revenue += sale.total_amount;
      }
    });

    return Array.from(dataMap.entries()).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ...data
    }));
  })();

  // Conversion funnel data
  const funnelData = [
    { stage: 'Clicks', value: totalClicks, fill: 'hsl(217 91% 60%)' },
    { stage: 'Conversions', value: totalConversions, fill: 'hsl(152 69% 40%)' },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Performance Analytics
        </h2>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="90d">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <MousePointerClick className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Clicks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-earnings/10">
                <TrendingUp className="h-5 w-5 text-earnings" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalConversions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Conversions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-surge/10">
                <Target className="h-5 w-5 text-surge" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallCVR}%</p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{totalCommission.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Commission Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Conversions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversions Over Time</CardTitle>
            <CardDescription>Track your sales performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152 69% 40%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(152 69% 40%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="hsl(152 69% 40%)" 
                    strokeWidth={2}
                    fill="url(#conversionGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Click Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Click Distribution by Product</CardTitle>
            <CardDescription>Where your traffic is going</CardDescription>
          </CardHeader>
          <CardContent>
            {clicksDistribution.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MousePointerClick className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No click data yet</p>
                </div>
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={clicksDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {clicksDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [`${value} clicks`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Legend */}
            <div className="mt-4 space-y-2">
              {clicksDistribution.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="truncate max-w-[150px]">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value} clicks</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            Top Performing Links
          </CardTitle>
          <CardDescription>Ranked by conversion rate</CardDescription>
        </CardHeader>
        <CardContent>
          {topPerformingLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No conversion data yet</p>
              <p className="text-sm">Share your links to start getting conversions!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topPerformingLinks.map((link, idx) => {
                const maxCVR = topPerformingLinks[0]?.cvr || 1;
                return (
                  <div key={link.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        {link.products?.image_urls?.[0] ? (
                          <img
                            src={link.products.image_urls[0]}
                            alt={link.products.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">
                            {link.products?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {link.clicks} clicks • {link.conversions} conversions
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={link.cvr >= 5 ? 'default' : 'secondary'}
                        className={cn(link.cvr >= 10 && "bg-earnings text-earnings-foreground")}
                      >
                        {link.cvr.toFixed(1)}% CVR
                      </Badge>
                    </div>
                    <Progress 
                      value={(link.cvr / maxCVR) * 100} 
                      className="h-2"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion Funnel</CardTitle>
          <CardDescription>From clicks to sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {funnelData.map((stage, idx) => {
              const maxValue = funnelData[0]?.value || 1;
              const percentage = maxValue > 0 ? ((stage.value / maxValue) * 100).toFixed(1) : '0';
              const dropOff = idx > 0 && funnelData[idx - 1].value > 0 
                ? (((funnelData[idx - 1].value - stage.value) / funnelData[idx - 1].value) * 100).toFixed(1)
                : null;
              
              return (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stage.stage}</span>
                      {dropOff && (
                        <Badge variant="outline" className="text-xs text-destructive">
                          <ArrowDownRight className="w-3 h-3 mr-1" />
                          {dropOff}% drop-off
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold">{stage.value.toLocaleString()}</span>
                  </div>
                  <div className="relative">
                    <Progress value={Number(percentage)} className="h-8" />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-primary-foreground">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {totalClicks > 0 && (
            <div className="mt-6 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Insight:</strong> Your overall conversion rate is{' '}
                <span className={cn(
                  "font-semibold",
                  parseFloat(overallCVR) >= 5 ? "text-earnings" : "text-foreground"
                )}>
                  {overallCVR}%
                </span>
                {parseFloat(overallCVR) < 2 && (
                  <span>. Try sharing your links on more targeted platforms to improve conversions.</span>
                )}
                {parseFloat(overallCVR) >= 2 && parseFloat(overallCVR) < 5 && (
                  <span>. Good progress! Consider creating product-specific content to boost conversions.</span>
                )}
                {parseFloat(overallCVR) >= 5 && (
                  <span>. Excellent performance! Keep up the great work!</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
