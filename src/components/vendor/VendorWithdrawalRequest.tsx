import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Wallet, DollarSign, Clock, CheckCircle, XCircle, Banknote, Building2, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
  transaction_id: string | null;
}

interface BankDetails {
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function VendorWithdrawalRequest() {
  const { user } = useAuth();
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: ''
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    
    // Calculate available balance from vendor_earnings table (both pending and completed)
    const { data: vendorEarnings } = await supabase
      .from('vendor_earnings')
      .select('net_earning, status')
      .eq('vendor_id', user.id)
      .in('status', ['pending', 'completed']);

    const totalEarnings = vendorEarnings?.reduce((sum, e) => sum + Number(e.net_earning), 0) || 0;

    // Get withdrawals
    const { data: withdrawalsData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('promoter_id', user.id)
      .order('created_at', { ascending: false });

    const approvedWithdrawals = withdrawalsData?.filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + Number(w.amount), 0) || 0;
    const pending = withdrawalsData?.filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    // Vendor balance = All Earnings - Approved Withdrawals
    const balance = totalEarnings - approvedWithdrawals;

    setAvailableBalance(Math.max(0, balance));
    setPendingWithdrawals(pending);
    setWithdrawals(withdrawalsData || []);

    // Get bank details from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('bank_name, bank_account_number, bank_ifsc')
      .eq('id', user.id)
      .single();

    if (profile) {
      setBankDetails(profile);
      setBankForm({
        bank_name: profile.bank_name || '',
        bank_account_number: profile.bank_account_number || '',
        bank_ifsc: profile.bank_ifsc || ''
      });
    }

    setLoading(false);
  };

  const handleSaveBankDetails = async () => {
    if (!bankForm.bank_name || !bankForm.bank_account_number || !bankForm.bank_ifsc) {
      toast.error('Please fill in all bank details');
      return;
    }

    if (bankForm.bank_ifsc.length !== 11) {
      toast.error('IFSC code must be 11 characters');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        bank_name: bankForm.bank_name,
        bank_account_number: bankForm.bank_account_number,
        bank_ifsc: bankForm.bank_ifsc.toUpperCase()
      })
      .eq('id', user!.id);

    if (error) {
      toast.error('Failed to save bank details');
    } else {
      toast.success('Bank details saved');
      setBankDialogOpen(false);
      fetchData();
    }

    setSubmitting(false);
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
    } else {
      toast.success('Withdrawal request submitted');
      setDialogOpen(false);
      setAmount('');
      fetchData();
    }

    setSubmitting(false);
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
        return <Badge variant="outline" className="text-warning border-warning/50">Pending</Badge>;
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => 
    statusFilter === 'all' || w.status === statusFilter
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bank Details Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5" />
                Bank Details
              </CardTitle>
              <CardDescription>Your linked bank account for withdrawals</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBankDialogOpen(true)}>
              {bankDetails?.bank_account_number ? 'Update' : 'Add'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bankDetails?.bank_account_number ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Bank Name</p>
                <p className="font-medium">{bankDetails.bank_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Account Number</p>
                <p className="font-medium">****{bankDetails.bank_account_number.slice(-4)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">IFSC Code</p>
                <p className="font-medium">{bankDetails.bank_ifsc}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No bank details added yet</p>
          )}
        </CardContent>
      </Card>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-earnings/10">
                <Wallet className="w-6 h-6 text-earnings" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold text-earnings">₹{availableBalance.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-warning/10">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Withdrawal</p>
                <p className="text-2xl font-bold text-warning">₹{pendingWithdrawals.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="flex items-center justify-center">
          <CardContent className="p-4 w-full">
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => {
                if (!bankDetails?.bank_account_number) {
                  setBankDialogOpen(true);
                } else {
                  setDialogOpen(true);
                }
              }}
              disabled={availableBalance <= 0}
            >
              <Banknote className="w-5 h-5 mr-2" />
              Request Withdrawal
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Withdrawal History
              </CardTitle>
              <CardDescription>Track your withdrawal requests</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredWithdrawals.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No withdrawal requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Processed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        {format(new Date(withdrawal.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{Number(withdrawal.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(withdrawal.status)}
                          {getStatusBadge(withdrawal.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {withdrawal.transaction_id || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {withdrawal.processed_at 
                          ? format(new Date(withdrawal.processed_at), 'MMM dd, yyyy')
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank Details Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank Details</DialogTitle>
            <DialogDescription>
              Enter your bank account details for withdrawals
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Bank Name</Label>
              <Input
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                placeholder="e.g., State Bank of India"
              />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input
                value={bankForm.bank_account_number}
                onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })}
                placeholder="Enter account number"
              />
            </div>
            <div>
              <Label>IFSC Code</Label>
              <Input
                value={bankForm.bank_ifsc}
                onChange={(e) => setBankForm({ ...bankForm, bank_ifsc: e.target.value.toUpperCase() })}
                placeholder="e.g., SBIN0001234"
                maxLength={11}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBankDetails} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw. Available: ₹{availableBalance.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                max={availableBalance}
              />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">Withdrawal to:</p>
              <p className="text-muted-foreground">
                {bankDetails?.bank_name} - ****{bankDetails?.bank_account_number?.slice(-4)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
