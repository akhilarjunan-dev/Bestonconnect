-- Add Delhivery shipping fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delhivery_order_id text,
ADD COLUMN IF NOT EXISTS delhivery_waybill text,
ADD COLUMN IF NOT EXISTS delhivery_status text,
ADD COLUMN IF NOT EXISTS shipping_created_at timestamp with time zone;

-- Create vendor_profiles table to store vendor pickup addresses
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  pickup_address text NOT NULL,
  pickup_city text NOT NULL,
  pickup_state text NOT NULL,
  pickup_pincode text NOT NULL,
  pickup_phone text NOT NULL,
  pickup_email text,
  gstin text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on vendor_profiles
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Vendor can view and update their own profile
CREATE POLICY "Vendors can view own profile" 
ON public.vendor_profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Vendors can update own profile" 
ON public.vendor_profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Vendors can insert own profile" 
ON public.vendor_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can view all vendor profiles
CREATE POLICY "Admins can view all vendor profiles" 
ON public.vendor_profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create delhivery_settings table for admin configuration
CREATE TABLE IF NOT EXISTS public.delhivery_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delhivery_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage delhivery settings" 
ON public.delhivery_settings 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.delhivery_settings (setting_key, setting_value, description) VALUES
('auto_create_shipment', '{"enabled": false}', 'Automatically create Delhivery shipment when order is placed'),
('default_pickup_location', '{}', 'Default pickup location for orders without vendor'),
('delhivery_enabled', '{"enabled": false}', 'Enable/disable Delhivery integration')
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger for updated_at on vendor_profiles
CREATE TRIGGER update_vendor_profiles_updated_at
BEFORE UPDATE ON public.vendor_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on delhivery_settings
CREATE TRIGGER update_delhivery_settings_updated_at
BEFORE UPDATE ON public.delhivery_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster order lookups by delhivery waybill
CREATE INDEX IF NOT EXISTS idx_orders_delhivery_waybill ON public.orders(delhivery_waybill) WHERE delhivery_waybill IS NOT NULL;