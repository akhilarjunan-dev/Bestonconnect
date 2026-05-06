
-- Add billing token fields to subscriptions for per-period validation
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS billing_token text,
ADD COLUMN IF NOT EXISTS billing_token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
ADD COLUMN IF NOT EXISTS auto_pay_failed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_pay_failed_at timestamp with time zone;

-- Add billing token fields to showcase_shops for vendor lockout
ALTER TABLE public.showcase_shops
ADD COLUMN IF NOT EXISTS billing_token text,
ADD COLUMN IF NOT EXISTS billing_token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS auto_pay_failed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_pay_failed_at timestamp with time zone;

-- Create unique index on billing tokens to prevent reuse
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_billing_token ON public.subscriptions(billing_token) WHERE billing_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_showcase_billing_token ON public.showcase_shops(billing_token) WHERE billing_token IS NOT NULL;
