import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { NavItem } from '@/components/dashboard/DashboardSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Store, 
  Package, 
  Boxes, 
  ShoppingBag, 
  DollarSign, 
  Truck, 
  Wallet, 
  Loader2,
  TrendingUp,
  AlertTriangle,
  History,
  MapPin,
  Send,
  Link as LinkIcon,
  ClipboardList,
  FileText
} from 'lucide-react';
import { VendorProductManagement } from '@/components/vendor/VendorProductManagement';
import { VendorInventoryManagement } from '@/components/vendor/VendorInventoryManagement';
import { VendorSalesOverview } from '@/components/vendor/VendorSalesOverview';
import { VendorWithdrawalRequest } from '@/components/vendor/VendorWithdrawalRequest';
import { VendorOrdersManagement } from '@/components/vendor/VendorOrdersManagement';
import { VendorPayoutHistory } from '@/components/vendor/VendorPayoutHistory';
import { VendorPickupProfile } from '@/components/vendor/VendorPickupProfile';
import { VendorShipmentSchedule } from '@/components/vendor/VendorShipmentSchedule';
import { ShowcaseManagement } from '@/components/showcase/ShowcaseManagement';
import { SubscriptionGate } from '@/components/subscription/SubscriptionGate';
import { VendorCustomOrdersManagement } from '@/components/vendor/VendorCustomOrdersManagement';
import { VendorFormBuilderTab } from '@/components/vendor/VendorFormBuilderTab';
import { OrderNotificationListener } from '@/components/admin/OrderNotificationListener';

interface VendorStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  totalSales: number;
  totalRevenue: number;
  pendingOrders: number;
  availableBalance: number;
}

export default function VendorDashboard() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<VendorStats>({
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    totalSales: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    availableBalance: 0
  });
  const [loading, setLoading] = useState(true);

  const [vendorProductIds, setVendorProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || !hasRole('vendor'))) {
      toast.error('Access denied. Vendor role required.');
      navigate('/');
      return;
    }
    if (user && hasRole('vendor')) {
      fetchStats();
    }
  }, [user, authLoading, hasRole, navigate]);

  // Handle tab navigation from notification click
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('navigate-to-tab', handler);
    return () => window.removeEventListener('navigate-to-tab', handler);
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    
    // Fetch vendor's products
    const { data: products } = await supabase
      .from('products')
      .select('id, is_active, stock_quantity')
      .eq('vendor_id', user?.id);

    const productIds = products?.map(p => p.id) || [];
    setVendorProductIds(productIds);
    
    // Fetch vendor earnings
    const { data: vendorEarnings } = await supabase
      .from('vendor_earnings')
      .select('net_earning, status, total_amount')
      .eq('vendor_id', user?.id)
      .in('status', ['pending', 'completed']);

    const totalSales = vendorEarnings?.length || 0;
    const totalRevenue = vendorEarnings?.reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;
    const totalNetEarnings = vendorEarnings?.reduce((sum, e) => sum + Number(e.net_earning), 0) || 0;
    
    // Fetch pending orders
    let pendingOrders = 0;
    if (productIds.length > 0) {
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('product_id', productIds)
        .in('status', ['pending', 'processing']);
      
      pendingOrders = pendingCount || 0;
    }

    // Get withdrawals to calculate available balance
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('amount, status')
      .eq('promoter_id', user?.id);

    const approvedWithdrawals = withdrawals?.filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    const availableBalance = Math.max(0, totalNetEarnings - approvedWithdrawals);

    setStats({
      totalProducts: products?.length || 0,
      activeProducts: products?.filter(p => p.is_active).length || 0,
      lowStockProducts: products?.filter(p => (p.stock_quantity || 0) < 10 && p.stock_quantity !== null).length || 0,
      totalSales,
      totalRevenue,
      pendingOrders,
      availableBalance
    });
    
    setLoading(false);
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Store },
    { id: 'products', label: 'My Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Boxes, badge: stats.lowStockProducts > 0 ? stats.lowStockProducts : undefined },
    { id: 'orders', label: 'Orders', icon: Truck, badge: stats.pendingOrders > 0 ? stats.pendingOrders : undefined },
    { id: 'shipments', label: 'Schedule Pickup', icon: Send, badge: stats.pendingOrders > 0 ? stats.pendingOrders : undefined },
    { id: 'sales', label: 'Sales', icon: ShoppingBag },
    { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
    { id: 'payout-history', label: 'Payout History', icon: History },
    { id: 'pickup-profile', label: 'Delivery Profile', icon: MapPin },
    { id: 'custom-orders', label: 'Custom Orders', icon: ClipboardList },
    { id: 'form-builder', label: 'Form Builder', icon: FileText },
    { id: 'showcase', label: 'My Shop Link', icon: LinkIcon },
  ];

  if (authLoading || loading) {
    return (
      <DashboardLayout
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Vendor Dashboard"
        titleIcon={Store}
        subtitle="Manage your products & sales"
        favoritesKey="vendor-sidebar-favorites"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <SubscriptionGate role="vendor">
    <DashboardLayout
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Vendor Dashboard"
      titleIcon={Store}
      subtitle="Manage your products & sales"
      favoritesKey="vendor-sidebar-favorites"
    >
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <OrderNotificationListener role="vendor" vendorProductIds={vendorProductIds} />
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalProducts}</p>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-earnings/10">
                  <ShoppingBag className="w-5 h-5 text-earnings" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeProducts}</p>
                  <p className="text-sm text-muted-foreground">Active Products</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.lowStockProducts}</p>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
                  <Truck className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-earnings/30 bg-earnings/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    <p className="text-3xl font-bold">{stats.totalSales}</p>
                    <p className="text-sm text-earnings">Completed orders</p>
                  </div>
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-earnings/20">
                    <TrendingUp className="w-7 h-7 text-earnings" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-info/30 bg-info/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-3xl font-bold">₹{stats.totalRevenue.toFixed(2)}</p>
                    <p className="text-sm text-info">Gross revenue</p>
                  </div>
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-info/20">
                    <DollarSign className="w-7 h-7 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-3xl font-bold">₹{stats.availableBalance.toFixed(2)}</p>
                    <p className="text-sm text-primary">Withdrawable</p>
                  </div>
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/20">
                    <Wallet className="w-7 h-7 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <VendorProductManagement onProductChange={fetchStats} />
      )}

      {activeTab === 'inventory' && (
        <VendorInventoryManagement />
      )}

      {activeTab === 'orders' && (
        <VendorOrdersManagement />
      )}

      {activeTab === 'shipments' && (
        <VendorShipmentSchedule />
      )}

      {activeTab === 'sales' && (
        <VendorSalesOverview />
      )}

      {activeTab === 'withdrawals' && (
        <VendorWithdrawalRequest />
      )}

      {activeTab === 'payout-history' && (
        <VendorPayoutHistory />
      )}

      {activeTab === 'pickup-profile' && (
        <VendorPickupProfile />
      )}

      {activeTab === 'custom-orders' && (
        <VendorCustomOrdersManagement />
      )}

      {activeTab === 'form-builder' && (
        <VendorFormBuilderTab />
      )}

      {activeTab === 'showcase' && (
        <ShowcaseManagement ownerType="vendor" />
      )}
    </DashboardLayout>
    </SubscriptionGate>
  );
}
