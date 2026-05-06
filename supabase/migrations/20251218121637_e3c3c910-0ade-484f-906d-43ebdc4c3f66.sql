-- Create subscription settings table for admin to manage pricing
CREATE TABLE public.subscription_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;

-- Admin can manage settings
CREATE POLICY "Admins can manage subscription settings"
  ON public.subscription_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view settings (for displaying prices)
CREATE POLICY "Anyone can view subscription settings"
  ON public.subscription_settings
  FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_subscription_settings_updated_at
  BEFORE UPDATE ON public.subscription_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subscription pricing
INSERT INTO public.subscription_settings (setting_key, setting_value, description) VALUES
  ('premium_pricing', '{"monthly": 999, "annual": 9990}', 'Premium promoter subscription pricing in INR');