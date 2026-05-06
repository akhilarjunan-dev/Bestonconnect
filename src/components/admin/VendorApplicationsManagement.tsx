import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Store, Loader2, Check, X, Clock, Search, Eye, Building, MapPin, FileText } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type VendorApplication = Tables<'vendor_applications'>;

interface VendorApplicationWithProfile extends VendorApplication {
  profile?: {
    email: string;
    full_name: string | null;
    phone: string | null;
  };
}

export function VendorApplicationsManagement() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<VendorApplicationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [viewDialogApp, setViewDialogApp] = useState<VendorApplicationWithProfile | null>(null);
  const [rejectDialogApp, setRejectDialogApp] = useState<VendorApplicationWithProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vendor_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch vendor applications');
      setLoading(false);
      return;
    }

    // Fetch profiles for applicants
    const userIds = (data || []).map(app => app.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone')
      .in('id', userIds);

    const appsWithProfiles: VendorApplicationWithProfile[] = (data || []).map(app => ({
      ...app,
      profile: profiles?.find(p => p.id === app.user_id)
    }));

    setApplications(appsWithProfiles);
    setLoading(false);
  };

  const filteredApplications = applications.filter(app => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      app.business_name.toLowerCase().includes(searchLower) ||
      app.profile?.email?.toLowerCase().includes(searchLower) ||
      app.profile?.full_name?.toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  const handleApprove = async (app: VendorApplicationWithProfile) => {
    setProcessing(true);
    
    // Update application status
    const { error: appError } = await supabase
      .from('vendor_applications')
      .update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', app.id);

    if (appError) {
      toast.error('Failed to approve application');
      setProcessing(false);
      return;
    }

    // Add vendor role to user
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: app.user_id, role: 'vendor' });

    if (roleError && roleError.code !== '23505') { // Ignore if role already exists
      toast.error('Failed to assign vendor role');
      setProcessing(false);
      return;
    }

    toast.success('Vendor application approved!');
    setViewDialogApp(null);
    fetchApplications();
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectDialogApp) return;
    setProcessing(true);

    const { error } = await supabase
      .from('vendor_applications')
      .update({
        status: 'rejected',
        reason: rejectReason || 'Application rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', rejectDialogApp.id);

    if (error) {
      toast.error('Failed to reject application');
      setProcessing(false);
      return;
    }

    toast.success('Vendor application rejected');
    setRejectDialogApp(null);
    setRejectReason('');
    fetchApplications();
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-earnings text-white"><Check className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Applications</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-earnings/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-earnings" />
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <X className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Vendor Applications
          </CardTitle>
          <CardDescription>
            Review and manage vendor registration requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by business name, email, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-40">
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

          {filteredApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No vendor applications found</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>GST Number</TableHead>
                    <TableHead>Applied On</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.business_name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{app.profile?.full_name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">{app.profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{app.gst_number || '-'}</TableCell>
                      <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(app.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewDialogApp(app)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {app.status === 'pending' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(app)}
                                disabled={processing}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setRejectDialogApp(app)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewDialogApp} onOpenChange={() => setViewDialogApp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Vendor Application Details
            </DialogTitle>
          </DialogHeader>
          {viewDialogApp && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(viewDialogApp.status)}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{viewDialogApp.business_name}</p>
                    <p className="text-sm text-muted-foreground">Business Name</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{viewDialogApp.business_description}</p>
                    <p className="text-sm text-muted-foreground mt-1">Business Description</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{viewDialogApp.business_address}</p>
                    <p className="text-sm text-muted-foreground mt-1">Business Address</p>
                  </div>
                </div>
                
                {viewDialogApp.gst_number && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">GST Number</p>
                    <p className="text-sm text-muted-foreground">{viewDialogApp.gst_number}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Applicant Details</p>
                <div className="space-y-1">
                  <p className="font-medium">{viewDialogApp.profile?.full_name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{viewDialogApp.profile?.email}</p>
                  {viewDialogApp.profile?.phone && (
                    <p className="text-sm text-muted-foreground">{viewDialogApp.profile.phone}</p>
                  )}
                </div>
              </div>

              {viewDialogApp.reason && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                  <p className="text-sm">{viewDialogApp.reason}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Applied on {new Date(viewDialogApp.created_at).toLocaleString()}
              </p>
            </div>
          )}
          <DialogFooter>
            {viewDialogApp?.status === 'pending' && (
              <div className="flex gap-2 w-full">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setRejectDialogApp(viewDialogApp);
                    setViewDialogApp(null);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleApprove(viewDialogApp)}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            )}
            {viewDialogApp?.status !== 'pending' && (
              <Button variant="outline" onClick={() => setViewDialogApp(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialogApp} onOpenChange={() => setRejectDialogApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Vendor Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this vendor application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <p className="text-sm font-medium">{rejectDialogApp?.business_name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Rejection Reason</Label>
              <Textarea
                id="rejectReason"
                placeholder="Enter reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogApp(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
