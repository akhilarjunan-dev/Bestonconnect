import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Key, Plus, RefreshCw, Copy, Eye, EyeOff } from 'lucide-react';

interface Manager {
  id: string;
  email: string;
  full_name: string | null;
}

interface ManagerPassword {
  id: string;
  manager_id: string;
  is_active: boolean;
  created_at: string;
  manager?: Manager;
}

export function ManagerPasswordManagement() {
  const { user } = useAuth();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [passwords, setPasswords] = useState<ManagerPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch managers
    const { data: managerRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'manager');

    if (managerRoles && managerRoles.length > 0) {
      const managerIds = managerRoles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', managerIds);
      
      if (profiles) setManagers(profiles);
    }

    // Fetch passwords with manager info
    const { data: passwordsData } = await supabase
      .from('manager_passwords')
      .select('*')
      .order('created_at', { ascending: false });

    if (passwordsData && passwordsData.length > 0) {
      const managerIds = passwordsData.map(p => p.manager_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', managerIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const enriched = passwordsData.map(p => ({
        ...p,
        manager: profileMap.get(p.manager_id)
      }));
      setPasswords(enriched);
    }

    setLoading(false);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreatePassword = async () => {
    if (!selectedManager || !generatedPassword) {
      toast.error('Please select a manager');
      return;
    }

    setSaving(true);

    // Simple hash for demo (in production, use proper bcrypt on server)
    const passwordHash = btoa(generatedPassword);

    // Deactivate existing passwords for this manager
    await supabase
      .from('manager_passwords')
      .update({ is_active: false })
      .eq('manager_id', selectedManager);

    // Create new password
    const { error } = await supabase
      .from('manager_passwords')
      .insert({
        manager_id: selectedManager,
        password_hash: passwordHash,
        created_by: user?.id,
        is_active: true
      });

    if (error) {
      toast.error('Failed to create password');
    } else {
      toast.success('Manager password created');
      setDialogOpen(false);
      setSelectedManager('');
      setGeneratedPassword('');
      fetchData();
    }
    setSaving(false);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('manager_passwords')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update password status');
    } else {
      fetchData();
    }
  };

  const handleOpenDialog = (managerId?: string) => {
    setSelectedManager(managerId || '');
    setGeneratedPassword(generatePassword());
    setShowPassword(true);
    setDialogOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Manager Approval Passwords
            </CardTitle>
            <CardDescription>
              Generate passwords for managers to approve withdrawals
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Password
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {passwords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No manager passwords configured yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passwords.map((pwd) => (
                <TableRow key={pwd.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{pwd.manager?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{pwd.manager?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={pwd.is_active ? 'default' : 'secondary'}>
                      {pwd.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(pwd.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={pwd.is_active}
                        onCheckedChange={(v) => handleToggleActive(pwd.id, v)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(pwd.manager_id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Manager Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Manager</Label>
                <select
                  className="w-full p-2 border rounded-md bg-background"
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                >
                  <option value="">Choose a manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Generated Password</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={generatedPassword}
                    readOnly
                    className="font-mono text-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(generatedPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setGeneratedPassword(generatePassword())}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this password with the manager securely. It will be required to approve withdrawals.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePassword} disabled={saving || !selectedManager}>
                {saving ? 'Saving...' : 'Save Password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
