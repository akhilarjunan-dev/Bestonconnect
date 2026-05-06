import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { NavItem } from '@/components/dashboard/DashboardSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { createNotification } from '@/hooks/useNotifications';
import { SalesLeaderboard } from '@/components/manager/SalesLeaderboard';
import { PromoterFollowups } from '@/components/manager/PromoterFollowups';
import { FinancialOverview } from '@/components/manager/FinancialOverview';
import { VideoModeration } from '@/components/admin/VideoModeration';
import { OrderManagement } from '@/components/admin/OrderManagement';
import { ReturnRequestsManagement } from '@/components/admin/ReturnRequestsManagement';
import { SupportManagement } from '@/components/admin/SupportManagement';
import { NotificationManagement } from '@/components/admin/NotificationManagement';
import { WithdrawalApproval } from '@/components/manager/WithdrawalApproval';
import { PromoterAssignment } from '@/components/manager/PromoterAssignment';
import { 
  Shield, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  Loader2,
  Wallet,
  Trophy,
  Video,
  Bell,
  BarChart3,
  CheckCheck,
  UserPlus,
  Truck,
  RotateCcw,
  Headphones,
  Send
} from 'lucide-react';

interface Earning {
  id: string;
  promoter_id: string;
  amount: number;
  base_amount: number;
  surge_multiplier: number;
  status: string;
  sale_date: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
}

interface Withdrawal {
  id: string;
  promoter_id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
}

interface Stats {
  pendingEarnings: number;
  pendingWithdrawals: number;
  totalApproved: number;
  activePromoters: number;
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { user, loading, hasRole } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingEarnings: 0, pendingWithdrawals: 0, totalApproved: 0, activePromoters: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedItem, setSelectedItem] = useState<{ type: 'earning' | 'withdrawal'; id: string } | null>(null);
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([]);
  const [selectedEarnings, setSelectedEarnings] = useState<string[]>([]);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkEarningsRejectOpen, setBulkEarningsRejectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('approvals');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && !hasRole('manager') && !hasRole('admin')) {
      toast({ title: 'Access Denied', description: 'You need manager or admin role to access this page.', variant: 'destructive' });
      navigate('/');
    }
  }, [user, loading, hasRole, navigate]);

  useEffect(() => {
    if (user && (hasRole('manager') || hasRole('admin'))) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setDataLoading(true);
    
    const { data: earningsData } = await supabase
      .from('earnings')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data: withdrawalsData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (earningsData && earningsData.length > 0) {
      const promoterIds = [...new Set(earningsData.map(e => e.promoter_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', promoterIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      earningsData.forEach((e: any) => {
        e.profiles = profileMap.get(e.promoter_id);
      });
    }

    if (withdrawalsData && withdrawalsData.length > 0) {
      const promoterIds = [...new Set(withdrawalsData.map(w => w.promoter_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', promoterIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      withdrawalsData.forEach((w: any) => {
        w.profiles = profileMap.get(w.promoter_id);
      });
    }

    const { count: pendingEarningsCount } = await supabase
      .from('earnings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: pendingWithdrawalsCount } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { data: approvedData } = await supabase
      .from('earnings')
      .select('amount')
      .eq('status', 'approved');

    const totalApproved = approvedData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    const { count: promoterCount } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'promoter');

    setEarnings(earningsData || []);
    setWithdrawals(withdrawalsData || []);
    setStats({
      pendingEarnings: pendingEarningsCount || 0,
      pendingWithdrawals: pendingWithdrawalsCount || 0,
      totalApproved,
      activePromoters: promoterCount || 0,
    });
    setDataLoading(false);
  };

  const handleApproveEarning = async (id: string) => {
    setActionLoading(id);
    const earning = earnings.find(e => e.id === id);
    
    const { error } = await supabase
      .from('earnings')
      .update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to approve earning.', variant: 'destructive' });
    } else {
      if (earning) {
        await createNotification(
          earning.promoter_id,
          'Earning Approved!',
          `Your earning of $${Number(earning.amount).toFixed(2)} has been approved and added to your wallet.`,
          'success',
          { earning_id: id, amount: earning.amount }
        );
      }
      toast({ title: 'Approved', description: 'Earning has been approved.' });
      fetchData();
    }
    setActionLoading(null);
  };

  const handleApproveWithdrawal = async (id: string) => {
    setActionLoading(id);
    const withdrawal = withdrawals.find(w => w.id === id);
    
    const { error } = await supabase
      .from('withdrawals')
      .update({ status: 'approved', processed_by: user?.id, processed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to approve withdrawal.', variant: 'destructive' });
    } else {
      if (withdrawal) {
        await createNotification(
          withdrawal.promoter_id,
          'Withdrawal Approved!',
          `Your withdrawal request of $${Number(withdrawal.amount).toFixed(2)} has been approved and will be processed shortly.`,
          'success',
          { withdrawal_id: id, amount: withdrawal.amount }
        );
      }
      toast({ title: 'Approved', description: 'Withdrawal has been approved.' });
      fetchData();
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!selectedItem || !rejectReason.trim()) return;
    
    setActionLoading(selectedItem.id);
    
    if (selectedItem.type === 'earning') {
      const earning = earnings.find(e => e.id === selectedItem.id);
      await supabase
        .from('earnings')
        .update({ status: 'rejected', approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq('id', selectedItem.id);
      
      if (earning) {
        await createNotification(
          earning.promoter_id,
          'Earning Rejected',
          `Your earning of $${Number(earning.amount).toFixed(2)} was not approved. Reason: ${rejectReason}`,
          'error',
          { earning_id: selectedItem.id, reason: rejectReason }
        );
      }
    } else {
      const withdrawal = withdrawals.find(w => w.id === selectedItem.id);
      await supabase
        .from('withdrawals')
        .update({ status: 'rejected', processed_by: user?.id, processed_at: new Date().toISOString(), rejection_reason: rejectReason })
        .eq('id', selectedItem.id);
      
      if (withdrawal) {
        await createNotification(
          withdrawal.promoter_id,
          'Withdrawal Rejected',
          `Your withdrawal request of $${Number(withdrawal.amount).toFixed(2)} was not approved. Reason: ${rejectReason}`,
          'error',
          { withdrawal_id: selectedItem.id, reason: rejectReason }
        );
      }
    }

    toast({ title: 'Rejected', description: `${selectedItem.type === 'earning' ? 'Earning' : 'Withdrawal'} has been rejected.` });
    setSelectedItem(null);
    setRejectReason('');
    fetchData();
    setActionLoading(null);
  };

  const handleSelectAllWithdrawals = (checked: boolean) => {
    if (checked) {
      setSelectedWithdrawals(withdrawals.map(w => w.id));
    } else {
      setSelectedWithdrawals([]);
    }
  };

  const handleSelectWithdrawal = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedWithdrawals(prev => [...prev, id]);
    } else {
      setSelectedWithdrawals(prev => prev.filter(wId => wId !== id));
    }
  };

  const handleBulkApproveWithdrawals = async () => {
    if (selectedWithdrawals.length === 0) return;
    
    setBulkLoading(true);
    
    for (const id of selectedWithdrawals) {
      const withdrawal = withdrawals.find(w => w.id === id);
      
      await supabase
        .from('withdrawals')
        .update({ status: 'approved', processed_by: user?.id, processed_at: new Date().toISOString() })
        .eq('id', id);
      
      if (withdrawal) {
        await createNotification(
          withdrawal.promoter_id,
          'Withdrawal Approved!',
          `Your withdrawal request of $${Number(withdrawal.amount).toFixed(2)} has been approved.`,
          'success',
          { withdrawal_id: id, amount: withdrawal.amount }
        );
      }
    }
    
    toast({ title: 'Bulk Approved', description: `${selectedWithdrawals.length} withdrawals approved.` });
    setSelectedWithdrawals([]);
    fetchData();
    setBulkLoading(false);
  };

  const handleBulkRejectWithdrawals = async () => {
    if (selectedWithdrawals.length === 0 || !rejectReason.trim()) return;
    
    setBulkLoading(true);
    
    for (const id of selectedWithdrawals) {
      const withdrawal = withdrawals.find(w => w.id === id);
      
      await supabase
        .from('withdrawals')
        .update({ status: 'rejected', processed_by: user?.id, processed_at: new Date().toISOString(), rejection_reason: rejectReason })
        .eq('id', id);
      
      if (withdrawal) {
        await createNotification(
          withdrawal.promoter_id,
          'Withdrawal Rejected',
          `Your withdrawal request of $${Number(withdrawal.amount).toFixed(2)} was not approved. Reason: ${rejectReason}`,
          'error',
          { withdrawal_id: id, reason: rejectReason }
        );
      }
    }
    
    toast({ title: 'Bulk Rejected', description: `${selectedWithdrawals.length} withdrawals rejected.` });
    setSelectedWithdrawals([]);
    setRejectReason('');
    setBulkRejectOpen(false);
    fetchData();
    setBulkLoading(false);
  };

  const handleSelectAllEarnings = (checked: boolean) => {
    if (checked) {
      setSelectedEarnings(earnings.map(e => e.id));
    } else {
      setSelectedEarnings([]);
    }
  };

  const handleSelectEarning = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedEarnings(prev => [...prev, id]);
    } else {
      setSelectedEarnings(prev => prev.filter(eId => eId !== id));
    }
  };

  const handleBulkApproveEarnings = async () => {
    if (selectedEarnings.length === 0) return;
    
    setBulkLoading(true);
    
    for (const id of selectedEarnings) {
      const earning = earnings.find(e => e.id === id);
      
      await supabase
        .from('earnings')
        .update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq('id', id);
      
      if (earning) {
        await createNotification(
          earning.promoter_id,
          'Earning Approved!',
          `Your earning of $${Number(earning.amount).toFixed(2)} has been approved and added to your wallet.`,
          'success',
          { earning_id: id, amount: earning.amount }
        );
      }
    }
    
    toast({ title: 'Bulk Approved', description: `${selectedEarnings.length} earnings approved.` });
    setSelectedEarnings([]);
    fetchData();
    setBulkLoading(false);
  };

  const handleBulkRejectEarnings = async () => {
    if (selectedEarnings.length === 0 || !rejectReason.trim()) return;
    
    setBulkLoading(true);
    
    for (const id of selectedEarnings) {
      const earning = earnings.find(e => e.id === id);
      
      await supabase
        .from('earnings')
        .update({ status: 'rejected', approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq('id', id);
      
      if (earning) {
        await createNotification(
          earning.promoter_id,
          'Earning Rejected',
          `Your earning of $${Number(earning.amount).toFixed(2)} was not approved. Reason: ${rejectReason}`,
          'error',
          { earning_id: id, reason: rejectReason }
        );
      }
    }
    
    toast({ title: 'Bulk Rejected', description: `${selectedEarnings.length} earnings rejected.` });
    setSelectedEarnings([]);
    setRejectReason('');
    setBulkEarningsRejectOpen(false);
    fetchData();
    setBulkLoading(false);
  };

  const navItems: NavItem[] = [
    { id: 'approvals', label: 'Commission History', icon: Clock, badge: stats.pendingEarnings > 0 ? stats.pendingEarnings : undefined },
    { id: 'withdrawals', label: 'Withdrawals', icon: Wallet, badge: stats.pendingWithdrawals },
    { id: 'orders', label: 'Orders', icon: Truck },
    { id: 'returns', label: 'Return Requests', icon: RotateCcw },
    { id: 'support', label: 'Customer Support', icon: Headphones },
    { id: 'notifications', label: 'Send Notifications', icon: Send },
    { id: 'assignments', label: 'Assign Promoters', icon: UserPlus },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'followups', label: 'Follow-ups', icon: Bell },
    { id: 'financial', label: 'Financial', icon: BarChart3 },
  ];

  if (loading || dataLoading) {
    return (
      <DashboardLayout
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Manager Dashboard"
        titleIcon={Shield}
        subtitle="Review & approve"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Manager Dashboard"
      titleIcon={Shield}
      subtitle="Review & approve"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingEarnings}</p>
              <p className="text-sm text-muted-foreground">Pending Earnings</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
              <Wallet className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingWithdrawals}</p>
              <p className="text-sm text-muted-foreground">Pending Withdrawals</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-earnings/10">
              <DollarSign className="w-5 h-5 text-earnings" />
            </div>
            <div>
              <p className="text-2xl font-bold">${stats.totalApproved.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Approved</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activePromoters}</p>
              <p className="text-sm text-muted-foreground">Active Promoters</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {/* Earnings Section */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Commission History
                    {stats.pendingEarnings > 0 && (
                      <Badge variant="secondary" className="ml-1">{stats.pendingEarnings} to review</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Commissions are auto-approved. Only decline if fraud is detected.
                  </CardDescription>
                </div>
                {selectedEarnings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedEarnings.length} selected
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkApproveEarnings}
                      disabled={bulkLoading}
                    >
                      {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCheck className="w-4 h-4 mr-1" />}
                      Approve All
                    </Button>
                    <Dialog open={bulkEarningsRejectOpen} onOpenChange={setBulkEarningsRejectOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={bulkLoading}>
                          <XCircle className="w-4 h-4 mr-1 text-destructive" />
                          Reject All
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Bulk Reject Earnings</DialogTitle>
                          <DialogDescription>
                            Reject {selectedEarnings.length} selected earnings. Please provide a reason.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Reason for rejection..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <DialogFooter>
                          <Button 
                            variant="destructive" 
                            onClick={handleBulkRejectEarnings} 
                            disabled={!rejectReason.trim() || bulkLoading}
                          >
                            {bulkLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                            Reject {selectedEarnings.length} Earnings
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {earnings.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-earnings mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending earnings to review</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedEarnings.length === earnings.length && earnings.length > 0}
                          onCheckedChange={handleSelectAllEarnings}
                        />
                      </TableHead>
                      <TableHead>Promoter</TableHead>
                      <TableHead className="hidden sm:table-cell">Base</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="hidden md:table-cell">Sale Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((earning) => (
                      <TableRow key={earning.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedEarnings.includes(earning.id)}
                            onCheckedChange={(checked) => handleSelectEarning(earning.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{earning.profiles?.full_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[150px]">{earning.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">₹{Number(earning.base_amount).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold text-earnings">
                          ₹{Number(earning.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{new Date(earning.sale_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleApproveEarning(earning.id)}
                              disabled={actionLoading === earning.id}
                            >
                              {actionLoading === earning.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-earnings" />
                              )}
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedItem({ type: 'earning', id: earning.id })}
                                >
                                  <XCircle className="w-4 h-4 text-destructive" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Earning</DialogTitle>
                                  <DialogDescription>
                                    Please provide a reason for rejection.
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Reason for rejection..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <DialogFooter>
                                  <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
                                    Reject
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Withdrawals Section */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Pending Withdrawals
                    {stats.pendingWithdrawals > 0 && (
                      <Badge variant="destructive" className="ml-1">{stats.pendingWithdrawals}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Process promoter withdrawal requests</CardDescription>
                </div>
                {selectedWithdrawals.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedWithdrawals.length} selected
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkApproveWithdrawals}
                      disabled={bulkLoading}
                    >
                      {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCheck className="w-4 h-4 mr-1" />}
                      Approve All
                    </Button>
                    <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={bulkLoading}>
                          <XCircle className="w-4 h-4 mr-1 text-destructive" />
                          Reject All
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Bulk Reject Withdrawals</DialogTitle>
                          <DialogDescription>
                            Reject {selectedWithdrawals.length} selected withdrawals. Please provide a reason.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Reason for rejection..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <DialogFooter>
                          <Button 
                            variant="destructive" 
                            onClick={handleBulkRejectWithdrawals} 
                            disabled={!rejectReason.trim() || bulkLoading}
                          >
                            {bulkLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                            Reject {selectedWithdrawals.length} Withdrawals
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {withdrawals.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-earnings mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending withdrawals to process</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedWithdrawals.length === withdrawals.length && withdrawals.length > 0}
                          onCheckedChange={handleSelectAllWithdrawals}
                        />
                      </TableHead>
                      <TableHead>Promoter</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden sm:table-cell">Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedWithdrawals.includes(withdrawal.id)}
                            onCheckedChange={(checked) => handleSelectWithdrawal(withdrawal.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{withdrawal.profiles?.full_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[150px]">{withdrawal.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-earnings">
                          ${Number(withdrawal.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{new Date(withdrawal.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleApproveWithdrawal(withdrawal.id)}
                              disabled={actionLoading === withdrawal.id}
                            >
                              {actionLoading === withdrawal.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-earnings" />
                              )}
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedItem({ type: 'withdrawal', id: withdrawal.id })}
                                >
                                  <XCircle className="w-4 h-4 text-destructive" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Withdrawal</DialogTitle>
                                  <DialogDescription>
                                    Please provide a reason for rejection.
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Reason for rejection..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <DialogFooter>
                                  <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
                                    Reject
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeTab === 'withdrawals' && <WithdrawalApproval />}

      {/* Orders Tab */}
      {activeTab === 'orders' && <OrderManagement />}

      {/* Return Requests Tab */}
      {activeTab === 'returns' && <ReturnRequestsManagement />}

      {/* Customer Support Tab */}
      {activeTab === 'support' && <SupportManagement />}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && <NotificationManagement />}

      {/* Promoter Assignments Tab */}
      {activeTab === 'assignments' && <PromoterAssignment />}

      {/* Videos Tab */}
      {activeTab === 'videos' && <VideoModeration />}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && <SalesLeaderboard />}

      {/* Follow-ups Tab */}
      {activeTab === 'followups' && <PromoterFollowups />}

      {/* Financial Tab */}
      {activeTab === 'financial' && <FinancialOverview />}
    </DashboardLayout>
  );
}
