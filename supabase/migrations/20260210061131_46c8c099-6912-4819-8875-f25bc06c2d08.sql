-- Fix: Allow buyers to cancel their own pending AND processing orders
-- Drop old restrictive policy
DROP POLICY IF EXISTS "Buyers can cancel their own orders" ON public.orders;

-- Create proper policy that checks user identity via buyer_email matching profile
CREATE POLICY "Buyers can cancel their own orders"
ON public.orders
FOR UPDATE
USING (
  status IN ('pending', 'processing')
  AND buyer_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  status = 'cancelled'
);