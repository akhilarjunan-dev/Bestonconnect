import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeEarnings } from '@/hooks/useRealtimeEarnings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Wallet, Banknote, Clock, CheckCircle, XCircle, Loader2, ArrowRight, Building, CreditCard, Edit2, Filter } from 'lucide-react';

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
}

interface BankDetails {
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function WithdrawalRequest() {
  const { user } = useAuth();
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  // Bank details form
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: ''
  });

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Fetch approved earnings (available balance)
    const { data: earnings } = await supabase
      .from('earnings')
      .select('amount')
      .eq('promoter_id', user.id)
      .eq('status', 'approved');

    const totalApproved = (earnings || []).reduce((sum, e) => sum + Number(e.amount), 0);

    // Fetch withdrawals
    const { data: withdrawalData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('promoter_id', user.id)
      .order('created_at', { ascending: false });

    const approvedWithdrawals = (withdrawalData || [])
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + Number(w.amount), 0);

    const pendingAmount = (withdrawalData || [])
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + Number(w.amount), 0);

    setAvailableBalance(totalApproved - approvedWithdrawals - pendingAmount);
    setPendingWithdrawals(pendingAmount);
    setWithdrawals(withdrawalData || []);

    // Fetch bank details
    const { data: profile } = await supabase
      .from('profiles')
      .select('bank_name, bank_account_number, bank_ifsc')
      .eq('id', user.id)
      .single();

    setBankDetails(profile);
    if (profile) {
      setBankForm({
        bank_name: profile.bank_name || '',
        bank_account_number: profile.bank_account_number || '',
        bank_ifsc: profile.bank_ifsc || ''
      });
    }
    setLoading(false);
  }, [user]);

  // Real-time updates
  useRealtimeEarnings({
    userId: user?.id,
    onEarningsChange: fetchData,
    onWithdrawalsChange: fetchData
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);


  const handleSaveBankDetails = async () => {
    if (!bankForm.bank_name.trim() || !bankForm.bank_account_number.trim() || !bankForm.bank_ifsc.trim()) {
      toast.error('Please fill in all bank details');
      return;
    }

    // Basic IFSC validation
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankForm.bank_ifsc.toUpperCase())) {
      toast.error('Please enter a valid IFSC code');
      return;
    }

    setSavingBank(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        bank_name: bankForm.bank_name.trim(),
        bank_account_number: bankForm.bank_account_number.trim(),
        bank_ifsc: bankForm.bank_ifsc.toUpperCase().trim()
      })
      .eq('id', user!.id);

    if (error) {
      toast.error('Failed to save bank details');
      console.error(error);
    } else {
      toast.success('Bank details saved successfully');
      setBankDialogOpen(false);
      fetchData();
    }
    setSavingBank(false);
  };

  const handleRequestWithdrawal = async () => {
    const withdrawAmount = parseFloat(amount);
    
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast.error('Amount exceeds available balance');
      return;
    }

    if (!bankDetails?.bank_account_number || !bankDetails?.bank_ifsc) {
      toast.error('Please add your bank details first');
      setBankDialogOpen(true);
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('withdrawals')
      .insert({
        promoter_id: user!.id,
        amount: withdrawAmount,
        bank_details: {
          bank_name: bankDetails.bank_name,
          bank_account_number: bankDetails.bank_account_number,
          bank_ifsc: bankDetails.bank_ifsc
        }
      });

    if (error) {
      toast.error('Failed to submit withdrawal request');
      console.error(error);
    } else {
      toast.success('Withdrawal request submitted successfully');
      setDialogOpen(false);
      setAmount('');
      fetchData();
    }
    setSubmitting(false);
  };

  const openWithdrawDialog = () => {
    if (!hasBankDetails) {
      setBankDialogOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasBankDetails = bankDetails?.bank_account_number && bankDetails?.bank_ifsc;

  return (
    <div className="space-y-6">
      {/* Bank Details Card */}
      <Card className={!hasBankDetails ? 'border-warning/50 bg-warning/5' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Bank Details</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBankDialogOpen(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              {hasBankDetails ? 'Edit' : 'Add'}
            </Button>
          </div>
          <CardDescription>
            {hasBankDetails 
              ? 'Your bank details for receiving withdrawals'
              : 'Add your bank details to start withdrawing earnings'
            }
          </CardDescription>
        </CardHeader>
        {hasBankDetails && (
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Bank Name</p>
                <p className="font-medium">{bankDetails.bank_name || 'Not specified'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                <p className="font-medium">****{bankDetails.bank_account_number?.slice(-4)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">IFSC Code</p>
                <p className="font-medium">{bankDetails.bank_ifsc}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-earnings/30 bg-earnings/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-earnings/20">
                <Wallet className="w-6 h-6 text-earnings" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available to Withdraw</p>
                <p className="text-2xl font-bold text-earnings">₹{availableBalance.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-warning/20">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Withdrawals</p>
                <p className="text-2xl font-bold">₹{pendingWithdrawals.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <Button 
              className="w-full h-full min-h-[80px] gap-2"
              onClick={openWithdrawDialog}
              disabled={availableBalance <= 0}
            >
              <Banknote className="w-5 h-5" />
              Request Withdrawal
              <ArrowRight className="w-4 h-4" />
            </Button>
            {!hasBankDetails && availableBalance > 0 && (
              <p className="text-xs text-warning mt-2 text-center">
                Add bank details first
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal History with Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Withdrawal History</CardTitle>
              <CardDescription>Track your payout requests</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No withdrawal requests yet
            </p>
          ) : (
            <>
              {/* Status Summary */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setStatusFilter('all')}>
                  All: {withdrawals.length}
                </Badge>
                <Badge 
                  className="bg-warning/20 text-warning border-warning/30 cursor-pointer" 
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending: {withdrawals.filter(w => w.status === 'pending').length}
                </Badge>
                <Badge 
                  className="bg-earnings/20 text-earnings border-earnings/30 cursor-pointer"
                  onClick={() => setStatusFilter('approved')}
                >
                  Approved: {withdrawals.filter(w => w.status === 'approved').length}
                </Badge>
                <Badge 
                  variant="destructive" 
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('rejected')}
                >
                  Rejected: {withdrawals.filter(w => w.status === 'rejected').length}
                </Badge>
              </div>

              {/* Table View */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Processed</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals
                      .filter(w => statusFilter === 'all' || w.status === statusFilter)
                      .map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell className="font-medium">
                            {new Date(withdrawal.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-bold">
                            ₹{Number(withdrawal.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(withdrawal.status)}
                              {getStatusBadge(withdrawal.status)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {withdrawal.processed_at 
                              ? new Date(withdrawal.processed_at).toLocaleDateString()
                              : '—'
                            }
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {withdrawal.rejection_reason ? (
                              <span className="text-sm text-destructive">{withdrawal.rejection_reason}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    {withdrawals.filter(w => statusFilter === 'all' || w.status === statusFilter).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No {statusFilter !== 'all' ? statusFilter : ''} withdrawals found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bank Details Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {hasBankDetails ? 'Update Bank Details' : 'Add Bank Details'}
            </DialogTitle>
            <DialogDescription>
              Enter your bank account details for receiving withdrawals. This information will be saved for future withdrawal requests.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="bank_name"
                  placeholder="e.g., State Bank of India"
                  className="pl-10"
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                placeholder="Enter your account number"
                value={bankForm.bank_account_number}
                onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ifsc">IFSC Code</Label>
              <Input
                id="ifsc"
                placeholder="e.g., SBIN0001234"
                value={bankForm.bank_ifsc}
                onChange={(e) => setBankForm({ ...bankForm, bank_ifsc: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-muted-foreground">
                11-character code (e.g., SBIN0001234)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBankDetails} disabled={savingBank}>
              {savingBank && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Bank Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw to your bank account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-earnings">₹{availableBalance.toFixed(2)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Withdrawal Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max={availableBalance}
              />
            </div>

            {bankDetails && (
              <div className="p-4 rounded-lg border space-y-1">
                <p className="text-sm font-medium">Bank Details</p>
                <p className="text-sm text-muted-foreground">{bankDetails.bank_name || 'Bank not specified'}</p>
                <p className="text-sm text-muted-foreground">
                  A/C: ****{bankDetails.bank_account_number?.slice(-4)}
                </p>
                <p className="text-sm text-muted-foreground">IFSC: {bankDetails.bank_ifsc}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestWithdrawal} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
