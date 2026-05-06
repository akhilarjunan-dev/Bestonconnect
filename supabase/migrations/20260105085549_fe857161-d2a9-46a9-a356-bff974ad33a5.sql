-- Add promoter_code_discount column for shopper discount when using promoter code
ALTER TABLE public.products 
ADD COLUMN promoter_code_discount numeric DEFAULT 0;

-- Add comment to clarify the columns
COMMENT ON COLUMN public.products.promoter_code_discount IS 'Discount percentage shoppers get when using a promoter code (e.g., 5 for 5%)';
COMMENT ON COLUMN public.products.commission_rate IS 'Commission percentage promoters earn when their code is used (e.g., 25 for 25%)';