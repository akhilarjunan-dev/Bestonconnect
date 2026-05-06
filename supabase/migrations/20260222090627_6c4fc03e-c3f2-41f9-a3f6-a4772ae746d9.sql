
-- Add user_id column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Backfill user_id from profiles where buyer_email matches
UPDATE public.orders o
SET user_id = p.id
FROM public.profiles p
WHERE LOWER(o.buyer_email) = LOWER(p.email)
AND o.user_id IS NULL;

-- Drop the dangerous "Buyers can view their own orders" policy
DROP POLICY IF EXISTS "Buyers can view their own orders" ON public.orders;

-- Drop the dangerous "Anyone can create orders" policy  
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

-- Drop the "Buyers can cancel their own orders" policy (will recreate with user_id)
DROP POLICY IF EXISTS "Buyers can cancel their own orders" ON public.orders;

-- Create secure policy: Buyers can only view their own orders (via user_id)
CREATE POLICY "Buyers can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create secure policy: Only authenticated users can create orders for themselves
CREATE POLICY "Authenticated users can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow service role (edge functions) to insert orders without user_id restriction
-- Edge functions use service_role_key which bypasses RLS, so no extra policy needed

-- Recreate cancel policy using user_id
CREATE POLICY "Buyers can cancel their own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() 
  AND status IN ('pending', 'processing')
)
WITH CHECK (status = 'cancelled');
