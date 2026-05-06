
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_grams integer DEFAULT 500;

COMMENT ON COLUMN public.products.weight_grams IS 'Product weight in grams for shipping slab calculation';
