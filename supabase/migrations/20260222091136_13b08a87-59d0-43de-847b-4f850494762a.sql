
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Admins and managers can view all profiles" ON public.profiles;

-- Admin-only full access to profiles (needed for KYC verification, payouts)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create a secure function for managers to view profiles WITHOUT sensitive fields
CREATE OR REPLACE FUNCTION public.get_profiles_for_manager()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  promoter_tier public.promoter_tier,
  kyc_status public.approval_status,
  created_at timestamptz,
  updated_at timestamptz,
  referred_by_promoter_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id, p.email, p.full_name, p.phone, p.avatar_url,
    p.promoter_tier, p.kyc_status, p.created_at, p.updated_at,
    p.referred_by_promoter_id
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'manager'::app_role)
     OR public.has_role(auth.uid(), 'admin'::app_role);
$$;
