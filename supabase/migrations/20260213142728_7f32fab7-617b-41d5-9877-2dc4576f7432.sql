
-- Add delivery type columns to vendor_profiles
ALTER TABLE public.vendor_profiles 
ADD COLUMN delivery_type text NOT NULL DEFAULT 'auto_shipping',
ADD COLUMN coverage_pincodes text[] DEFAULT '{}',
ADD COLUMN coverage_states text[] DEFAULT '{}';

-- Add comment for clarity
COMMENT ON COLUMN public.vendor_profiles.delivery_type IS 'in_hand, self_shipping, or auto_shipping';
COMMENT ON COLUMN public.vendor_profiles.coverage_pincodes IS 'Pincodes for in-hand delivery';
COMMENT ON COLUMN public.vendor_profiles.coverage_states IS 'States for self-shipping';
