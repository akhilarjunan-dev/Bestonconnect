-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for KYC documents bucket
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins and managers can view all KYC documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')));

-- Create commission_rules table for admin configuration
CREATE TABLE public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  rule_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_type, rule_key)
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage commission rules
CREATE POLICY "Admins can manage commission rules"
ON public.commission_rules FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Everyone can view active rules (for calculations)
CREATE POLICY "Anyone can view active rules"
ON public.commission_rules FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default commission rules
INSERT INTO public.commission_rules (rule_type, rule_key, rule_value, description) VALUES
('surge_multiplier', '1-2', '{"multiplier": 1.0, "min_sales": 1, "max_sales": 2}', 'Base multiplier for 1-2 daily sales'),
('surge_multiplier', '3-5', '{"multiplier": 1.1, "min_sales": 3, "max_sales": 5}', '1.1x for 3-5 daily sales'),
('surge_multiplier', '6-10', '{"multiplier": 1.25, "min_sales": 6, "max_sales": 10}', '1.25x for 6-10 daily sales'),
('surge_multiplier', '11-20', '{"multiplier": 1.5, "min_sales": 11, "max_sales": 20}', '1.5x for 11-20 daily sales'),
('surge_multiplier', '20+', '{"multiplier": 2.0, "min_sales": 21, "max_sales": null}', '2x for 20+ daily sales'),
('streak_bonus', '3-day', '{"bonus_percent": 5, "days_required": 3}', '5% bonus for 3-day streak'),
('streak_bonus', '7-day', '{"bonus_percent": 10, "days_required": 7}', '10% bonus for 7-day streak'),
('streak_bonus', '15-day', '{"bonus_percent": 20, "days_required": 15}', '20% bonus for 15-day streak'),
('streak_bonus', '30-day', '{"bonus_percent": 35, "days_required": 30}', '35% bonus for 30-day streak'),
('registration_bonus', 'free', '{"amount": 10}', 'Registration bonus for free tier'),
('registration_bonus', 'premium', '{"amount": 25}', 'Registration bonus for premium tier'),
('performance_bonus', 'tier_1', '{"bonus_percent": 5, "min_cr": 3}', '5% bonus if CR >= 3%'),
('performance_bonus', 'tier_2', '{"bonus_percent": 10, "min_cr": 5}', '10% bonus if CR >= 5%'),
('performance_bonus', 'tier_3', '{"bonus_percent": 20, "min_cr": 8}', '20% bonus if CR >= 8%'),
('promoter_tier', 'free', '{"withdrawal_min": 500, "link_limit": 5, "commission_validity_months": 2}', 'Free tier settings'),
('promoter_tier', 'premium', '{"withdrawal_min": 0, "link_limit": null, "commission_validity_months": 12}', 'Premium tier settings');

-- Add promoter_tier column to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'promoter_tier') THEN
    ALTER TABLE public.profiles ADD COLUMN promoter_tier public.promoter_tier DEFAULT NULL;
  END IF;
END $$;