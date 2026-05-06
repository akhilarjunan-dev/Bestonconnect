-- Drop existing admin-only policy for products management
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

-- Create new policies for vendors
-- Vendors can view their own products (active or not)
CREATE POLICY "Vendors can view own products"
ON public.products
FOR SELECT
USING (auth.uid() = vendor_id);

-- Vendors can create products (automatically assigned to them)
CREATE POLICY "Vendors can create products"
ON public.products
FOR INSERT
WITH CHECK (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- Vendors can update their own products
CREATE POLICY "Vendors can update own products"
ON public.products
FOR UPDATE
USING (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- Vendors can delete their own products
CREATE POLICY "Vendors can delete own products"
ON public.products
FOR DELETE
USING (auth.uid() = vendor_id AND has_role(auth.uid(), 'vendor'::app_role));

-- Admins can still manage all products
CREATE POLICY "Admins can manage all products"
ON public.products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));