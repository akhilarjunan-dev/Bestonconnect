-- Add shipping charge and tax rate columns to products table
ALTER TABLE public.products
ADD COLUMN shipping_charge numeric DEFAULT 0,
ADD COLUMN tax_rate numeric DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.products.shipping_charge IS 'Shipping charge in INR for this product';
COMMENT ON COLUMN public.products.tax_rate IS 'Tax rate percentage (e.g., 18 for 18% GST)';

-- Create support_messages table for customer care functionality
CREATE TABLE public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  admin_replied_by uuid,
  admin_replied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on support_messages
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own support messages
CREATE POLICY "Users can view own support messages"
ON public.support_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create support messages
CREATE POLICY "Users can create support messages"
ON public.support_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all support messages
CREATE POLICY "Admins can view all support messages"
ON public.support_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins and managers can update support messages (for replying)
CREATE POLICY "Admins and managers can update support messages"
ON public.support_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));