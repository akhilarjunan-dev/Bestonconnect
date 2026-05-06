import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';

interface OrderNotificationListenerProps {
  /** 'admin' listens to all orders, 'vendor' filters by vendor_id */
  role: 'admin' | 'vendor';
  vendorProductIds?: string[];
}

export function OrderNotificationListener({ role, vendorProductIds }: OrderNotificationListenerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playBeep = useCallback(() => {
    try {
      // Create a beep sound using Web Audio API
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 880; // A5 note
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      
      // Play two beeps
      setTimeout(() => {
        gainNode.gain.value = 0;
        setTimeout(() => {
          gainNode.gain.value = 0.3;
          setTimeout(() => {
            oscillator.stop();
            ctx.close();
          }, 200);
        }, 100);
      }, 200);
    } catch (e) {
      console.warn('Could not play beep sound:', e);
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('new-orders-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newOrder = payload.new as any;
          
          // For vendor role, only notify if order is for their product
          if (role === 'vendor' && vendorProductIds) {
            if (!vendorProductIds.includes(newOrder.product_id)) return;
          }

          playBeep();
          
          toast('🛒 New Order Received!', {
            description: `Order from ${newOrder.buyer_name || newOrder.buyer_email} - ₹${Number(newOrder.total_amount).toLocaleString()}`,
            duration: 10000,
            action: {
              label: 'View',
              onClick: () => {
                // Navigate to orders tab
                window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'orders' }));
              },
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, vendorProductIds, playBeep]);

  return null;
}
