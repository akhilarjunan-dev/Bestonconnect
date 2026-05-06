import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Save, X, TrendingUp, Zap, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailySalesTier {
  id: string;
  tier_name: string;
  min_sales: number;
  max_sales: number | null;
  commission_percent: number;
  is_active: boolean;
  display_order: number;
}

export function DailySalesTierSettings() {
  const [tiers, setTiers] = useState<DailySalesTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<DailySalesTier | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTier, setNewTier] = useState({
    tier_name: '',
    min_sales: 1,
    max_sales: 5 as number | null,
    commission_percent: 10,
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('daily_sales_tiers')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      toast.error('Failed to fetch tiers');
      console.error('Error:', error);
    } else {
      setTiers(data || []);
    }
    setLoading(false);
  };

  const handleAddTier = async () => {
    if (!newTier.tier_name) {
      toast.error('Please enter a tier name');
      return;
    }

    const { error } = await supabase
      .from('daily_sales_tiers')
      .insert({
        tier_name: newTier.tier_name,
        min_sales: newTier.min_sales,
        max_sales: newTier.max_sales,
        commission_percent: newTier.commission_percent,
        is_active: newTier.is_active,
        display_order: tiers.length + 1
      });

    if (error) {
      toast.error('Failed to add tier');
      console.error('Error:', error);
    } else {
      toast.success('Tier added successfully');
      setIsAddDialogOpen(false);
      setNewTier({
        tier_name: '',
        min_sales: 1,
        max_sales: 5,
        commission_percent: 10,
        is_active: true,
        display_order: 0
      });
      fetchTiers();
    }
  };

  const handleUpdateTier = async () => {
    if (!editingTier) return;

    const { error } = await supabase
      .from('daily_sales_tiers')
      .update({
        tier_name: editingTier.tier_name,
        min_sales: editingTier.min_sales,
        max_sales: editingTier.max_sales,
        commission_percent: editingTier.commission_percent,
        is_active: editingTier.is_active,
        display_order: editingTier.display_order
      })
      .eq('id', editingTier.id);

    if (error) {
      toast.error('Failed to update tier');
      console.error('Error:', error);
    } else {
      toast.success('Tier updated successfully');
      setEditingTier(null);
      fetchTiers();
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tier?')) return;

    const { error } = await supabase
      .from('daily_sales_tiers')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete tier');
      console.error('Error:', error);
    } else {
      toast.success('Tier deleted successfully');
      fetchTiers();
    }
  };

  const handleToggleActive = async (tier: DailySalesTier) => {
    const { error } = await supabase
      .from('daily_sales_tiers')
      .update({ is_active: !tier.is_active })
      .eq('id', tier.id);

    if (error) {
      toast.error('Failed to update tier');
    } else {
      fetchTiers();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading tiers...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-info">How Daily Sales Tiers Work</p>
              <p className="text-sm text-muted-foreground">
                Commission is calculated based on each promoter's individual daily sales count. 
                When a promoter makes a sale, the system counts how many sales they've made <strong>today</strong> and 
                applies the corresponding tier percentage to their base commission.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Example:</strong> If a product has 10% commission (₹10 on ₹100), and the promoter is on Tier 2 (25%), 
                they receive ₹10 × 25% = <strong>₹2.50</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Commission Tier Progression
          </CardTitle>
          <CardDescription>Visual representation of how commission scales with daily sales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {tiers.filter(t => t.is_active).map((tier, idx) => (
              <div
                key={tier.id}
                className={cn(
                  "flex-1 p-3 rounded-lg text-center transition-all",
                  idx === 0 && "bg-muted",
                  idx === 1 && "bg-primary/10",
                  idx === 2 && "bg-surge/10",
                  idx === 3 && "bg-earnings/10",
                  idx >= 4 && "bg-gradient-to-r from-earnings/20 to-surge/20"
                )}
              >
                <p className="text-xs text-muted-foreground">{tier.tier_name}</p>
                <p className="text-2xl font-bold">{tier.commission_percent}%</p>
                <p className="text-xs text-muted-foreground">
                  {tier.min_sales} - {tier.max_sales || '∞'} sales
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>More daily sales = Higher commission percentage!</span>
          </div>
        </CardContent>
      </Card>

      {/* Tiers Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Daily Sales Tiers</CardTitle>
            <CardDescription>Configure commission percentages based on promoter's daily sales count</CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Tier
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier Name</TableHead>
                <TableHead>Min Sales</TableHead>
                <TableHead>Max Sales</TableHead>
                <TableHead>Commission %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell className="font-medium">{tier.tier_name}</TableCell>
                  <TableCell>{tier.min_sales}</TableCell>
                  <TableCell>{tier.max_sales ?? 'Unlimited'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-earnings border-earnings/30">
                      {tier.commission_percent}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={tier.is_active}
                      onCheckedChange={() => handleToggleActive(tier)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingTier(tier)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTier(tier.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Tier Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Tier</DialogTitle>
            <DialogDescription>
              Create a new daily sales tier for promoter commissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tier Name</Label>
              <Input
                placeholder="e.g., Tier 6"
                value={newTier.tier_name}
                onChange={(e) => setNewTier({ ...newTier, tier_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Sales (per day)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newTier.min_sales}
                  onChange={(e) => setNewTier({ ...newTier, min_sales: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Sales (leave empty for unlimited)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={newTier.max_sales ?? ''}
                  onChange={(e) => setNewTier({ 
                    ...newTier, 
                    max_sales: e.target.value ? parseInt(e.target.value) : null 
                  })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Commission Percentage</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={newTier.commission_percent}
                onChange={(e) => setNewTier({ ...newTier, commission_percent: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-muted-foreground">
                Promoter receives this percentage of the product's base commission
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTier}>Add Tier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tier Dialog */}
      <Dialog open={!!editingTier} onOpenChange={(o) => !o && setEditingTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tier</DialogTitle>
            <DialogDescription>
              Modify the tier settings
            </DialogDescription>
          </DialogHeader>
          {editingTier && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tier Name</Label>
                <Input
                  value={editingTier.tier_name}
                  onChange={(e) => setEditingTier({ ...editingTier, tier_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Sales (per day)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editingTier.min_sales}
                    onChange={(e) => setEditingTier({ ...editingTier, min_sales: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Sales (leave empty for unlimited)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={editingTier.max_sales ?? ''}
                    onChange={(e) => setEditingTier({ 
                      ...editingTier, 
                      max_sales: e.target.value ? parseInt(e.target.value) : null 
                    })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commission Percentage</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editingTier.commission_percent}
                  onChange={(e) => setEditingTier({ ...editingTier, commission_percent: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTier(null)}>Cancel</Button>
            <Button onClick={handleUpdateTier} className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}