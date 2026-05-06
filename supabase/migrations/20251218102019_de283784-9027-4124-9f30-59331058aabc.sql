-- Add new columns to products table for MRP, unit, discount, and digital file
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS mrp numeric,
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'piece',
ADD COLUMN IF NOT EXISTS unit_quantity numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS digital_file_url text;

-- Create orders table for order tracking
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id),
  buyer_email text NOT NULL,
  buyer_name text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_amount numeric NOT NULL,
  delivery_address jsonb,
  is_digital boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  tracking_info jsonb,
  payment_id text,
  order_id text,
  referral_link_id uuid,
  promoter_id uuid,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
CREATE POLICY "Buyers can view their own orders"
ON public.orders FOR SELECT
USING (buyer_email = current_setting('request.headers', true)::json->>'x-buyer-email' OR auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Buyers can cancel their own orders"
ON public.orders FOR UPDATE
USING (status = 'pending');

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for digital products
INSERT INTO storage.buckets (id, name, public) 
VALUES ('digital-products', 'digital-products', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for digital products bucket (admin only upload)
CREATE POLICY "Admins can upload digital products"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'digital-products' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update digital products"
ON storage.objects FOR UPDATE
USING (bucket_id = 'digital-products' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete digital products"
ON storage.objects FOR DELETE
USING (bucket_id = 'digital-products' AND has_role(auth.uid(), 'admin'::app_role));