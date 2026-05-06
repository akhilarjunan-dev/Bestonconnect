-- Create daily_sales_tiers table for promoter commission calculation
CREATE TABLE public.daily_sales_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_sales INTEGER NOT NULL,
  max_sales INTEGER,
  commission_percent NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_sales_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tiers
CREATE POLICY "Anyone can view active tiers"
ON public.daily_sales_tiers
FOR SELECT
USING (is_active = true);

-- Admins can manage tiers
CREATE POLICY "Admins can manage tiers"
ON public.daily_sales_tiers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_daily_sales_tiers_updated_at
BEFORE UPDATE ON public.daily_sales_tiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default tiers
INSERT INTO public.daily_sales_tiers (tier_name, min_sales, max_sales, commission_percent, display_order) VALUES
  ('Tier 1', 1, 5, 10, 1),
  ('Tier 2', 6, 10, 25, 2),
  ('Tier 3', 11, 20, 50, 3),
  ('Tier 4', 21, 50, 75, 4),
  ('Tier 5', 51, NULL, 100, 5);