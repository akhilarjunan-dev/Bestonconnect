import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Users, TrendingUp, DollarSign, CreditCard, ShoppingBag, Download, Eye, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { CEOFinancialDashboard } from './CEOFinancialDashboard';

interface ShopperAccount {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  referred_by_promoter_id: string | null;
  referrer_name: string | null;
  referrer_email: string | null;
  total_purchases: number;
  total_spent: number;
}

interface PromoterAccount {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  promoter_tier: string | null;
  created_at: string;
  total_sales: number;
  total_revenue: number;
  total_commission: number;
  subscription_income: number;
  commission_spent_on_subscription: number;
  profit_via_subscription: number;
  profit_via_product_sale: number;
  total_profit: number;
  registered_customers: number;
}

interface SaleDetail {
  id: string;
  created_at: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_amount: number;
  buyer_email: string;
  status: string;
}

interface OverallStats {
  totalShoppers: number;
  totalPromoters: number;
  totalRevenue: number;
  totalCommissions: number;
  totalSubscriptionIncome: number;
  platformProfit: number;
}

export function AccountsOverview() {
  const [shoppers, setShoppers] = useState<ShopperAccount[]>([]);
  const [promoters, setPromoters] = useState<PromoterAccount[]>([]);
  const [stats, setStats] = useState<OverallStats>({
    totalShoppers: 0,
    totalPromoters: 0,
    totalRevenue: 0,
    totalCommissions: 0,
    totalSubscriptionIncome: 0,
    platformProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPromoter, setSelectedPromoter] = useState<PromoterAccount | null>(null);
  const [promoterSales, setPromoterSales] = useState<SaleDetail[]>([]);
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchShoppers(), fetchPromoters(), fetchOverallStats()]);
    setLoading(false);
  };

  const fetchShoppers = async () => {
    // Get all profiles with buyer role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'buyer');

    if (!roles) return;

    const buyerIds = roles.map(r => r.user_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, created_at, referred_by_promoter_id')
      .in('id', buyerIds);

    if (!profiles) return;

    // Get referrer info
    const referrerIds = profiles.filter(p => p.referred_by_promoter_id).map(p => p.referred_by_promoter_id);
    const { data: referrers } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', referrerIds as string[]);

    // Get purchase data from orders
    const { data: orders } = await supabase
      .from('orders')
      .select('buyer_email, total_amount, status')
      .in('status', ['completed', 'delivered']);

    const shopperAccounts: ShopperAccount[] = profiles.map(profile => {
      const referrer = referrers?.find(r => r.id === profile.referred_by_promoter_id);
      const userOrders = orders?.filter(o => o.buyer_email === profile.email) || [];
      
      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        created_at: profile.created_at,
        referred_by_promoter_id: profile.referred_by_promoter_id,
        referrer_name: referrer?.full_name || null,
        referrer_email: referrer?.email || null,
        total_purchases: userOrders.length,
        total_spent: userOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
      };
    });

    setShoppers(shopperAccounts);
  };

  const fetchPromoters = async () => {
    // Get all promoter user IDs
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'promoter');

    if (!roles) return;

    const promoterIds = roles.map(r => r.user_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, promoter_tier, created_at')
      .in('id', promoterIds);

    if (!profiles) return;

    // Get sales data
    const { data: sales } = await supabase
      .from('sales')
      .select('promoter_id, total_amount, commission_amount, status')
      .in('promoter_id', promoterIds);

    // Get subscription income (referral commissions from subscriptions)
    const { data: earnings } = await supabase
      .from('earnings')
      .select('promoter_id, amount, earning_type, status')
      .in('promoter_id', promoterIds);

    // Get subscriptions purchased by promoters
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('user_id, amount, status')
      .in('user_id', promoterIds);

    // Get registered customers count
    const { data: registeredCustomers } = await supabase
      .from('profiles')
      .select('id, referred_by_promoter_id')
      .in('referred_by_promoter_id', promoterIds);

    const promoterAccounts: PromoterAccount[] = profiles.map(profile => {
      const promoterSales = sales?.filter(s => s.promoter_id === profile.id && s.status === 'completed') || [];
      const promoterEarnings = earnings?.filter(e => e.promoter_id === profile.id) || [];
      const promoterSubscriptions = subscriptions?.filter(s => s.user_id === profile.id && s.status === 'active') || [];
      const customers = registeredCustomers?.filter(c => c.referred_by_promoter_id === profile.id) || [];

      const totalSales = promoterSales.length;
      const totalRevenue = promoterSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
      const totalCommission = promoterSales.reduce((sum, s) => sum + Number(s.commission_amount), 0);
      
      // Subscription income from referrals
      const subscriptionIncome = promoterEarnings
        .filter(e => e.earning_type === 'referral_subscription')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      // Commission spent on own subscription
      const commissionSpentOnSubscription = promoterSubscriptions
        .reduce((sum, s) => sum + Number(s.amount), 0);
      
      const profitViaSubscription = subscriptionIncome - commissionSpentOnSubscription;
      const profitViaProductSale = totalCommission;
      const totalProfit = profitViaSubscription + profitViaProductSale;

      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        promoter_tier: profile.promoter_tier,
        created_at: profile.created_at,
        total_sales: totalSales,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        subscription_income: subscriptionIncome,
        commission_spent_on_subscription: commissionSpentOnSubscription,
        profit_via_subscription: profitViaSubscription,
        profit_via_product_sale: profitViaProductSale,
        total_profit: totalProfit,
        registered_customers: customers.length,
      };
    });

    setPromoters(promoterAccounts);
  };

  const fetchOverallStats = async () => {
    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount, commission_amount, status')
      .eq('status', 'completed');

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('amount, status')
      .eq('status', 'active');

    const { data: buyerRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'buyer');

    const { data: promoterRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'promoter');

    const totalRevenue = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
    const totalCommissions = sales?.reduce((sum, s) => sum + Number(s.commission_amount), 0) || 0;
    const totalSubscriptionIncome = subscriptions?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

    setStats({
      totalShoppers: buyerRoles?.length || 0,
      totalPromoters: promoterRoles?.length || 0,
      totalRevenue,
      totalCommissions,
      totalSubscriptionIncome,
      platformProfit: totalRevenue - totalCommissions + totalSubscriptionIncome,
    });
  };

  const fetchPromoterSales = async (promoterId: string) => {
    const { data: sales } = await supabase
      .from('sales')
      .select('id, created_at, product_id, quantity, unit_price, total_amount, commission_amount, buyer_email, status')
      .eq('promoter_id', promoterId)
      .order('created_at', { ascending: false });

    if (!sales) return;

    // Get product names
    const productIds = [...new Set(sales.map(s => s.product_id))];
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);

    const salesDetails: SaleDetail[] = sales.map(sale => ({
      id: sale.id,
      created_at: sale.created_at,
      product_name: products?.find(p => p.id === sale.product_id)?.name || 'Unknown Product',
      quantity: sale.quantity,
      unit_price: Number(sale.unit_price),
      total_amount: Number(sale.total_amount),
      commission_amount: Number(sale.commission_amount),
      buyer_email: sale.buyer_email || 'N/A',
      status: sale.status,
    }));

    setPromoterSales(salesDetails);
  };

  const handleViewPromoterDetails = async (promoter: PromoterAccount) => {
    setSelectedPromoter(promoter);
    await fetchPromoterSales(promoter.id);
    setSalesDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredShoppers = shoppers.filter(s => 
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.referrer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPromoters = promoters.filter(p => 
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToCSV = (type: 'shoppers' | 'promoters') => {
    let csvContent = '';
    
    if (type === 'shoppers') {
      csvContent = 'Name,Email,Phone,Referred By,Total Purchases,Total Spent,Joined\n';
      filteredShoppers.forEach(s => {
        csvContent += `"${s.full_name || 'N/A'}","${s.email}","${s.phone || 'N/A'}","${s.referrer_name || 'Direct'}",${s.total_purchases},${s.total_spent},"${format(new Date(s.created_at), 'dd/MM/yyyy')}"\n`;
      });
    } else {
      csvContent = 'Name,Email,Phone,Tier,Total Sales,Revenue,Commission,Subscription Income,Subscription Cost,Profit (Sub),Profit (Sales),Total Profit,Customers\n';
      filteredPromoters.forEach(p => {
        csvContent += `"${p.full_name || 'N/A'}","${p.email}","${p.phone || 'N/A'}","${p.promoter_tier || 'free'}",${p.total_sales},${p.total_revenue},${p.total_commission},${p.subscription_income},${p.commission_spent_on_subscription},${p.profit_via_subscription},${p.profit_via_product_sale},${p.total_profit},${p.registered_customers}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type}_accounts_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading accounts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xl font-bold">{stats.totalShoppers}</p>
                <p className="text-xs text-muted-foreground">Shoppers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-earnings" />
              <div>
                <p className="text-xl font-bold">{stats.totalPromoters}</p>
                <p className="text-xs text-muted-foreground">Promoters</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-surge" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-warning" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(stats.totalCommissions)}</p>
                <p className="text-xs text-muted-foreground">Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(stats.totalSubscriptionIncome)}</p>
                <p className="text-xs text-muted-foreground">Subscriptions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-earnings" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(stats.platformProfit)}</p>
                <p className="text-xs text-muted-foreground">Platform Profit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or referrer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs for CEO Dashboard, Shoppers and Promoters */}
      <Tabs defaultValue="ceo-dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ceo-dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            CEO Dashboard
          </TabsTrigger>
          <TabsTrigger value="shoppers">Shoppers ({filteredShoppers.length})</TabsTrigger>
          <TabsTrigger value="promoters">Promoters ({filteredPromoters.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ceo-dashboard">
          <CEOFinancialDashboard />
        </TabsContent>

        <TabsContent value="shoppers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Shopper Accounts</CardTitle>
                <CardDescription>All registered shoppers with their purchase history</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV('shoppers')}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shopper</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Referred By</TableHead>
                      <TableHead>Purchases</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShoppers.map((shopper) => (
                      <TableRow key={shopper.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{shopper.full_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[180px]">{shopper.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{shopper.phone || 'N/A'}</TableCell>
                        <TableCell>
                          {shopper.referrer_name ? (
                            <div>
                              <p className="font-medium text-sm">{shopper.referrer_name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">{shopper.referrer_email}</p>
                            </div>
                          ) : (
                            <Badge variant="outline">Direct</Badge>
                          )}
                        </TableCell>
                        <TableCell>{shopper.total_purchases}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(shopper.total_spent)}</TableCell>
                        <TableCell>{format(new Date(shopper.created_at), 'dd MMM yyyy')}</TableCell>
                      </TableRow>
                    ))}
                    {filteredShoppers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No shoppers found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promoters">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Promoter Accounts</CardTitle>
                <CardDescription>Complete financial overview of all promoters</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV('promoters')}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promoter</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Sales</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Sub. Income</TableHead>
                      <TableHead>Sub. Cost</TableHead>
                      <TableHead>Profit (Sub)</TableHead>
                      <TableHead>Profit (Sales)</TableHead>
                      <TableHead>Total Profit</TableHead>
                      <TableHead>Customers</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromoters.map((promoter) => (
                      <TableRow key={promoter.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{promoter.full_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[150px]">{promoter.email}</p>
                            <p className="text-xs text-muted-foreground">{promoter.phone || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={promoter.promoter_tier === 'premium' ? 'default' : 'secondary'}>
                            {promoter.promoter_tier || 'free'}
                          </Badge>
                        </TableCell>
                        <TableCell>{promoter.total_sales}</TableCell>
                        <TableCell>{formatCurrency(promoter.total_revenue)}</TableCell>
                        <TableCell className="text-earnings">{formatCurrency(promoter.total_commission)}</TableCell>
                        <TableCell>{formatCurrency(promoter.subscription_income)}</TableCell>
                        <TableCell className="text-destructive">{formatCurrency(promoter.commission_spent_on_subscription)}</TableCell>
                        <TableCell className={promoter.profit_via_subscription >= 0 ? 'text-earnings' : 'text-destructive'}>
                          {formatCurrency(promoter.profit_via_subscription)}
                        </TableCell>
                        <TableCell className="text-earnings">{formatCurrency(promoter.profit_via_product_sale)}</TableCell>
                        <TableCell className={`font-bold ${promoter.total_profit >= 0 ? 'text-earnings' : 'text-destructive'}`}>
                          {formatCurrency(promoter.total_profit)}
                        </TableCell>
                        <TableCell>{promoter.registered_customers}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewPromoterDetails(promoter)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPromoters.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                          No promoters found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Promoter Sales Detail Dialog */}
      <Dialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Sales Details - {selectedPromoter?.full_name || selectedPromoter?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary Cards */}
            {selectedPromoter && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    <p className="text-lg font-bold">{selectedPromoter.total_sales}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedPromoter.total_revenue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm text-muted-foreground">Commission Earned</p>
                    <p className="text-lg font-bold text-earnings">{formatCurrency(selectedPromoter.total_commission)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm text-muted-foreground">Registered Customers</p>
                    <p className="text-lg font-bold">{selectedPromoter.registered_customers}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Sales Table */}
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoterSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium max-w-[150px] truncate">{sale.product_name}</TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">{sale.buyer_email}</TableCell>
                      <TableCell>{sale.quantity}</TableCell>
                      <TableCell>{formatCurrency(sale.unit_price)}</TableCell>
                      <TableCell>{formatCurrency(sale.total_amount)}</TableCell>
                      <TableCell className="text-earnings">{formatCurrency(sale.commission_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={sale.status === 'completed' ? 'default' : sale.status === 'refunded' ? 'destructive' : 'secondary'}>
                          {sale.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {promoterSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No sales records found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
