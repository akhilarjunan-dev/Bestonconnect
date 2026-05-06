import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, TrendingUp, Rocket, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailySalesTier {
  id: string;
  tier_name: string;
  min_sales: number;
  max_sales: number | null;
  commission_percent: number;
  display_order: number;
}

interface DailySalesTierProgressProps {
  userId: string;
  className?: string;
}

export function DailySalesTierProgress({ userId, className }: DailySalesTierProgressProps) {
  const [tiers, setTiers] = useState<DailySalesTier[]>([]);
  const [dailySalesCount, setDailySalesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Set up real-time subscription for sales
    const channel = supabase
      .channel('daily-tier-progress')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
          filter: `promoter_id=eq.${userId}`
        },
        () => {
          fetchDailySales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTiers(), fetchDailySales()]);
    setLoading(false);
  };

  const fetchTiers = async () => {
    const { data, error } = await supabase
      .from('daily_sales_tiers')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching tiers:', error);
    } else {
      setTiers(data || []);
    }
  };

  const fetchDailySales = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { count, error } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('promoter_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`);

    if (error) {
      console.error('Error fetching daily sales:', error);
    } else {
      setDailySalesCount(count || 0);
    }
  };

  // Find current tier based on daily sales
  const getCurrentTier = () => {
    if (dailySalesCount === 0) return null;
    
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i];
      if (dailySalesCount >= tier.min_sales && 
          (tier.max_sales === null || dailySalesCount <= tier.max_sales)) {
        return tier;
      }
    }
    return tiers[0] || null;
  };

  // Find next tier
  const getNextTier = () => {
    const currentTier = getCurrentTier();
    if (!currentTier) return tiers[0] || null;
    
    const currentIndex = tiers.findIndex(t => t.id === currentTier.id);
    return tiers[currentIndex + 1] || null;
  };

  const currentTier = getCurrentTier();
  const nextTier = getNextTier();
  const salesToNext = nextTier ? nextTier.min_sales - dailySalesCount : 0;

  // Calculate progress to next tier
  const calculateProgress = () => {
    if (!currentTier || !nextTier) return 100;
    const rangeStart = currentTier.min_sales;
    const rangeEnd = nextTier.min_sales;
    const progress = ((dailySalesCount - rangeStart) / (rangeEnd - rangeStart)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="bg-gradient-to-r from-primary/10 via-surge/10 to-earnings/10 p-1">
        <div className="bg-card rounded-t-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-surge/20">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Tier</p>
                <p className="text-2xl font-bold font-display">
                  {currentTier?.tier_name || 'Start Selling!'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-primary">
                {currentTier?.commission_percent || 0}%
              </p>
              <p className="text-sm text-muted-foreground">commission rate</p>
            </div>
          </div>

          {/* Daily Sales Counter */}
          <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-muted/50 mb-4">
            <TrendingUp className="w-6 h-6 text-earnings" />
            <div className="text-center">
              <p className="text-3xl font-bold">{dailySalesCount}</p>
              <p className="text-sm text-muted-foreground">sales today</p>
            </div>
          </div>

          {/* Tier visualization */}
          <div className="flex gap-1 mb-4">
            {tiers.map((tier, idx) => {
              const isActive = currentTier && tier.display_order <= currentTier.display_order;
              const isCurrent = tier.id === currentTier?.id;
              return (
                <div
                  key={tier.id}
                  className={cn(
                    "flex-1 h-3 rounded-full transition-all",
                    isActive ? "bg-primary" : "bg-muted",
                    isCurrent && "ring-2 ring-primary ring-offset-2"
                  )}
                  title={`${tier.tier_name}: ${tier.commission_percent}%`}
                />
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground mb-4">
            {tiers.map((tier) => (
              <span 
                key={tier.id} 
                className={cn(
                  tier.id === currentTier?.id && "text-primary font-semibold"
                )}
              >
                {tier.commission_percent}%
              </span>
            ))}
          </div>

          {nextTier ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Rocket className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {salesToNext} more sale{salesToNext > 1 ? 's' : ''} to reach{' '}
                    <span className="text-primary font-bold">{nextTier.tier_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Unlock <span className="text-earnings font-semibold">{nextTier.commission_percent}%</span> commission rate!
                  </p>
                </div>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
            </div>
          ) : currentTier ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-earnings/10">
              <Trophy className="w-5 h-5 text-earnings" />
              <span className="text-sm font-medium text-earnings">
                Maximum tier achieved! You're earning {currentTier.commission_percent}% on every sale! 🎉
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Make your first sale today!</p>
                <p className="text-xs text-muted-foreground">
                  Start at {tiers[0]?.commission_percent || 10}% and climb to {tiers[tiers.length - 1]?.commission_percent || 100}%
                </p>
              </div>
            </div>
          )}

          {/* Tier Benefits */}
          {currentTier && (
            <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary">{currentTier.tier_name}</Badge>
                <span className="text-sm text-muted-foreground">
                  {currentTier.min_sales} - {currentTier.max_sales || '∞'} sales/day
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Every sale you make today earns you <strong>{currentTier.commission_percent}%</strong> of the product's base commission!
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}