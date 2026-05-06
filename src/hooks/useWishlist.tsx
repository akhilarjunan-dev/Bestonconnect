import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WishlistItem {
  id: string;
  product_id: string;
  created_at: string;
}

export function useWishlist() {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setWishlist([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('wishlists')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to fetch wishlist:', error);
    } else {
      setWishlist(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const isInWishlist = useCallback((productId: string) => {
    return wishlist.some(item => item.product_id === productId);
  }, [wishlist]);

  const addToWishlist = async (productId: string) => {
    if (!user) {
      toast.error('Please login to add to wishlist');
      return false;
    }

    const { error } = await supabase
      .from('wishlists')
      .insert({ user_id: user.id, product_id: productId });

    if (error) {
      if (error.code === '23505') {
        toast.info('Already in wishlist');
      } else {
        toast.error('Failed to add to wishlist');
      }
      return false;
    }

    toast.success('Added to wishlist');
    await fetchWishlist();
    return true;
  };

  const removeFromWishlist = async (productId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    if (error) {
      toast.error('Failed to remove from wishlist');
      return false;
    }

    toast.success('Removed from wishlist');
    await fetchWishlist();
    return true;
  };

  const toggleWishlist = async (productId: string) => {
    if (isInWishlist(productId)) {
      return removeFromWishlist(productId);
    } else {
      return addToWishlist(productId);
    }
  };

  return {
    wishlist,
    loading,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    refetch: fetchWishlist,
  };
}
