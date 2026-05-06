import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Users, Search, Link2, X } from 'lucide-react';

interface Promoter {
  id: string;
  full_name: string | null;
  email: string;
  promoter_tier: string | null;
}

interface Referral {
  id: string;
  referred_promoter_id: string;
  referrer_promoter_id: string;
  created_at: string;
  tier_at_referral: string | null;
  referred_promoter?: Promoter;
  referrer_promoter?: Promoter;
}

export function PromoterAssignment() {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [unassignedPromoters, setUnassignedPromoters] = useState<Promoter[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedNewPromoters, setSelectedNewPromoters] = useState<string[]>([]);
  const [selectedReferrer, setSelectedReferrer] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [unassignedSearchTerm, setUnassignedSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Get all promoters
    const { data: promoterRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'promoter');

    if (promoterRoles && promoterRoles.length > 0) {
      const promoterIds = promoterRoles.map(r => r.user_id);
      
      const { data: allProfiles } = await supabase.rpc('get_profiles_for_manager');
      const profiles = (allProfiles || []).filter((p: any) => promoterIds.includes(p.id));
      
      setPromoters(profiles || []);

      // Get existing referrals
      const { data: referralData } = await supabase
        .from('promoter_referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (referralData) {
        // Fetch profiles for referrals
        const allIds = [...new Set([
          ...referralData.map(r => r.referred_promoter_id),
          ...referralData.map(r => r.referrer_promoter_id)
        ])];
        
        const refProfiles = (allProfiles || []).filter((p: any) => allIds.includes(p.id));

        const profileMap = new Map(refProfiles?.map(p => [p.id, p]) || []);
        
        const enrichedReferrals = referralData.map(r => ({
          ...r,
          referred_promoter: profileMap.get(r.referred_promoter_id),
          referrer_promoter: profileMap.get(r.referrer_promoter_id)
        }));

        setReferrals(enrichedReferrals);

        // Find unassigned promoters (not referred by anyone)
        const assignedIds = new Set(referralData.map(r => r.referred_promoter_id));
        const unassigned = (profiles || []).filter(p => !assignedIds.has(p.id));
        setUnassignedPromoters(unassigned);
      } else {
        setUnassignedPromoters(profiles || []);
      }
    }

    setLoading(false);
  };

  const togglePromoterSelection = (promoterId: string) => {
    setSelectedNewPromoters(prev => 
      prev.includes(promoterId)
        ? prev.filter(id => id !== promoterId)
        : [...prev, promoterId]
    );
  };

  const handleSelectAll = () => {
    const filteredIds = filteredUnassignedPromoters
      .filter(p => p.id !== selectedReferrer)
      .map(p => p.id);
    
    if (filteredIds.every(id => selectedNewPromoters.includes(id))) {
      // Deselect all filtered
      setSelectedNewPromoters(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered
      setSelectedNewPromoters(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleAssignPromoters = async () => {
    if (selectedNewPromoters.length === 0 || !selectedReferrer) {
      toast({ title: 'Error', description: 'Please select at least one promoter and a referrer', variant: 'destructive' });
      return;
    }

    if (selectedNewPromoters.includes(selectedReferrer)) {
      toast({ title: 'Error', description: 'A promoter cannot refer themselves', variant: 'destructive' });
      return;
    }

    setAssigning(true);

    // Build insert records for all selected promoters
    const insertRecords = selectedNewPromoters.map(promoterId => {
      const newPromoter = promoters.find(p => p.id === promoterId);
      const tier = newPromoter?.promoter_tier || 'free';
      return {
        referred_promoter_id: promoterId,
        referrer_promoter_id: selectedReferrer,
        tier_at_referral: tier,
        current_tier: tier
      };
    });

    const { error } = await supabase
      .from('promoter_referrals')
      .insert(insertRecords);

    if (error) {
      console.error('Assignment error:', error);
      if (error.code === '23505') {
        toast({ title: 'Error', description: 'Some promoters are already assigned to a referrer', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to assign promoters', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Success', description: `${selectedNewPromoters.length} promoter(s) assigned successfully` });
      setSelectedNewPromoters([]);
      setSelectedReferrer('');
      setUnassignedSearchTerm('');
      fetchData();
    }

    setAssigning(false);
  };

  const filteredUnassignedPromoters = unassignedPromoters.filter(p => {
    const searchLower = unassignedSearchTerm.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower)
    );
  });

  const filteredReferrals = referrals.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    return (
      r.referred_promoter?.full_name?.toLowerCase().includes(searchLower) ||
      r.referred_promoter?.email.toLowerCase().includes(searchLower) ||
      r.referrer_promoter?.full_name?.toLowerCase().includes(searchLower) ||
      r.referrer_promoter?.email.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Assignment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Assign Promoters
          </CardTitle>
          <CardDescription>
            Select multiple promoters to assign under an existing promoter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Multi-select for new promoters */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                New Promoters (to be assigned) 
                {selectedNewPromoters.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{selectedNewPromoters.length} selected</Badge>
                )}
              </label>
              <div className="border rounded-lg bg-background">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search promoters..."
                      value={unassignedSearchTerm}
                      onChange={(e) => setUnassignedSearchTerm(e.target.value)}
                      className="pl-8 h-8"
                    />
                  </div>
                </div>
                {filteredUnassignedPromoters.length > 0 && (
                  <div className="p-2 border-b flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-primary hover:underline"
                    >
                      {filteredUnassignedPromoters.filter(p => p.id !== selectedReferrer).every(p => selectedNewPromoters.includes(p.id))
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                    {selectedNewPromoters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedNewPromoters([])}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                  </div>
                )}
                <ScrollArea className="h-48">
                  <div className="p-2 space-y-1">
                    {filteredUnassignedPromoters.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {unassignedSearchTerm ? 'No promoters match your search' : 'No unassigned promoters'}
                      </p>
                    ) : (
                      filteredUnassignedPromoters
                        .filter(p => p.id !== selectedReferrer)
                        .map(p => (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                              selectedNewPromoters.includes(p.id) ? 'bg-primary/10' : ''
                            }`}
                          >
                            <Checkbox
                              checked={selectedNewPromoters.includes(p.id)}
                              onCheckedChange={() => togglePromoterSelection(p.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.full_name || p.email}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {p.promoter_tier || 'free'}
                            </Badge>
                          </label>
                        ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Referrer selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign Under (Referrer)</label>
              <Select value={selectedReferrer} onValueChange={(value) => {
                setSelectedReferrer(value);
                // Remove from selected if they were selected as new promoter
                setSelectedNewPromoters(prev => prev.filter(id => id !== value));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select referrer" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {promoters.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.promoter_tier || 'free'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The selected promoters will be assigned under this referrer
              </p>

              <div className="pt-4">
                <Button 
                  onClick={handleAssignPromoters} 
                  disabled={assigning || selectedNewPromoters.length === 0 || !selectedReferrer}
                  className="w-full"
                >
                  {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                  Assign {selectedNewPromoters.length > 0 ? `${selectedNewPromoters.length} Promoter${selectedNewPromoters.length > 1 ? 's' : ''}` : 'Promoters'}
                </Button>
              </div>
            </div>
          </div>

          {unassignedPromoters.length === 0 && (
            <p className="text-sm text-muted-foreground">All promoters are already assigned to referrers.</p>
          )}
        </CardContent>
      </Card>

      {/* Existing Referrals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Referral Network ({referrals.length})
          </CardTitle>
          <CardDescription>
            View all promoter referral relationships
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredReferrals.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>New Promoter</TableHead>
                    <TableHead>Assigned Under</TableHead>
                    <TableHead>Tier at Referral</TableHead>
                    <TableHead>Assigned Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map(referral => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{referral.referred_promoter?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{referral.referred_promoter?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{referral.referrer_promoter?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{referral.referrer_promoter?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={referral.tier_at_referral === 'premium' ? 'default' : 'secondary'}>
                          {referral.tier_at_referral || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(referral.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? 'No referrals found matching your search.' : 'No referral relationships yet.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
