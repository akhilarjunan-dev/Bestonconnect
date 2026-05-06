import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseRealtimeEarningsOptions {
  userId: string | undefined;
  onEarningsChange?: () => void;
  onWithdrawalsChange?: () => void;
}

export function useRealtimeEarnings({ 
  userId, 
  onEarningsChange, 
  onWithdrawalsChange 
}: UseRealtimeEarningsOptions) {
  useEffect(() => {
    if (!userId) return;

    // Subscribe to earnings changes for this promoter
    const earningsChannel = supabase
      .channel(`earnings-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'earnings',
          filter: `promoter_id=eq.${userId}`
        },
        (payload) => {
          const newEarning = payload.new as { amount?: number; earning_type?: string };
          const amount = newEarning?.amount || 0;
          const type = newEarning?.earning_type || 'sale';
          
          toast.success('New Earning Received! 💰', {
            description: `₹${amount.toLocaleString()} from ${type === 'referral' ? 'referral bonus' : 'sale commission'}`,
            duration: 5000,
          });
          
          onEarningsChange?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'earnings',
          filter: `promoter_id=eq.${userId}`
        },
        (payload) => {
          const updated = payload.new as { status?: string; amount?: number };
          if (updated?.status === 'approved') {
            toast.success('Earning Approved! ✅', {
              description: `₹${(updated.amount || 0).toLocaleString()} has been approved`,
              duration: 5000,
            });
          } else if (updated?.status === 'rejected') {
            toast.error('Earning Rejected', {
              description: 'An earning was rejected. Check details in your dashboard.',
              duration: 5000,
            });
          }
          onEarningsChange?.();
        }
      )
      .subscribe();

    // Subscribe to withdrawals changes for this promoter
    const withdrawalsChannel = supabase
      .channel(`withdrawals-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'withdrawals',
          filter: `promoter_id=eq.${userId}`
        },
        () => {
          onWithdrawalsChange?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'withdrawals',
          filter: `promoter_id=eq.${userId}`
        },
        (payload) => {
          const updated = payload.new as { status?: string; amount?: number };
          if (updated?.status === 'approved') {
            toast.success('Withdrawal Approved! 🎉', {
              description: `₹${(updated.amount || 0).toLocaleString()} will be transferred to your bank`,
              duration: 5000,
            });
          } else if (updated?.status === 'rejected') {
            toast.error('Withdrawal Rejected', {
              description: 'Your withdrawal request was rejected. Check details for more info.',
              duration: 5000,
            });
          }
          onWithdrawalsChange?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(earningsChannel);
      supabase.removeChannel(withdrawalsChannel);
    };
  }, [userId, onEarningsChange, onWithdrawalsChange]);
}
