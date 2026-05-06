import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, RotateCcw, RefreshCw, XCircle, Eye, CheckCircle, Clock, Package, Truck, FileText, Copy, ExternalLink, DollarSign, CreditCard, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  request_type: 'return' | 'replacement' | 'cancellation';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'refunded';
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
  shipping_label_url: string | null;
  return_tracking_number: string | null;
  return_carrier: string | null;
  return_tracking_url: string | null;
  pickup_scheduled_at: string | null;
  refund_amount?: number | null;
  refund_transaction_id?: string | null;
  refund_method?: string | null;
  refund_processed_at?: string | null;
  order?: {
    id: string;
    total_amount: number;
    product?: {
      name: string;
    };
  };
  profile?: {
    full_name: string;
    email: string;
  };
}

export function ReturnRequestsManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Shipping fields
  const [shippingLabelUrl, setShippingLabelUrl] = useState('');
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('');
  const [returnCarrier, setReturnCarrier] = useState('');
  const [returnTrackingUrl, setReturnTrackingUrl] = useState('');
  const [dialogTab, setDialogTab] = useState('details');
  
  // Refund fields
  const [refundAmount, setRefundAmount] = useState('');
  const [refundTransactionId, setRefundTransactionId] = useState('');
  const [refundMethod, setRefundMethod] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('return_requests')
      .select(`
        *,
        order:orders(id, total_amount, product:products(name))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load return requests');
      setRequests([]);
    } else {
      // Fetch profiles separately
      const requestsWithProfiles: ReturnRequest[] = [];
      for (const req of data || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', req.user_id)
          .maybeSingle();
        
        requestsWithProfiles.push({
          ...req,
          profile: profile || undefined
        } as ReturnRequest);
      }
      setRequests(requestsWithProfiles);
    }
    setLoading(false);
  };

  const sendStatusNotification = async (request: ReturnRequest, status: string) => {
    const statusMessages: Record<string, { title: string; message: string }> = {
      approved: {
        title: `${request.request_type.charAt(0).toUpperCase() + request.request_type.slice(1)} Request Approved`,
        message: `Your ${request.request_type} request for order #${request.order_id.slice(0, 8)} has been approved. ${request.request_type === 'return' ? 'Please check for return shipping details.' : 'We will process your request shortly.'}`
      },
      rejected: {
        title: `${request.request_type.charAt(0).toUpperCase() + request.request_type.slice(1)} Request Rejected`,
        message: `Your ${request.request_type} request for order #${request.order_id.slice(0, 8)} has been rejected. ${adminNotes ? `Reason: ${adminNotes}` : 'Please contact support for more details.'}`
      },
      processing: {
        title: `${request.request_type.charAt(0).toUpperCase() + request.request_type.slice(1)} In Progress`,
        message: `Your ${request.request_type} request for order #${request.order_id.slice(0, 8)} is now being processed.`
      },
      completed: {
        title: `${request.request_type.charAt(0).toUpperCase() + request.request_type.slice(1)} Completed`,
        message: `Your ${request.request_type} request for order #${request.order_id.slice(0, 8)} has been completed successfully.`
      },
      refunded: {
        title: 'Refund Processed',
        message: `Your refund for order #${request.order_id.slice(0, 8)} has been processed. The amount will be credited to your account within 5-7 business days.`
      }
    };

    const notification = statusMessages[status];
    if (notification) {
      await supabase.from('notifications').insert({
        user_id: request.user_id,
        title: notification.title,
        message: notification.message,
        type: status === 'rejected' ? 'warning' : 'info'
      });
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest || !newStatus) return;

    setUpdating(true);
    const { error } = await supabase
      .from('return_requests')
      .update({
        status: newStatus,
        admin_notes: adminNotes || null,
        processed_by: user?.id,
        processed_at: new Date().toISOString(),
        shipping_label_url: shippingLabelUrl || null,
        return_tracking_number: returnTrackingNumber || null,
        return_carrier: returnCarrier || null,
        return_tracking_url: returnTrackingUrl || null
      })
      .eq('id', selectedRequest.id);

    if (error) {
      console.error('Error updating request:', error);
      toast.error('Failed to update request');
    } else {
      // Send notification if status changed
      if (newStatus !== selectedRequest.status) {
        await sendStatusNotification(selectedRequest, newStatus);
      }
      
      toast.success('Request updated successfully');
      setDialogOpen(false);
      resetDialogState();
      fetchRequests();
    }
    setUpdating(false);
  };

  const resetDialogState = () => {
    setSelectedRequest(null);
    setAdminNotes('');
    setNewStatus('');
    setShippingLabelUrl('');
    setReturnTrackingNumber('');
    setReturnCarrier('');
    setReturnTrackingUrl('');
    setRefundAmount('');
    setRefundTransactionId('');
    setRefundMethod('');
    setDialogTab('details');
  };

  const openRequestDialog = (request: ReturnRequest) => {
    setSelectedRequest(request);
    setNewStatus(request.status);
    setAdminNotes(request.admin_notes || '');
    setShippingLabelUrl(request.shipping_label_url || '');
    setReturnTrackingNumber(request.return_tracking_number || '');
    setReturnCarrier(request.return_carrier || '');
    setReturnTrackingUrl(request.return_tracking_url || '');
    setRefundAmount(request.refund_amount?.toString() || request.order?.total_amount?.toString() || '');
    setRefundTransactionId(request.refund_transaction_id || '');
    setRefundMethod(request.refund_method || '');
    setDialogTab('details');
    setDialogOpen(true);
  };

  const handleProcessRefund = async () => {
    if (!selectedRequest || !refundAmount || !refundMethod) {
      toast.error('Please fill in refund amount and method');
      return;
    }

    setProcessingRefund(true);
    
    const { error } = await supabase
      .from('return_requests')
      .update({
        status: 'refunded',
        refund_amount: parseFloat(refundAmount),
        refund_transaction_id: refundTransactionId || null,
        refund_method: refundMethod,
        refund_processed_at: new Date().toISOString(),
        processed_by: user?.id,
        processed_at: new Date().toISOString(),
        admin_notes: adminNotes ? `${adminNotes}\n\nRefund processed: ₹${refundAmount} via ${refundMethod}` : `Refund processed: ₹${refundAmount} via ${refundMethod}`
      })
      .eq('id', selectedRequest.id);

    if (error) {
      console.error('Error processing refund:', error);
      toast.error('Failed to process refund');
    } else {
      // Send refund notification
      await sendStatusNotification(selectedRequest, 'refunded');
      
      toast.success('Refund processed successfully');
      setDialogOpen(false);
      resetDialogState();
      fetchRequests();
    }
    setProcessingRefund(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'return': return <RotateCcw className="h-4 w-4" />;
      case 'replacement': return <RefreshCw className="h-4 w-4" />;
      case 'cancellation': return <XCircle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'approved':
      case 'completed': return 'default';
      case 'refunded': return 'default';
      case 'processing': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      case 'refunded': return <IndianRupee className="h-3 w-3" />;
      case 'processing': return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'rejected': return <XCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const filteredRequests = statusFilter === 'all' 
    ? requests 
    : requests.filter(r => r.status === statusFilter);

  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    processing: requests.filter(r => r.status === 'processing').length,
    completed: requests.filter(r => r.status === 'completed').length,
    refunded: requests.filter(r => r.status === 'refunded').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Return & Replacement Requests
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="gap-1"
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <Badge variant="secondary" className="ml-1">{count}</Badge>
            </Button>
          ))}
        </div>

        {/* Requests Table */}
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No requests found
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(request.request_type)}
                        <span className="capitalize">{request.request_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{request.order?.product?.name || 'N/A'}</p>
                        <p className="text-muted-foreground">
                          ₹{request.order?.total_amount || 'N/A'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{request.profile?.full_name || 'N/A'}</p>
                        <p className="text-muted-foreground text-xs">{request.profile?.email || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(request.status)} className="gap-1">
                        {getStatusIcon(request.status)}
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), 'PP')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRequestDialog(request)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Request Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialogState();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedRequest && getTypeIcon(selectedRequest.request_type)}
                {selectedRequest?.request_type.charAt(0).toUpperCase() + (selectedRequest?.request_type.slice(1) || '')} Request
              </DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <Tabs value={dialogTab} onValueChange={setDialogTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="shipping" disabled={selectedRequest.request_type === 'cancellation'}>
                    <Truck className="h-4 w-4 mr-2" />
                    Shipping
                  </TabsTrigger>
                  <TabsTrigger value="refund" disabled={selectedRequest.request_type === 'replacement'}>
                    <IndianRupee className="h-4 w-4 mr-2" />
                    Refund
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Order</p>
                      <p className="font-medium">{selectedRequest.order?.product?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium">₹{selectedRequest.order?.total_amount || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <p className="font-medium">{selectedRequest.profile?.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Submitted</p>
                      <p className="font-medium">{format(new Date(selectedRequest.created_at), 'PPp')}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Reason</p>
                    <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.reason}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Update Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Admin Notes</Label>
                    <Textarea
                      placeholder="Add notes about this request..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="shipping" className="space-y-4 mt-4">
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-sm font-medium flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" />
                      Return Shipping Label
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="label-url">Shipping Label URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="label-url"
                            placeholder="https://example.com/shipping-label.pdf"
                            value={shippingLabelUrl}
                            onChange={(e) => setShippingLabelUrl(e.target.value)}
                          />
                          {shippingLabelUrl && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(shippingLabelUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Upload label to storage and paste URL, or use carrier's label URL
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-sm font-medium flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4" />
                      Return Tracking Information
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="carrier">Carrier</Label>
                        <Select value={returnCarrier} onValueChange={setReturnCarrier}>
                          <SelectTrigger id="carrier">
                            <SelectValue placeholder="Select carrier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BlueDart">BlueDart</SelectItem>
                            <SelectItem value="DTDC">DTDC</SelectItem>
                            <SelectItem value="Delhivery">Delhivery</SelectItem>
                            <SelectItem value="Ekart">Ekart</SelectItem>
                            <SelectItem value="India Post">India Post</SelectItem>
                            <SelectItem value="FedEx">FedEx</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tracking-number">Tracking Number</Label>
                        <div className="flex gap-2">
                          <Input
                            id="tracking-number"
                            placeholder="Enter tracking number"
                            value={returnTrackingNumber}
                            onChange={(e) => setReturnTrackingNumber(e.target.value)}
                          />
                          {returnTrackingNumber && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(returnTrackingNumber, 'Tracking number')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="tracking-url">Tracking URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="tracking-url"
                          placeholder="https://carrier.com/track/..."
                          value={returnTrackingUrl}
                          onChange={(e) => setReturnTrackingUrl(e.target.value)}
                        />
                        {returnTrackingUrl && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => window.open(returnTrackingUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedRequest.return_tracking_number && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium">Current Return Shipping</p>
                      <div className="mt-2 text-sm">
                        <p><span className="text-muted-foreground">Carrier:</span> {selectedRequest.return_carrier}</p>
                        <p><span className="text-muted-foreground">Tracking:</span> {selectedRequest.return_tracking_number}</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="refund" className="space-y-4 mt-4">
                  {selectedRequest.refund_processed_at ? (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium mb-3">
                        <CheckCircle className="h-5 w-5" />
                        Refund Already Processed
                      </div>
                      <div className="grid gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">₹{selectedRequest.refund_amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Method:</span>
                          <span>{selectedRequest.refund_method}</span>
                        </div>
                        {selectedRequest.refund_transaction_id && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Transaction ID:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{selectedRequest.refund_transaction_id}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(selectedRequest.refund_transaction_id!, 'Transaction ID')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Processed At:</span>
                          <span>{format(new Date(selectedRequest.refund_processed_at), 'PPp')}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-muted/50 rounded-lg border">
                        <p className="text-sm font-medium flex items-center gap-2 mb-3">
                          <CreditCard className="h-4 w-4" />
                          Process Refund
                        </p>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="refund-amount">Refund Amount (₹)</Label>
                            <div className="relative">
                              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="refund-amount"
                                type="number"
                                placeholder="0.00"
                                className="pl-9"
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(e.target.value)}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Original order amount: ₹{selectedRequest.order?.total_amount || 'N/A'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="refund-method">Refund Method</Label>
                            <Select value={refundMethod} onValueChange={setRefundMethod}>
                              <SelectTrigger id="refund-method">
                                <SelectValue placeholder="Select refund method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="original_payment">Original Payment Method</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer (NEFT/IMPS)</SelectItem>
                                <SelectItem value="upi">UPI</SelectItem>
                                <SelectItem value="store_credit">Store Credit</SelectItem>
                                <SelectItem value="wallet">Wallet</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="refund-txn">Transaction ID (Optional)</Label>
                            <Input
                              id="refund-txn"
                              placeholder="Enter refund transaction ID"
                              value={refundTransactionId}
                              onChange={(e) => setRefundTransactionId(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Add transaction ID after processing refund in payment gateway
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button 
                        onClick={handleProcessRefund} 
                        disabled={processingRefund || !refundAmount || !refundMethod}
                        className="w-full"
                      >
                        {processingRefund && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <IndianRupee className="h-4 w-4 mr-2" />
                        Process Refund of ₹{refundAmount || '0'}
                      </Button>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateStatus} disabled={updating}>
                {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
