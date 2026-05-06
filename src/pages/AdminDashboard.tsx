import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { NavItem } from '@/components/dashboard/DashboardSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, Users, UserPlus, Check, X, Crown, User, Package, ShoppingBag, MessageSquare, Truck, Boxes, CreditCard, Tag, Image, Key, Link, FileText, Phone, Clock, Headphones, Bell, RotateCcw, Settings, TrendingUp, Store, Webhook, MapPin, DollarSign, Send, LayoutDashboard, ClipboardList, MessageCircle, Receipt } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ProductManagement } from '@/components/admin/ProductManagement';
import { SalesDashboard } from '@/components/admin/SalesDashboard';
import { ReviewModeration } from '@/components/admin/ReviewModeration';
import { OrderManagement } from '@/components/admin/OrderManagement';
import { InventoryManagement } from '@/components/admin/InventoryManagement';
import { SubscriptionSettings } from '@/components/admin/SubscriptionSettings';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { BannerManagement } from '@/components/admin/BannerManagement';
import { ManagerPasswordManagement } from '@/components/admin/ManagerPasswordManagement';
import { ReferralCommissionSettings } from '@/components/admin/ReferralCommissionSettings';
import { AccountsOverview } from '@/components/admin/AccountsOverview';
import { SupportManagement } from '@/components/admin/SupportManagement';
import { NotificationManagement } from '@/components/admin/NotificationManagement';
import { OrderSettingsManagement } from '@/components/admin/OrderSettingsManagement';
import { ReturnRequestsManagement } from '@/components/admin/ReturnRequestsManagement';
import { DailySalesTierSettings } from '@/components/admin/DailySalesTierSettings';
import { CustomerAccountsManagement } from '@/components/admin/CustomerAccountsManagement';
import { VendorAccountsManagement } from '@/components/admin/VendorAccountsManagement';
import { VendorApplicationsManagement } from '@/components/admin/VendorApplicationsManagement';
import { WebhookEventsMonitor } from '@/components/admin/WebhookEventsMonitor';
import { PaymentSettings } from '@/components/admin/PaymentSettings';
import { DelhiverySettings } from '@/components/admin/DelhiverySettings';
import { RefundTracking } from '@/components/admin/RefundTracking';
import { AdminSchedulePickup } from '@/components/admin/AdminSchedulePickup';
import { HomeSectionManagement } from '@/components/admin/HomeSectionManagement';
import { ShowcasePriceSettings } from '@/components/admin/ShowcasePriceSettings';
import { CustomOrdersManagement } from '@/components/admin/CustomOrdersManagement';
import { EnquiryTracking } from '@/components/admin/EnquiryTracking';
import { OrderNotificationListener } from '@/components/admin/OrderNotificationListener';
import { DeliveryChargeSettings } from '@/components/admin/DeliveryChargeSettings';
import { SalesAccountsDashboard } from '@/components/admin/SalesAccountsDashboard';
type AppRole = 'buyer' | 'promoter' | 'manager' | 'admin' | 'vendor';
type PromoterTier = 'free' | 'premium';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  kyc_status: string | null;
  promoter_tier: PromoterTier | null;
  roles: AppRole[];
}


interface PromoterApplication {
  id: string;
  user_id: string;
  status: string;
  tier: PromoterTier | null;
  reason: string | null;
  created_at: string;
  referred_by_promoter_id: string | null;
  profile?: {
    email: string;
    full_name: string | null;
    kyc_status: string | null;
    phone: string | null;
  };
}

export default function AdminDashboard() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [applications, setApplications] = useState<PromoterApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Notification badge counts
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [pendingVendorApps, setPendingVendorApps] = useState(0);
  const [pendingReturnRequests, setPendingReturnRequests] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);

  // User search filter
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // Application action dialogs
  const [pendingDialogApp, setPendingDialogApp] = useState<PromoterApplication | null>(null);
  const [pendingReason, setPendingReason] = useState('');
  const [rejectDialogApp, setRejectDialogApp] = useState<PromoterApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Application filters
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [appSearchQuery, setAppSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !hasRole('admin'))) {
      navigate('/');
      return;
    }
    if (user && hasRole('admin')) {
      fetchData();
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

  const fetchBadgeCounts = async () => {
    const [ordersRes, vendorAppsRes, returnsRes, reviewsRes] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('vendor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('return_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('product_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setNewOrdersCount(ordersRes.count ?? 0);
    setPendingVendorApps(vendorAppsRes.count ?? 0);
    setPendingReturnRequests(returnsRes.count ?? 0);
    setPendingReviews(reviewsRes.count ?? 0);
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchApplications(), fetchBadgeCounts()]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, created_at, kyc_status, promoter_tier')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast.error('Failed to fetch users');
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast.error('Failed to fetch roles');
      return;
    }

    const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
      ...profile,
      promoter_tier: profile.promoter_tier as PromoterTier | null,
      roles: (roles || [])
        .filter(r => r.user_id === profile.id)
        .map(r => r.role as AppRole)
    }));

    setUsers(usersWithRoles);
  };


  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from('promoter_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch applications');
      return;
    }

    const userIds = (data || []).map(app => app.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, kyc_status, phone')
      .in('id', userIds);

    const appsWithProfiles: PromoterApplication[] = (data || []).map(app => ({
      ...app,
      tier: app.tier as PromoterTier | null,
      referred_by_promoter_id: app.referred_by_promoter_id,
      profile: profiles?.find(p => p.id === app.user_id)
    }));

    setApplications(appsWithProfiles);
  };

  // Filtered applications
  const filteredApplications = applications.filter(app => {
    const matchesStatus = appStatusFilter === 'all' || app.status === appStatusFilter;
    const searchLower = appSearchQuery.toLowerCase();
    const matchesSearch = !appSearchQuery || 
      app.profile?.full_name?.toLowerCase().includes(searchLower) ||
      app.profile?.email?.toLowerCase().includes(searchLower) ||
      app.profile?.phone?.includes(appSearchQuery);
    return matchesStatus && matchesSearch;
  });

  const handleAddRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (error) {
      if (error.code === '23505') {
        toast.error('User already has this role');
      } else {
        toast.error('Failed to add role');
      }
      return;
    }

    toast.success(`Added ${role} role`);
    fetchUsers();
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      toast.error('Failed to remove role');
      return;
    }

    toast.success(`Removed ${role} role`);
    fetchUsers();
  };

  const handleUpdatePromoterTier = async (userId: string, tier: PromoterTier | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ promoter_tier: tier })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update tier');
      return;
    }

    toast.success('Tier updated');
    fetchUsers();
  };

  const handleApproveApplication = async (appId: string, userId: string, tier: PromoterTier, referredByPromoterId: string | null) => {
    const { error: appError } = await supabase
      .from('promoter_applications')
      .update({ 
        status: 'approved', 
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', appId);

    if (appError) {
      toast.error('Failed to approve application');
      return;
    }

    await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: 'promoter' });

    await supabase
      .from('profiles')
      .update({ promoter_tier: tier })
      .eq('id', userId);

    // If this application was referred by another promoter, create the referral relationship
    if (referredByPromoterId) {
      // Check if referral already exists
      const { data: existingReferral } = await supabase
        .from('promoter_referrals')
        .select('id')
        .eq('referred_promoter_id', userId)
        .maybeSingle();

      if (!existingReferral) {
        // Get the referrer's referral code (first 8 chars of their ID)
        const referralCode = referredByPromoterId.substring(0, 8).toUpperCase();
        
        await supabase
          .from('promoter_referrals')
          .insert({
            referred_promoter_id: userId,
            referrer_promoter_id: referredByPromoterId,
            referral_code: referralCode,
            tier_at_referral: tier,
            current_tier: tier
          });
        
        console.log('Created promoter referral relationship:', userId, '->', referredByPromoterId);
      }
    }

    toast.success('Application approved');
    fetchApplications();
    fetchUsers();
  };

  const handleRejectApplication = async (appId: string, reason: string) => {
    const { error } = await supabase
      .from('promoter_applications')
      .update({ 
        status: 'rejected', 
        reason,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', appId);

    if (error) {
      toast.error('Failed to reject application');
      return;
    }

    toast.success('Application rejected');
    fetchApplications();
  };

  const handleMarkPending = async (appId: string, reason: string) => {
    const { error } = await supabase
      .from('promoter_applications')
      .update({
        status: 'pending',
        reason,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', appId);

    if (error) {
      toast.error('Failed to update application');
      return;
    }

    toast.success('Pending reason saved');
    fetchApplications();
  };


  const stats = {
    totalUsers: users.length,
    promoters: users.filter(u => u.roles.includes('promoter')).length,
    managers: users.filter(u => u.roles.includes('manager')).length,
    pendingApps: applications.filter(a => a.status === 'pending').length,
  };

  const navItems: NavItem[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'applications', label: 'Promoter Apps', icon: UserPlus, badge: stats.pendingApps },
    { id: 'vendor-applications', label: 'Vendor Apps', icon: Store, badge: pendingVendorApps },
    { id: 'customer-accounts', label: 'Customer Accounts', icon: User },
    { id: 'vendor-accounts', label: 'Vendor Accounts', icon: Store },
    { id: 'accounts', label: 'Accounts Overview', icon: FileText },
    { id: 'banners', label: 'Banners', icon: Image },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'home-sections', label: 'Home Layout', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: Truck, badge: newOrdersCount },
    { id: 'return-requests', label: 'Return Requests', icon: RotateCcw, badge: pendingReturnRequests },
    { id: 'refund-tracking', label: 'Refund Tracking', icon: DollarSign },
    { id: 'order-settings', label: 'Order Settings', icon: Settings },
    { id: 'delivery-charges', label: 'Delivery Charges', icon: Truck },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'sales', label: 'Sales', icon: ShoppingBag },
    { id: 'sales-accounts', label: 'Sales Accounts', icon: Receipt },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare, badge: pendingReviews },
    { id: 'support', label: 'Customer Support', icon: Headphones },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'daily-tiers', label: 'Daily Sales Tiers', icon: TrendingUp },
    { id: 'referrals', label: 'Referral Settings', icon: Link },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'payment-settings', label: 'Payment Gateway', icon: CreditCard },
    { id: 'schedule-pickup', label: 'Schedule Pickup', icon: Send },
    { id: 'delhivery-settings', label: 'Delhivery Shipping', icon: MapPin },
    { id: 'manager-passwords', label: 'Manager Passwords', icon: Key },
    { id: 'showcase-settings', label: 'Showcase Pricing', icon: Store },
    { id: 'custom-orders', label: 'Custom Orders', icon: ClipboardList },
    { id: 'enquiries', label: 'Enquiry Tracking', icon: MessageCircle },
    { id: 'webhook-events', label: 'Webhook Events', icon: Webhook },
  ];

  if (authLoading || loading) {
    return (
      <DashboardLayout
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Admin Dashboard"
        titleIcon={Shield}
        subtitle="Manage system settings"
        favoritesKey="admin-sidebar-favorites"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }


  // Filtered users
  const filteredUsers = users.filter(u => {
    const searchLower = userSearchQuery.toLowerCase();
    const matchesSearch = !userSearchQuery ||
      u.full_name?.toLowerCase().includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower) ||
      u.phone?.includes(userSearchQuery);
    const matchesRole = userRoleFilter === 'all' || u.roles.includes(userRoleFilter as AppRole);
    return matchesSearch && matchesRole;
  });

  return (
    <DashboardLayout
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Admin Dashboard"
      titleIcon={Shield}
      subtitle="Manage system settings"
      favoritesKey="admin-sidebar-favorites"
    >
      <OrderNotificationListener role="admin" />
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-earnings" />
              <div>
                <p className="text-2xl font-bold">{stats.promoters}</p>
                <p className="text-sm text-muted-foreground">Promoters</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-surge" />
              <div>
                <p className="text-2xl font-bold">{stats.managers}</p>
                <p className="text-sm text-muted-foreground">Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{stats.pendingApps}</p>
                <p className="text-sm text-muted-foreground">Pending Apps</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and promoter tiers</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <Select
                value={userRoleFilter}
                onValueChange={setUserRoleFilter}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="promoter">Promoter</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{u.phone || 'No phone'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map(role => (
                          <Badge 
                            key={role} 
                            variant={role === 'admin' ? 'default' : 'secondary'}
                            className="cursor-pointer"
                            onClick={() => {
                              if (role !== 'buyer' && u.id !== user?.id) {
                                handleRemoveRole(u.id, role);
                              }
                            }}
                          >
                            {role}
                            {role !== 'buyer' && u.id !== user?.id && (
                              <X className="h-3 w-3 ml-1" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.roles.includes('promoter') ? (
                        <Select
                          value={u.promoter_tier || 'free'}
                          onValueChange={(v) => handleUpdatePromoterTier(u.id, v as PromoterTier)}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        u.kyc_status === 'approved' ? 'default' :
                        u.kyc_status === 'pending' ? 'secondary' : 'outline'
                      }>
                        {u.kyc_status || 'Not submitted'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(role) => handleAddRole(u.id, role as AppRole)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="Add role" />
                        </SelectTrigger>
                        <SelectContent>
                          {(['promoter', 'manager', 'admin', 'vendor'] as AppRole[])
                            .filter(r => !u.roles.includes(r))
                            .map(role => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Promoter Applications</CardTitle>
              <CardDescription>Review and approve promoter applications</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={appSearchQuery}
                    onChange={(e) => setAppSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <Select
                  value={appStatusFilter}
                  onValueChange={(v) => setAppStatusFilter(v as 'all' | 'pending' | 'approved' | 'rejected')}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Applications</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                {filteredApplications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No applications found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested Tier</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApplications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{app.profile?.full_name || 'No name'}</p>
                              <p className="text-sm text-muted-foreground">{app.profile?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {app.profile?.phone ? (
                              <a href={`tel:${app.profile.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                                <Phone className="h-3 w-3" />
                                {app.profile.phone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not provided</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              app.status === 'approved' ? 'default' :
                              app.status === 'rejected' ? 'destructive' : 'secondary'
                            }>
                              {app.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={app.tier === 'premium' ? 'default' : 'secondary'}>
                              {app.tier || 'free'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(app.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {app.reason ? (
                              <span className="text-sm text-warning">{app.reason}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {app.status === 'pending' ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveApplication(app.id, app.user_id, app.tier || 'free', app.referred_by_promoter_id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPendingDialogApp(app);
                                    setPendingReason(app.reason || '');
                                  }}
                                >
                                  <Clock className="h-4 w-4 mr-1" />
                                  Pending
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setRejectDialogApp(app);
                                    setRejectReason('');
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Reason Dialog */}
          <Dialog open={!!pendingDialogApp} onOpenChange={(o) => !o && setPendingDialogApp(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark Pending with Reason</DialogTitle>
                <DialogDescription>
                  Add a reason for keeping this application pending. The applicant will see this message.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="pending-reason">Reason</Label>
                  <Textarea
                    id="pending-reason"
                    placeholder="e.g., Please complete your KYC verification first."
                    value={pendingReason}
                    onChange={(e) => setPendingReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPendingDialogApp(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (pendingDialogApp) {
                      handleMarkPending(pendingDialogApp.id, pendingReason);
                      setPendingDialogApp(null);
                    }
                  }}
                >
                  Save Reason
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reject Reason Dialog */}
          <Dialog open={!!rejectDialogApp} onOpenChange={(o) => !o && setRejectDialogApp(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Application</DialogTitle>
                <DialogDescription>
                  Provide a reason for rejecting this application. The applicant will see this message.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="reject-reason">Reason</Label>
                  <Textarea
                    id="reject-reason"
                    placeholder="e.g., Insufficient activity or duplicate account."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectDialogApp(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (rejectDialogApp) {
                      handleRejectApplication(rejectDialogApp.id, rejectReason || 'Application rejected by admin');
                      setRejectDialogApp(null);
                    }
                  }}
                >
                  Reject
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Customer Accounts Tab */}
      {activeTab === 'customer-accounts' && <CustomerAccountsManagement />}

      {/* Vendor Accounts Tab */}
      {activeTab === 'vendor-accounts' && <VendorAccountsManagement />}

      {/* Accounts Overview Tab */}
      {activeTab === 'accounts' && <AccountsOverview />}

      {/* Products Tab */}
      {activeTab === 'products' && <ProductManagement />}

      {/* Categories Tab */}
      {activeTab === 'categories' && <CategoryManagement />}

      {/* Home Sections Tab */}
      {activeTab === 'home-sections' && <HomeSectionManagement />}

      {/* Sales Tab */}
      {activeTab === 'sales' && <SalesDashboard />}

      {/* Sales Accounts Tab */}
      {activeTab === 'sales-accounts' && <SalesAccountsDashboard />}

      {/* Orders Tab */}
      {activeTab === 'orders' && <OrderManagement />}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && <InventoryManagement />}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && <ReviewModeration />}

      {/* Banners Tab */}
      {activeTab === 'banners' && <BannerManagement />}

      {/* Customer Support Tab */}
      {activeTab === 'support' && <SupportManagement />}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && <NotificationManagement />}

      {/* Daily Sales Tiers Tab */}
      {activeTab === 'daily-tiers' && <DailySalesTierSettings />}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && <SubscriptionSettings />}

      {/* Referral Commission Settings Tab */}
      {activeTab === 'referrals' && <ReferralCommissionSettings />}

      {/* Manager Passwords Tab */}
      {activeTab === 'manager-passwords' && <ManagerPasswordManagement />}

      {/* Return Requests Tab */}
      {activeTab === 'return-requests' && <ReturnRequestsManagement />}

      {/* Order Settings Tab */}
      {activeTab === 'order-settings' && <OrderSettingsManagement />}

      {/* Vendor Applications Tab */}
      {activeTab === 'vendor-applications' && <VendorApplicationsManagement />}

      {/* Webhook Events Monitor Tab */}
      {activeTab === 'webhook-events' && <WebhookEventsMonitor />}

      {/* Payment Settings Tab */}
      {activeTab === 'payment-settings' && <PaymentSettings />}

      {/* Delhivery Settings Tab */}
      {activeTab === 'delhivery-settings' && <DelhiverySettings />}

      {/* Refund Tracking Tab */}
      {activeTab === 'refund-tracking' && <RefundTracking />}

      {/* Schedule Pickup Tab */}
      {activeTab === 'schedule-pickup' && <AdminSchedulePickup />}

      {/* Showcase Settings Tab */}
      {activeTab === 'showcase-settings' && <ShowcasePriceSettings />}

      {/* Custom Orders Tab */}
      {activeTab === 'custom-orders' && <CustomOrdersManagement />}

      {/* Enquiry Tracking Tab */}
      {activeTab === 'enquiries' && <EnquiryTracking />}

      {/* Delivery Charge Settings Tab */}
      {activeTab === 'delivery-charges' && <DeliveryChargeSettings />}
    </DashboardLayout>
  );
}
