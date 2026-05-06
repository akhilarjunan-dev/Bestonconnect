-- Add delivery address fields to profiles table for auto-fill during shopping
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS delivery_name text,
ADD COLUMN IF NOT EXISTS delivery_phone text,
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_city text,
ADD COLUMN IF NOT EXISTS delivery_state text,
ADD COLUMN IF NOT EXISTS delivery_pincode text;

-- Add referred_by_promoter_id to track which promoter referred a buyer
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referred_by_promoter_id uuid REFERENCES public.profiles(id);

-- Create an index for faster lookups of buyers by promoter
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_promoter ON public.profiles(referred_by_promoter_id);