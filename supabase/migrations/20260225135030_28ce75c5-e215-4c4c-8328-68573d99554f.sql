
-- 1. Add product_type to products table (default, custom_order, enquiry)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'default';

-- 2. Add whatsapp_number to vendor_profiles
ALTER TABLE public.vendor_profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- 3. Create custom_form_fields table for vendor-defined form fields per product
CREATE TABLE public.custom_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- text, textarea, number, dropdown, checkbox, file
  field_options jsonb, -- for dropdown: ["Option1", "Option2"]
  is_required boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_form_fields ENABLE ROW LEVEL SECURITY;

-- Vendors can manage form fields for their own products
CREATE POLICY "Vendors can manage own product form fields"
ON public.custom_form_fields
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = custom_form_fields.product_id 
    AND p.vendor_id = auth.uid()
  )
);

-- Admins can manage all form fields
CREATE POLICY "Admins can manage all form fields"
ON public.custom_form_fields
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view form fields for active products
CREATE POLICY "Anyone can view form fields"
ON public.custom_form_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = custom_form_fields.product_id 
    AND p.is_active = true
  )
);

-- 4. Create custom_orders table for custom order submissions
CREATE TABLE public.custom_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  user_id uuid NOT NULL,
  vendor_id uuid,
  form_data jsonb NOT NULL, -- stores { field_label: value } pairs
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, in_progress, completed, cancelled
  admin_notes text,
  vendor_notes text,
  total_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own custom orders"
ON public.custom_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own custom orders"
ON public.custom_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Vendors can view orders for their products"
ON public.custom_orders FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update orders for their products"
ON public.custom_orders FOR UPDATE
USING (auth.uid() = vendor_id);

CREATE POLICY "Admins can manage all custom orders"
ON public.custom_orders FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_custom_orders_updated_at
BEFORE UPDATE ON public.custom_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Create product_enquiries table for enquiry tracking
CREATE TABLE public.product_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  user_id uuid NOT NULL,
  vendor_id uuid,
  customer_name text,
  customer_phone text,
  message text,
  whatsapp_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create enquiries"
ON public.product_enquiries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own enquiries"
ON public.product_enquiries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Vendors can view enquiries for their products"
ON public.product_enquiries FOR SELECT
USING (auth.uid() = vendor_id);

CREATE POLICY "Admins can view all enquiries"
ON public.product_enquiries FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));
