import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VendorCoverage {
  user_id: string;
  delivery_type: string;
  coverage_pincodes: string[];
  coverage_states: string[];
}

interface UserAddress {
  pincode: string;
  state: string;
}

export function useDeliveryCoverage() {
  const { user } = useAuth();
  const [vendorCoverages, setVendorCoverages] = useState<VendorCoverage[]>([]);
  const [userAddresses, setUserAddresses] = useState<UserAddress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    // Fetch all vendor profiles with delivery info
    const { data: profiles } = await supabase
      .from('vendor_profiles')
      .select('user_id, delivery_type, coverage_pincodes, coverage_states');

    if (profiles) {
      setVendorCoverages(profiles.map(p => ({
        user_id: p.user_id,
        delivery_type: (p as any).delivery_type || 'auto_shipping',
        coverage_pincodes: (p as any).coverage_pincodes || [],
        coverage_states: (p as any).coverage_states || [],
      })));
    }

    // Fetch user's saved addresses if logged in
    if (user) {
      const { data: addresses } = await supabase
        .from('saved_addresses')
        .select('pincode, state')
        .eq('user_id', user.id);

      if (addresses) {
        setUserAddresses(addresses);
      }
    }

    setLoaded(true);
  };

  /**
   * Check if a product is available for the current user based on vendor delivery coverage.
   * Returns true if product is available, false if it should be disabled/hidden.
   */
  const isProductAvailable = (vendorId: string | null): boolean => {
    // Admin products (no vendor) are always available
    if (!vendorId) return true;

    const coverage = vendorCoverages.find(v => v.user_id === vendorId);
    
    // No vendor profile = no restrictions (fallback to available)
    if (!coverage) return true;

    // Auto shipping = available everywhere
    if (coverage.delivery_type === 'auto_shipping') return true;

    // If user is not logged in or has no addresses, restrict vendor-specific products
    if (userAddresses.length === 0) return false;

    if (coverage.delivery_type === 'in_hand') {
      // Check if any user address pincode matches vendor's coverage pincodes
      return userAddresses.some(addr => 
        coverage.coverage_pincodes.includes(addr.pincode)
      );
    }

    if (coverage.delivery_type === 'self_shipping') {
      // Check if any user address state matches vendor's coverage states (case-insensitive)
      return userAddresses.some(addr => 
        coverage.coverage_states.some(s => 
          s.toLowerCase() === addr.state.toLowerCase()
        )
      );
    }

    return true;
  };

  /**
   * Get the delivery type label for a vendor
   */
  const getVendorDeliveryType = (vendorId: string | null): string | null => {
    if (!vendorId) return null;
    const coverage = vendorCoverages.find(v => v.user_id === vendorId);
    if (!coverage) return null;
    
    switch (coverage.delivery_type) {
      case 'in_hand': return 'In-Hand Delivery';
      case 'self_shipping': return 'Self Shipping';
      case 'auto_shipping': return 'Auto Shipping';
      default: return null;
    }
  };

  return { isProductAvailable, getVendorDeliveryType, loaded };
}
