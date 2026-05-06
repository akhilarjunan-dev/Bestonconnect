-- Add status column to product_reviews for moderation
ALTER TABLE public.product_reviews 
ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add user_id column for authenticated reviews (email verification)
ALTER TABLE public.product_reviews 
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Anyone can create reviews" ON public.product_reviews;

-- Create new RLS policies
-- Only show approved reviews publicly
CREATE POLICY "Anyone can view approved reviews" 
ON public.product_reviews 
FOR SELECT 
USING (status = 'approved');

-- Admins and managers can view all reviews for moderation
CREATE POLICY "Admins and managers can view all reviews" 
ON public.product_reviews 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Only authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews" 
ON public.product_reviews 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Admins and managers can update reviews (for moderation)
CREATE POLICY "Admins and managers can moderate reviews" 
ON public.product_reviews 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create index for faster moderation queries
CREATE INDEX idx_product_reviews_status ON public.product_reviews(status);