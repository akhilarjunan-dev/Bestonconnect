
-- Add is_featured and is_hot_deal flags to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hot_deal boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_is_hot_deal ON public.products(is_hot_deal) WHERE is_hot_deal = true;
