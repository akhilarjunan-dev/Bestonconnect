import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Store, CheckCircle, Clock, XCircle, Loader2, Building, Phone, Mail, MapPin, FileText, History } from 'lucide-react';

import type { Tables } from '@/integrations/supabase/types';

type VendorApplication = Tables<'vendor_applications'>;

export default function VendorApplicationPage() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [existingApp, setExistingApp] = useState<VendorApplication | null>(null);
  const [applicationHistory, setApplicationHistory] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      const redirect = encodeURIComponent(location.pathname);
      navigate(`/auth?redirect=${redirect}`);
      return;
    }
    if (user) {
      // If already a vendor, redirect to dashboard
      if (hasRole('vendor')) {
        navigate('/vendor/dashboard');
        return;
      }
      fetchExistingApplication();
    }
  }, [user, authLoading, hasRole, navigate, location.pathname]);

  const fetchExistingApplication = async () => {
    const { data, error } = await supabase
      .from('vendor_applications')
      .select('*')
      .eq('user_id', user?.id as string)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      setApplicationHistory(data);

      // Set the most recent non-rejected application as current, or the latest one
      const activeApp = data.find(app => app.status !== 'rejected') || data[0];
      setExistingApp(activeApp);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!businessName.trim() || !businessDescription.trim() || !businessAddress.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('vendor_applications')
        .insert({
          user_id: user.id,
          business_name: businessName.trim(),
          business_description: businessDescription.trim(),
          business_address: businessAddress.trim(),
          gst_number: gstNumber.trim() || null,
          status: 'pending'
        });

      if (error) {
        console.error('Error submitting application:', error);
        toast.error('Failed to submit application');
        return;
      }

      toast.success('Application submitted successfully!');
      fetchExistingApplication();
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Show existing application status
  if (existingApp) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {existingApp.status === 'pending' && (
                  <div className="p-4 rounded-full bg-warning/10">
                    <Clock className="h-12 w-12 text-warning" />
                  </div>
                )}
                {existingApp.status === 'approved' && (
                  <div className="p-4 rounded-full bg-earnings/10">
                    <CheckCircle className="h-12 w-12 text-earnings" />
                  </div>
                )}
                {existingApp.status === 'rejected' && (
                  <div className="p-4 rounded-full bg-destructive/10">
                    <XCircle className="h-12 w-12 text-destructive" />
                  </div>
                )}
              </div>
              <CardTitle className="text-2xl">
                {existingApp.status === 'pending' && 'Application Under Review'}
                {existingApp.status === 'approved' && 'Application Approved!'}
                {existingApp.status === 'rejected' && 'Application Rejected'}
              </CardTitle>
              <CardDescription>
                {existingApp.status === 'pending' &&
                  (existingApp.reason ||
                    'Your vendor application is being reviewed. We\'ll notify you once a decision is made.')}
                {existingApp.status === 'approved' &&
                  'Congratulations! You are now a vendor. Head to your dashboard to start selling.'}
                {existingApp.status === 'rejected' &&
                  (existingApp.reason || 'Unfortunately, your application was not approved.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex justify-center gap-4 flex-wrap">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {existingApp.business_name}
                </Badge>
                <Badge variant={
                  existingApp.status === 'approved' ? 'default' :
                  existingApp.status === 'pending' ? 'secondary' : 'destructive'
                }>
                  {existingApp.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Applied on {new Date(existingApp.created_at).toLocaleDateString()}
              </p>
              {existingApp.status === 'approved' && (
                <Button onClick={() => navigate('/vendor/dashboard')}>
                  <Store className="mr-2 h-4 w-4" />
                  Go to Vendor Dashboard
                </Button>
              )}
              {existingApp.status === 'rejected' && (
                <Button
                  onClick={() => {
                    setExistingApp(null);
                    setBusinessName('');
                    setBusinessDescription('');
                    setBusinessAddress('');
                    setGstNumber('');
                  }}
                >
                  Reapply as Vendor
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Application History */}
          {applicationHistory.length > 1 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Application History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {applicationHistory.map((app) => (
                    <div
                      key={app.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        app.id === existingApp?.id ? 'bg-muted/50 border-primary/30' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {app.status === 'pending' && <Clock className="h-4 w-4 text-warning" />}
                        {app.status === 'approved' && <CheckCircle className="h-4 w-4 text-earnings" />}
                        {app.status === 'rejected' && <XCircle className="h-4 w-4 text-destructive" />}
                        <div>
                          <p className="text-sm font-medium">{app.business_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Applied: {new Date(app.created_at).toLocaleDateString()}
                            {app.reviewed_at && ` • Reviewed: ${new Date(app.reviewed_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        app.status === 'approved' ? 'default' :
                        app.status === 'pending' ? 'secondary' : 'destructive'
                      }>
                        {app.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-primary/10 mb-4">
            <Store className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display mb-2">Become a Vendor</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Join our marketplace and start selling your products to thousands of customers
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-center">
              <Store className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-sm">Your Own Store</p>
              <p className="text-xs text-muted-foreground">Manage products easily</p>
            </CardContent>
          </Card>
          <Card className="border-earnings/20 bg-earnings/5">
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-earnings mx-auto mb-2" />
              <p className="font-semibold text-sm">Order Management</p>
              <p className="text-xs text-muted-foreground">Track orders & shipments</p>
            </CardContent>
          </Card>
          <Card className="border-info/20 bg-info/5">
            <CardContent className="p-4 text-center">
              <Building className="h-8 w-8 text-info mx-auto mb-2" />
              <p className="font-semibold text-sm">Business Growth</p>
              <p className="text-xs text-muted-foreground">Access to promoter network</p>
            </CardContent>
          </Card>
        </div>

        {/* Application Form */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Application</CardTitle>
            <CardDescription>
              Please provide your business details. We'll review your application within 2-3 business days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessName">
                  <Building className="inline h-4 w-4 mr-1" />
                  Business Name *
                </Label>
                <Input
                  id="businessName"
                  placeholder="Enter your business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDescription">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Business Description *
                </Label>
                <Textarea
                  id="businessDescription"
                  placeholder="Describe your business and what products you plan to sell..."
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAddress">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Business Address *
                </Label>
                <Textarea
                  id="businessAddress"
                  placeholder="Enter your complete business address"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gstNumber">
                  GST Number (Optional)
                </Label>
                <Input
                  id="gstNumber"
                  placeholder="e.g., 22AAAAA0000A1Z5"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                />
                <p className="text-xs text-muted-foreground">
                  If you have a GST registration, please provide your GSTIN
                </p>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">By applying, you agree to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Our vendor terms and conditions</li>
                  <li>Maintain product quality standards</li>
                  <li>Process orders within specified timeframes</li>
                  <li>Provide accurate product information</li>
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Store className="mr-2 h-4 w-4" />
                    Submit Application
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
