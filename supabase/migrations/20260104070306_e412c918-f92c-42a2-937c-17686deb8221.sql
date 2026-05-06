-- Add 'vendor' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendor';

-- Add vendor_id column to products table to track which vendor owns each product
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES auth.users(id);

-- Create index for better performance on vendor queries
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);