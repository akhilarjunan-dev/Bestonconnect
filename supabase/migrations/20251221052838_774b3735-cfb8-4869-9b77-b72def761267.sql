-- Create subscriptions table for tracking promoter subscriptions
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'annual'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  amount NUMERIC NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (true);

-- Create manager_passwords table for manager approval passwords
CREATE TABLE public.manager_passwords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manager_passwords ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage manager passwords"
  ON public.manager_passwords FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view own password status"
  ON public.manager_passwords FOR SELECT
  USING (auth.uid() = manager_id);

-- Add transaction_id to withdrawals table
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Create trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_manager_passwords_updated_at
  BEFORE UPDATE ON public.manager_passwords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();