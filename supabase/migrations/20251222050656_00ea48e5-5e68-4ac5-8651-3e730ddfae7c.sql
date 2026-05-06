-- Add referral system columns to promoter_applications
ALTER TABLE public.promoter_applications 
ADD COLUMN IF NOT EXISTS referred_by_promoter_id uuid REFERENCES public.profiles(id);

-- Create promoter_referrals table for tracking referral relationships
CREATE TABLE IF NOT EXISTS public.promoter_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_promoter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_promoter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code text,
  tier_at_referral text DEFAULT 'free',
  current_tier text DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_promoter_id)
);

-- Create referral_commission_settings for admin to configure rates
CREATE TABLE IF NOT EXISTS public.referral_commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default referral commission settings
INSERT INTO public.referral_commission_settings (setting_key, setting_value, description)
VALUES 
  ('subscription_referral_percent', '{"percent": 10}'::jsonb, 'Percentage of subscription amount credited to referrer when referred promoter upgrades to premium'),
  ('sales_referral_percent', '{"percent": 5}'::jsonb, 'Percentage of referred promoter sales commission credited to referrer'),
  ('tier3_bonus_percent', '{"percent": 2}'::jsonb, 'Extra fixed percentage credited when referred promoter reaches tier 3'),
  ('return_period_days', '{"digital": 0, "physical": 7}'::jsonb, 'Return period in days before commission becomes withdrawable')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.promoter_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commission_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for promoter_referrals
CREATE POLICY "Users can view their own referrals" ON public.promoter_referrals
  FOR SELECT USING (auth.uid() = referrer_promoter_id OR auth.uid() = referred_promoter_id);

CREATE POLICY "Admins and managers can view all referrals" ON public.promoter_referrals
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can manage referrals" ON public.promoter_referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert referrals" ON public.promoter_referrals
  FOR INSERT WITH CHECK (true);

-- RLS policies for referral_commission_settings
CREATE POLICY "Anyone can view referral settings" ON public.referral_commission_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage referral settings" ON public.referral_commission_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Add referral_earning_type to earnings table for tracking referral commissions
ALTER TABLE public.earnings 
ADD COLUMN IF NOT EXISTS earning_type text DEFAULT 'direct_sale',
ADD COLUMN IF NOT EXISTS referral_source_promoter_id uuid,
ADD COLUMN IF NOT EXISTS referral_source_subscription_id uuid;