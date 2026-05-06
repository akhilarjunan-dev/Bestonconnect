import { useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, AlertTriangle, CheckCircle, KeyRound } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(255),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function AccountSettings() {
  const { user } = useAuth();
  
  // Email change state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [emailSuccess, setEmailSuccess] = useState(false);
  
  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Forgot password state
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const handleChangeEmail = async () => {
    setEmailErrors({});
    
    const validation = emailSchema.safeParse({ email: newEmail });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setEmailErrors(fieldErrors);
      return;
    }

    if (newEmail.toLowerCase() === user?.email?.toLowerCase()) {
      setEmailErrors({ email: 'New email must be different from current email' });
      return;
    }

    setEmailLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          toast.error('This email is already registered to another account');
        } else {
          toast.error(error.message);
        }
      } else {
        setEmailSuccess(true);
        toast.success('Confirmation email sent! Please check both your old and new email to confirm the change.');
      }
    } catch (error: any) {
      toast.error('Failed to update email');
    }

    setEmailLoading(false);
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});
    
    const validation = passwordSchema.safeParse({ 
      currentPassword, 
      newPassword, 
      confirmPassword 
    });
    
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setPasswordErrors(fieldErrors);
      return;
    }

    setPasswordLoading(true);

    try {
      // First verify current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: 'Current password is incorrect' });
        setPasswordLoading(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully!');
        setPasswordDialogOpen(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      toast.error('Failed to update password');
    }

    setPasswordLoading(false);
  };

  const resetEmailDialog = () => {
    setEmailDialogOpen(false);
    setNewEmail('');
    setEmailErrors({});
    setEmailSuccess(false);
  };

  const resetPasswordDialog = () => {
    setPasswordDialogOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordErrors({});
  };

  const handleForgotPassword = async () => {
    const email = forgotPasswordEmail.trim() || user?.email || '';
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setForgotPasswordLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setForgotPasswordSuccess(true);
        toast.success('Password reset email sent!');
      }
    } catch (error: any) {
      toast.error('Failed to send reset email');
    }

    setForgotPasswordLoading(false);
  };

  const resetForgotPasswordDialog = () => {
    setForgotPasswordDialogOpen(false);
    setForgotPasswordEmail('');
    setForgotPasswordSuccess(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Account Settings
        </CardTitle>
        <CardDescription>Manage your email and password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Email Display */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-4 h-4" />
            Current Email
          </Label>
          <div className="flex items-center gap-3">
            <Input value={user?.email || ''} disabled className="bg-muted flex-1" />
            <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>
              Change
            </Button>
          </div>
        </div>

        <Separator />

        {/* Password Section */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-muted-foreground">
            <Lock className="w-4 h-4" />
            Password
          </Label>
          <div className="flex items-center gap-3">
            <Input value="••••••••" disabled className="bg-muted flex-1" type="password" />
            <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
              Change
            </Button>
          </div>
          <Button 
            variant="link" 
            className="p-0 h-auto text-sm text-primary"
            onClick={() => {
              setForgotPasswordEmail(user?.email || '');
              setForgotPasswordDialogOpen(true);
            }}
          >
            <KeyRound className="w-3 h-3 mr-1" />
            Forgot Password?
          </Button>
        </div>
      </CardContent>

      {/* Change Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => !open && resetEmailDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Change Email Address
            </DialogTitle>
            <DialogDescription>
              Enter your new email address. You'll receive confirmation emails on both addresses.
            </DialogDescription>
          </DialogHeader>

          {emailSuccess ? (
            <div className="py-6 text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-earnings mx-auto" />
              <div>
                <p className="font-medium">Confirmation Email Sent!</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please check your inbox at <strong>{newEmail}</strong> and your current email to confirm the change.
                </p>
              </div>
              <Button onClick={resetEmailDialog}>Done</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="current-email">Current Email</Label>
                  <Input id="current-email" value={user?.email || ''} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-email">New Email Address</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="newemail@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  {emailErrors.email && (
                    <p className="text-sm text-destructive">{emailErrors.email}</p>
                  )}
                </div>

                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    You'll need to confirm the change from both your old and new email addresses.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetEmailDialog}>Cancel</Button>
                <Button onClick={handleChangeEmail} disabled={emailLoading}>
                  {emailLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Confirmation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={(open) => !open && resetPasswordDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              {passwordErrors.currentPassword && (
                <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
              )}
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {passwordErrors.newPassword && (
                <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetPasswordDialog}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordDialogOpen} onOpenChange={(open) => !open && resetForgotPasswordDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              We'll send a password reset link to your email address.
            </DialogDescription>
          </DialogHeader>

          {forgotPasswordSuccess ? (
            <div className="py-6 text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-earnings mx-auto" />
              <div>
                <p className="font-medium">Reset Email Sent!</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Check your inbox at <strong>{forgotPasswordEmail || user?.email}</strong> for the password reset link.
                </p>
              </div>
              <Button onClick={resetForgotPasswordDialog}>Done</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="your@email.com"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForgotPasswordDialog}>Cancel</Button>
                <Button onClick={handleForgotPassword} disabled={forgotPasswordLoading}>
                  {forgotPasswordLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Reset Link
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
