import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Users, 
  Copy, 
  Share2, 
  UserPlus, 
  Crown, 
  TrendingUp,
  Loader2
} from 'lucide-react';

interface ReferredPromoter {
  id: string;
  referred_promoter_id: string;
  current_tier: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
    promoter_tier: string | null;
  };
}

export function PromoterReferralShare() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string>('');
  const [referredPromoters, setReferredPromoters] = useState<ReferredPromoter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      initReferralCode();
      fetchReferredPromoters();
    }
  }, [user]);

  const generateNameBasedCode = (name: string): string => {
    const slug = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return slug.length >= 3 ? slug.substring(0, 12) : slug + user!.id.substring(0, 8 - slug.length).toUpperCase();
  };

  const ensureUniqueCode = async (baseCode: string): Promise<string> => {
    let code = baseCode;
    let attempt = 0;
    while (true) {
      const { data } = await supabase
        .from('referral_links')
        .select('id')
        .ilike('link_code', code)
        .maybeSingle();
      if (!data) return code;
      attempt++;
      code = `${baseCode}${attempt}`;
    }
  };

  const initReferralCode = async () => {
    if (!user?.id) return;

    // Check if link already exists
    const { data: existing } = await supabase
      .from('referral_links')
      .select('id, link_code')
      .eq('promoter_id', user.id)
      .is('product_id', null)
      .maybeSingle();

    if (existing) {
      setReferralCode(existing.link_code);
      return;
    }

    // Fetch name for code generation
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const baseName = profile?.full_name?.trim();
    const baseCode = baseName ? generateNameBasedCode(baseName) : user.id.substring(0, 8).toUpperCase();
    const code = await ensureUniqueCode(baseCode);
    setReferralCode(code);

    await supabase.from('referral_links').insert({
      promoter_id: user.id,
      link_code: code,
      product_id: null,
      expires_at: null,
    });
  };

  const fetchReferredPromoters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('promoter_referrals')
      .select(`
        id,
        referred_promoter_id,
        current_tier,
        created_at,
        profiles:referred_promoter_id (
          full_name,
          email,
          promoter_tier
        )
      `)
      .eq('referrer_promoter_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referred promoters:', error);
    } else {
      setReferredPromoters((data || []) as unknown as ReferredPromoter[]);
    }
    setLoading(false);
  };

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  };

  const safeCopy = async (text: string, msg: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      toast.success(msg);
    } catch {
      if (fallbackCopy(text)) {
        toast.success(msg);
      } else {
        toast.error('Copy failed. Please copy manually.');
      }
    }
  };

  const copyReferralCode = () => {
    safeCopy(referralCode, 'Referral code copied to clipboard!');
  };

  const copyReferralLink = () => {
    const url = `${window.location.origin}/promoter/apply?ref=${referralCode}`;
    safeCopy(url, 'Referral link copied to clipboard!');
  };

  const shareReferral = async () => {
    const url = `${window.location.origin}/promoter/apply?ref=${referralCode}`;
    const text = `Join as a promoter and start earning! Use my referral code: ${referralCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join as a Promoter',
          text,
          url
        });
      } catch {
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  const premiumCount = referredPromoters.filter(
    r => r.profiles?.promoter_tier === 'premium'
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Refer Other Promoters
        </CardTitle>
        <CardDescription>
          Earn commissions when you refer new promoters. Get {10}% of their subscription and {5}% of their sales!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Code Section */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
          <div className="flex items-center gap-3">
            <Input
              value={referralCode}
              readOnly
              className="font-mono text-lg font-bold tracking-wider bg-background"
            />
            <Button variant="outline" size="icon" onClick={copyReferralCode}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={copyReferralLink} variant="outline" className="flex-1 gap-2">
            <Copy className="w-4 h-4" />
            Copy Invite Link
          </Button>
          <Button onClick={shareReferral} className="flex-1 gap-2">
            <Share2 className="w-4 h-4" />
            Share Invite
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <UserPlus className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{referredPromoters.length}</p>
            <p className="text-sm text-muted-foreground">Referred Promoters</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Crown className="w-6 h-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">{premiumCount}</p>
            <p className="text-sm text-muted-foreground">Premium Members</p>
          </div>
        </div>

        {/* Referred Promoters List */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : referredPromoters.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Your Team</h4>
            {referredPromoters.map((referral) => (
              <div
                key={referral.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {referral.profiles?.full_name || referral.profiles?.email || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    referral.profiles?.promoter_tier === 'premium'
                      ? 'border-amber-500 text-amber-600 bg-amber-50'
                      : ''
                  }
                >
                  {referral.profiles?.promoter_tier === 'premium' ? (
                    <>
                      <Crown className="w-3 h-3 mr-1" />
                      Premium
                    </>
                  ) : (
                    'Free'
                  )}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No referrals yet</p>
            <p className="text-sm">Share your code to start building your team!</p>
          </div>
        )}

        {/* Earnings Info */}
        <div className="p-4 rounded-lg bg-earnings/10 border border-earnings/20">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-earnings mt-0.5" />
            <div>
              <p className="font-medium text-earnings">Referral Earnings</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• 10% of subscription when they upgrade to premium</li>
                <li>• 5% of their sales commission on every sale</li>
                <li>• 2% bonus when they reach Tier 3</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
