import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { PromoterNavFooter } from '@/components/navigation/PromoterNavFooter';
import { PromoterReferralShare } from '@/components/promoter/PromoterReferralShare';
import { AccountSettings } from '@/components/account/AccountSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  User, 
  Building2, 
  CreditCard, 
  FileCheck, 
  Upload, 
  Loader2, 
  CheckCircle, 
  Clock, 
  XCircle,
  Phone,
  Mail,
  MapPin,
  Shield,
  Crown
} from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  address_proof_url: string | null;
  kyc_status: 'pending' | 'approved' | 'rejected' | null;
  kyc_verified_at: string | null;
  promoter_tier: 'free' | 'premium' | null;
}

export default function PromoterProfile() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: ''
  });

  useEffect(() => {
    if (!authLoading && (!user || !hasRole('promoter'))) {
      navigate('/');
      return;
    }
    if (user) {
      fetchProfile();
    }
  }, [user, authLoading, hasRole, navigate]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();

    if (error) {
      toast.error('Failed to load profile');
      setLoading(false);
      return;
    }

    setProfile(data as Profile);
    setFormData({
      full_name: data.full_name || '',
      phone: data.phone || '',
      address: data.address || '',
      bank_name: data.bank_name || '',
      bank_account_number: data.bank_account_number || '',
      bank_ifsc: data.bank_ifsc || ''
    });
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name || null,
        phone: formData.phone || null,
        address: formData.address || null,
        bank_name: formData.bank_name || null,
        bank_account_number: formData.bank_account_number || null,
        bank_ifsc: formData.bank_ifsc || null
      })
      .eq('id', user?.id);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile updated successfully');
      fetchProfile();
    }
    setSaving(false);
  };

  const handleUploadKycDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/address_proof_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Failed to upload document');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        address_proof_url: urlData.publicUrl,
        kyc_status: 'pending'
      })
      .eq('id', user?.id);

    if (updateError) {
      toast.error('Failed to update profile');
    } else {
      toast.success('KYC document uploaded. Pending verification.');
      fetchProfile();
    }
    setUploading(false);
  };

  const getKycStatusBadge = () => {
    if (!profile) return null;
    
    switch (profile.kyc_status) {
      case 'approved':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            Not Submitted
          </Badge>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold font-display">My Profile</h1>
            <p className="text-muted-foreground">Manage your KYC and bank details</p>
          </div>
          {profile?.promoter_tier && (
            <Badge variant="outline" className={profile.promoter_tier === 'premium' ? 'border-amber-500 text-amber-600' : ''}>
              <Crown className="w-3 h-3 mr-1" />
              {profile.promoter_tier === 'premium' ? 'Premium' : 'Free'} Tier
            </Badge>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Account Settings */}
          <div className="lg:col-span-2">
            <AccountSettings />
          </div>

          {/* Promoter Referral Section */}
          <div className="lg:col-span-2">
            <PromoterReferralShare />
          </div>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Your basic contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Address
                </Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Enter your address"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Bank Details
              </CardTitle>
              <CardDescription>For receiving your earnings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Bank Name
                </Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  placeholder="e.g., State Bank of India"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_account_number" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  Account Number
                </Label>
                <Input
                  id="bank_account_number"
                  name="bank_account_number"
                  value={formData.bank_account_number}
                  onChange={handleInputChange}
                  placeholder="Enter your account number"
                  type="password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_ifsc" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  IFSC Code
                </Label>
                <Input
                  id="bank_ifsc"
                  name="bank_ifsc"
                  value={formData.bank_ifsc}
                  onChange={handleInputChange}
                  placeholder="e.g., SBIN0001234"
                  className="uppercase"
                />
              </div>

              <Separator className="my-4" />

              <Button 
                onClick={handleSaveProfile} 
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Details'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* KYC Verification */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    KYC Verification
                  </CardTitle>
                  <CardDescription>Verify your identity to enable withdrawals</CardDescription>
                </div>
                {getKycStatusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  Address Proof Document
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a clear image of your Aadhaar Card, PAN Card, Passport, or Voter ID
                </p>
                
                {profile?.address_proof_url ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                      <FileCheck className="w-8 h-8 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">Document Uploaded</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.kyc_verified_at 
                            ? `Verified on ${new Date(profile.kyc_verified_at).toLocaleDateString()}`
                            : 'Pending verification'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(profile.address_proof_url!, '_blank')}
                      >
                        View
                      </Button>
                    </div>
                    
                    {profile.kyc_status !== 'approved' && (
                      <div>
                        <Label htmlFor="kyc-upload" className="cursor-pointer">
                          <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Upload className="w-4 h-4" />
                            Upload new document
                          </div>
                        </Label>
                        <Input
                          id="kyc-upload"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleUploadKycDocument}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="kyc-upload-new" className="cursor-pointer">
                      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
                        {uploading ? (
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                            <p className="font-medium">Click to upload</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG or PDF (max 5MB)</p>
                          </>
                        )}
                      </div>
                    </Label>
                    <Input
                      id="kyc-upload-new"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleUploadKycDocument}
                      disabled={uploading}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {profile?.kyc_status === 'rejected' && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    Your KYC was rejected. Please upload a clear and valid document.
                  </p>
                </div>
              )}

              {profile?.kyc_status === 'approved' && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Your KYC is verified. You can now request withdrawals.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <PromoterNavFooter />
    </Layout>
  );
}
