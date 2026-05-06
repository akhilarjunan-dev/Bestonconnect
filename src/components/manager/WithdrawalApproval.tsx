import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createNotification } from '@/hooks/useNotifications';
import { Wallet, CheckCircle, XCircle, Loader2, Copy, Eye, EyeOff, CreditCard, Building2 } from 'lucide-react';

interface BankDetails {
  bank_name?: string;
  account_number?: string;
  ifsc?: string;
}

interface Withdrawal {
  id: string;
  promoter_id: string;
  amount: number;
  status: string;
  created_at: string;
  bank_details: BankDetails | null;
  profiles?: { 
    full_name: string | null; 
    email: string;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
  };
}

export function WithdrawalApproval() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([]);
  
  // Approval dialog state
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; withdrawal: Withdrawal | null }>({
    open: false,
    withdrawal: null
  });
  const [transactionId, setTransactionId] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; withdrawalId: string | null }>({
    open: false,
    withdrawalId: null
  });
  const [rejectReason, setRejectReason] = useState('');
  
  // Bank details dialog
  const [bankDetailsDialog, setBankDetailsDialog] = useState<{ open: boolean; withdrawal: Withdrawal | null }>({
    open: false,
    withdrawal: null
  });

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    setLoading(true);
    
    const { data: withdrawalsData } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (withdrawalsData && withdrawalsData.length > 0) {
      const promoterIds = [...new Set(withdrawalsData.map(w => w.promoter_id))];
      // Use secure RPC - bank details come from withdrawals.bank_details, not profiles
      const { data: allProfiles } = await supabase.rpc('get_profiles_for_manager');
      const profiles = (allProfiles || []).filter((p: any) => promoterIds.includes(p.id));
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const enriched = withdrawalsData.map((w: any) => ({
        ...w,
        bank_details: w.bank_details as BankDetails | null,
        profiles: profileMap.get(w.promoter_id)
      }));
      setWithdrawals(enriched);
    } else {
      setWithdrawals([]);
    }
    
    setLoading(false);
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    const { data } = await supabase
      .from('manager_passwords')
      .select('password_hash')
      .eq('manager_id', user?.id)
      .eq('is_active', true)
      .single();

    if (!data) {
      toast.error('No approval password configured for your account');
      return false;
    }

    // Simple verification (in production use proper bcrypt)
    const hashedInput = btoa(password);
    return hashedInput === data.password_hash;
  };

  const handleApproveWithdrawal = async () => {
    if (!approvalDialog.withdrawal || !transactionId.trim() || !approvalPassword.trim()) {
      toast.error('Please enter transaction ID and password');
      return;
    }

    setActionLoading(approvalDialog.withdrawal.id);

    // Verify password
    const isValid = await verifyPassword(approvalPassword);
    if (!isValid) {
      toast.error('Invalid approval password');
      setActionLoading(null);
      return;
    }

    const { error } = await supabase
      .from('withdrawals')
      .update({ 
        status: 'approved', 
        processed_by: user?.id, 
        processed_at: new Date().toISOString(),
        transaction_id: transactionId 
      })
      .eq('id', approvalDialog.withdrawal.id);

    if (error) {
      toast.error('Failed to approve withdrawal');
    } else {
      await createNotification(
        approvalDialog.withdrawal.promoter_id,
        'Withdrawal Approved!',
        `Your withdrawal of ₹${Number(approvalDialog.withdrawal.amount).toFixed(2)} has been approved. Transaction ID: ${transactionId}`,
        'success',
        { withdrawal_id: approvalDialog.withdrawal.id, transaction_id: transactionId }
      );
      toast.success('Withdrawal approved');
      setApprovalDialog({ open: false, withdrawal: null });
      setTransactionId('');
      setApprovalPassword('');
      fetchWithdrawals();
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectDialog.withdrawalId || !rejectReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setActionLoading(rejectDialog.withdrawalId);
    const withdrawal = withdrawals.find(w => w.id === rejectDialog.withdrawalId);

    const { error } = await supabase
      .from('withdrawals')
      .update({ 
        status: 'rejected', 
        processed_by: user?.id, 
        processed_at: new Date().toISOString(),
        rejection_reason: rejectReason 
      })
      .eq('id', rejectDialog.withdrawalId);

    if (error) {
      toast.error('Failed to reject withdrawal');
    } else {
      if (withdrawal) {
        await createNotification(
          withdrawal.promoter_id,
          'Withdrawal Rejected',
          `Your withdrawal of ₹${Number(withdrawal.amount).toFixed(2)} was not approved. Reason: ${rejectReason}`,
          'error',
          { withdrawal_id: rejectDialog.withdrawalId, reason: rejectReason }
        );
      }
      toast.success('Withdrawal rejected');
      setRejectDialog({ open: false, withdrawalId: null });
      setRejectReason('');
      fetchWithdrawals();
    }
    setActionLoading(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getBankDetails = (withdrawal: Withdrawal) => {
    // Prefer profile bank details, fall back to withdrawal bank_details
    const profile = withdrawal.profiles;
    return {
      bankName: profile?.bank_name || withdrawal.bank_details?.bank_name || 'Not provided',
      accountNumber: profile?.bank_account_number || withdrawal.bank_details?.account_number || 'Not provided',
      ifsc: profile?.bank_ifsc || withdrawal.bank_details?.ifsc || 'Not provided'
    };
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading withdrawals...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Pending Withdrawals
          {withdrawals.length > 0 && (
            <Badge variant="destructive" className="ml-1">{withdrawals.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Process promoter withdrawal requests with transaction verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        {withdrawals.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-earnings mx-auto mb-4" />
            <p className="text-muted-foreground">No pending withdrawals to process</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promoter</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Bank Details</TableHead>
                <TableHead className="hidden sm:table-cell">Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => {
                const bankDetails = getBankDetails(withdrawal);
                return (
                  <TableRow key={withdrawal.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{withdrawal.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                          {withdrawal.profiles?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-earnings">
                      ₹{Number(withdrawal.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBankDetailsDialog({ open: true, withdrawal })}
                        className="gap-1"
                      >
                        <Building2 className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {new Date(withdrawal.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setApprovalDialog({ open: true, withdrawal })}
                          disabled={actionLoading === withdrawal.id}
                        >
                          {actionLoading === withdrawal.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-earnings" />
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setRejectDialog({ open: true, withdrawalId: withdrawal.id })}
                        >
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Bank Details Dialog */}
        <Dialog 
          open={bankDetailsDialog.open} 
          onOpenChange={(open) => !open && setBankDetailsDialog({ open: false, withdrawal: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Bank Details
              </DialogTitle>
              <DialogDescription>
                {bankDetailsDialog.withdrawal?.profiles?.full_name}'s bank account details
              </DialogDescription>
            </DialogHeader>
            {bankDetailsDialog.withdrawal && (
              <div className="space-y-4">
                {(() => {
                  const details = getBankDetails(bankDetailsDialog.withdrawal);
                  return (
                    <>
                      <div className="space-y-2">
                        <Label>Bank Name</Label>
                        <div className="flex gap-2">
                          <Input value={details.bankName} readOnly />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => copyToClipboard(details.bankName)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number</Label>
                        <div className="flex gap-2">
                          <Input value={details.accountNumber} readOnly className="font-mono" />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => copyToClipboard(details.accountNumber)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>IFSC Code</Label>
                        <div className="flex gap-2">
                          <Input value={details.ifsc} readOnly className="font-mono" />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => copyToClipboard(details.ifsc)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setBankDetailsDialog({ open: false, withdrawal: null })}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approval Dialog */}
        <Dialog 
          open={approvalDialog.open} 
          onOpenChange={(open) => !open && setApprovalDialog({ open: false, withdrawal: null })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Withdrawal</DialogTitle>
              <DialogDescription>
                Approving ₹{Number(approvalDialog.withdrawal?.amount || 0).toFixed(2)} for{' '}
                {approvalDialog.withdrawal?.profiles?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Transaction ID *</Label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter bank transaction ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Approval Password *</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={approvalPassword}
                    onChange={(e) => setApprovalPassword(e.target.value)}
                    placeholder="Enter your approval password"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password provided by admin for withdrawal approvals
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setApprovalDialog({ open: false, withdrawal: null })}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleApproveWithdrawal}
                disabled={!transactionId.trim() || !approvalPassword.trim() || actionLoading !== null}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog 
          open={rejectDialog.open} 
          onOpenChange={(open) => !open && setRejectDialog({ open: false, withdrawalId: null })}
        >
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
              <Button 
                variant="outline" 
                onClick={() => setRejectDialog({ open: false, withdrawalId: null })}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReject} 
                disabled={!rejectReason.trim() || actionLoading !== null}
              >
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
