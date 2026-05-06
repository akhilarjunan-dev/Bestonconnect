import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { PromoterNavFooter } from '@/components/navigation/PromoterNavFooter';
import { VideoAdUpload } from '@/components/promoter/VideoAdUpload';
import { ShowcaseManagement } from '@/components/showcase/ShowcaseManagement';
import { SubscriptionGate } from '@/components/subscription/SubscriptionGate';
import { SubscriptionManagement } from '@/components/promoter/SubscriptionManagement';
import { PromoterReferralShare } from '@/components/promoter/PromoterReferralShare';
import { RegisteredCustomers } from '@/components/promoter/RegisteredCustomers';
import { WithdrawalRequest } from '@/components/withdrawals/WithdrawalRequest';
import { ProductEarningsBreakdown } from '@/components/earnings/ProductEarningsBreakdown';
import { DailySalesTierProgress } from '@/components/promoter/DailySalesTierProgress';
import { TierEarningsChart } from '@/components/promoter/TierEarningsChart';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wallet, 
  TrendingUp, 
  Target, 
  Clock, 
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Zap,
  Users,
  Link as LinkIcon,
  Crown,
  Banknote,
  Rocket,
  Video,
  Store
} from "lucide-react";
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { cn } from "@/lib/utils";

interface DashboardData {
  profile: {
    full_name: string;
    promoter_tier: string | null;
  };
  earnings: {
    available: number;
    pending: number;
    thisMonth: number;
    lastMonth: number;
    totalLifetime: number;
  };
  stats: {
    dailySales: number;
    totalSales: number;
    activeLinks: number;
    registeredBuyers: number;
  };
  chartData: Array<{ date: string; earnings: number; sales: number }>;
  recentEarnings: Array<{
    id: string;
    amount: number;
    base_amount: number;
    sale_date: string;
    status: string;
  }>;
}

function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  variant = "default" 
}: { 
  title: string; 
  value: string; 
  change?: { value: number; positive: boolean }; 
  icon: React.ElementType;
  variant?: "default" | "earnings" | "surge";
}) {
  const formattedChange = change ? Math.abs(change.value).toFixed(1) : null;
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all hover:shadow-lg",
      variant === "earnings" && "border-earnings/30 bg-earnings/5",
      variant === "surge" && "border-surge/30 bg-surge/5"
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-display">{value}</p>
            {formattedChange && change && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium",
                change.positive ? "text-earnings" : "text-destructive"
              )}>
                {change.positive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {formattedChange}% vs last month
              </div>
            )}
          </div>
          <div className={cn(
            "flex items-center justify-center w-12 h-12 rounded-xl",
            variant === "earnings" ? "bg-earnings/20" : 
            variant === "surge" ? "bg-surge/20" : "bg-muted"
          )}>
            <Icon className={cn(
              "w-6 h-6",
              variant === "earnings" ? "text-earnings" :
              variant === "surge" ? "text-surge" : "text-primary"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EarningsChart({ data, className }: { data: DashboardData['chartData']; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-earnings" />
          Earnings Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(value) => `₹${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Earnings']}
              />
              <Area 
                type="monotone" 
                dataKey="earnings" 
                stroke="hsl(152 69% 40%)" 
                strokeWidth={2}
                fill="url(#earningsGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function MotivationalBanner({ data }: { data: DashboardData }) {
  const { stats, earnings } = data;

  // Daily sales tier motivation
  let message = {
    icon: Rocket,
    text: "Start making sales to unlock higher tiers!",
    subtext: "Every sale brings you closer to higher commission percentages"
  };

  if (stats.dailySales > 0) {
    message = {
      icon: Rocket,
      text: `You've made ${stats.dailySales} sale${stats.dailySales > 1 ? 's' : ''} today! Keep going! 🚀`,
      subtext: `More sales today = higher commission tier!`
    };
  }

  // Milestone motivation
  if (earnings.thisMonth > 0) {
    const nextMilestone = Math.ceil(earnings.thisMonth / 1000) * 1000;
    const toMilestone = nextMilestone - earnings.thisMonth;
    if (toMilestone < 500) {
      message = {
        icon: Target,
        text: `Just ₹${toMilestone.toFixed(0)} to hit ₹${nextMilestone.toLocaleString()} this month! 🎯`,
        subtext: `You're crushing it - ${Math.round((earnings.thisMonth / nextMilestone) * 100)}% there!`
      };
    }
  }

  const Icon = message.icon;

  return (
    <Card className="overflow-hidden border-0">
      <div className="gradient-hero p-[2px] rounded-xl">
        <CardContent className="bg-card rounded-[10px] p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{message.text}</p>
              <p className="text-sm text-muted-foreground">{message.subtext}</p>
            </div>
            <Button className="gradient-hero text-primary-foreground">
              Share Products
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// Generate chart data
function generateChartData(days: number = 14) {
  const data = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      earnings: Math.floor(Math.random() * 500) + 100,
      sales: Math.floor(Math.random() * 15) + 1,
    });
  }
  return data;
}

export default function PromoterDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      fetchDashboardData();
    }
  }, [user, authLoading, navigate]);

  const fetchDashboardData = async () => {
    if (!user) return;

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, promoter_tier')
      .eq('id', user.id)
      .single();

    // Fetch earnings
    const { data: earnings } = await supabase
      .from('earnings')
      .select('*')
      .eq('promoter_id', user.id)
      .order('sale_date', { ascending: false });

    // Fetch active referral links count
    const { count: linksCount } = await supabase
      .from('referral_links')
      .select('*', { count: 'exact', head: true })
      .eq('promoter_id', user.id);

    // Fetch registered buyers count
    const { count: buyersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by_promoter_id', user.id);

    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString();

    const approvedEarnings = (earnings || []).filter(e => e.status === 'approved');
    const pendingEarnings = (earnings || []).filter(e => e.status === 'pending');
    const todayEarnings = (earnings || []).filter(e => e.sale_date === today);
    const thisMonthEarnings = approvedEarnings.filter(e => e.created_at >= thisMonthStart);
    const lastMonthEarnings = approvedEarnings.filter(e => e.created_at >= lastMonthStart && e.created_at <= lastMonthEnd);

    setData({
      profile: {
        full_name: profile?.full_name || user.email?.split('@')[0] || 'Promoter',
        promoter_tier: profile?.promoter_tier,
      },
      earnings: {
        available: approvedEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
        pending: pendingEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
        thisMonth: thisMonthEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
        lastMonth: lastMonthEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
        totalLifetime: approvedEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
      },
      stats: {
        dailySales: todayEarnings.length,
        totalSales: (earnings || []).length,
        activeLinks: linksCount || 0,
        registeredBuyers: buyersCount || 0,
      },
      chartData: generateChartData(14),
      recentEarnings: (earnings || []).slice(0, 5),
    });

    setLoading(false);
  };

  if (authLoading || loading || !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  const monthlyGrowth = data.earnings.lastMonth > 0 
    ? ((data.earnings.thisMonth - data.earnings.lastMonth) / data.earnings.lastMonth) * 100 
    : 0;

  return (
    <Layout>
      {/* Welcome Banner */}
      <section className="border-b border-border bg-gradient-to-r from-secondary to-secondary/80">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-display text-secondary-foreground">
                  Welcome back, {data.profile.full_name}!
                </h1>
                <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30">
                  <Crown className="w-3 h-3" />
                  {data.profile.promoter_tier || 'Free'}
                </Badge>
              </div>
              <p className="text-secondary-foreground/70">
                Sell more today to climb to higher commission tiers!
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container py-8 space-y-6 pb-28">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-2">
            <TabsTrigger value="dashboard" className="flex w-full items-center justify-center gap-2 px-2 text-xs sm:px-3 sm:text-sm">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex w-full items-center justify-center gap-2 px-2 text-xs sm:px-3 sm:text-sm">
              <Users className="w-4 h-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex w-full items-center justify-center gap-2 px-2 text-xs sm:px-3 sm:text-sm">
              <LinkIcon className="w-4 h-4" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex w-full items-center justify-center gap-2 px-2 text-xs sm:px-3 sm:text-sm">
              <Crown className="w-4 h-4" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex w-full items-center justify-center gap-2 px-2 text-xs sm:px-3 sm:text-sm">
              <Banknote className="w-4 h-4" />
              Withdraw
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex w-full items-center justify-center gap-2 px-2 text-xs sm:px-3 sm:text-sm">
              <Video className="w-4 h-4" />
              Video Ads
            </TabsTrigger>
            <TabsTrigger value="showcase" className="flex w-full items-center justify-center gap-2 px-2 text-xs sm:px-3 sm:text-sm">
              <Store className="w-4 h-4" />
              My Shop
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Motivational Banner */}
            <MotivationalBanner data={data} />

            {/* Daily Tier Progress - Main Focus */}
            {user && <DailySalesTierProgress userId={user.id} />}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Available Balance"
                value={`₹${data.earnings.available.toFixed(2)}`}
                icon={Wallet}
                variant="earnings"
                change={{ value: monthlyGrowth, positive: monthlyGrowth >= 0 }}
              />
              <StatCard
                title="Pending Earnings"
                value={`₹${data.earnings.pending.toFixed(2)}`}
                icon={Clock}
              />
              <StatCard
                title="This Month"
                value={`₹${data.earnings.thisMonth.toFixed(2)}`}
                icon={TrendingUp}
                change={{ value: monthlyGrowth, positive: monthlyGrowth >= 0 }}
              />
              <StatCard
                title="Lifetime Earnings"
                value={`₹${data.earnings.totalLifetime.toFixed(2)}`}
                icon={Target}
              />
            </div>

            {/* Tier Earnings Chart */}
            {user && <TierEarningsChart userId={user.id} />}

            {/* Earnings Trend Chart */}
            <EarningsChart data={data.chartData} />

            {/* Product Earnings Breakdown */}
            {user && (
              <ProductEarningsBreakdown userId={user.id} />
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display">{data.stats.dailySales}</p>
                    <p className="text-xs text-muted-foreground">Sales Today</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
                    <TrendingUp className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display">{data.stats.totalSales}</p>
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10">
                    <Users className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display">{data.stats.registeredBuyers}</p>
                    <p className="text-xs text-muted-foreground">My Customers</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
                    <LinkIcon className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display">{data.stats.activeLinks}</p>
                    <p className="text-xs text-muted-foreground">Active Links</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Earnings */}
            {data.recentEarnings.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent Earnings</CardTitle>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/promoter/earnings')}>
                    View Report <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.recentEarnings.map((earning) => (
                      <div 
                        key={earning.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-earnings">
                            <Zap className="w-5 h-5 text-earnings-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">Sale on {earning.sale_date}</p>
                            <p className="text-sm text-muted-foreground">
                              Base: ₹{Number(earning.base_amount).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-earnings">+₹{Number(earning.amount).toFixed(2)}</p>
                          <Badge variant={
                            earning.status === 'approved' ? 'default' :
                            earning.status === 'pending' ? 'secondary' : 'destructive'
                          } className="text-xs">
                            {earning.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="referrals">
            <PromoterReferralShare />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionManagement />
          </TabsContent>

          <TabsContent value="withdrawals">
            <WithdrawalRequest />
          </TabsContent>

          <TabsContent value="videos">
            <VideoAdUpload />
          </TabsContent>

          <TabsContent value="customers">
            <RegisteredCustomers />
          </TabsContent>

          <TabsContent value="showcase">
            <ShowcaseManagement ownerType="promoter" />
          </TabsContent>
        </Tabs>
      </div>
      <PromoterNavFooter />
    </Layout>
  );
}
