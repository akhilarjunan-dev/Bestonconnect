-- Add admin_response column to product_reviews
ALTER TABLE public.product_reviews
ADD COLUMN admin_response TEXT,
ADD COLUMN admin_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN admin_response_by UUID REFERENCES auth.users(id);