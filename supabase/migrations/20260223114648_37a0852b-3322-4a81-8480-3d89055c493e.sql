
-- Showcase shops table for both vendors and promoters
CREATE TABLE public.showcase_shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shop_name TEXT NOT NULL UNIQUE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('vendor', 'promoter')),
  banner_url TEXT,
  selected_product_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  trial_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 days'),
  is_premium BOOLEAN DEFAULT false,
  premium_paid_at TIMESTAMP WITH TIME ZONE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.showcase_shops ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active showcase shops"
ON public.showcase_shops FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can create own showcase shop"
ON public.showcase_shops FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own showcase shop"
ON public.showcase_shops FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all showcase shops"
ON public.showcase_shops FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_showcase_shops_updated_at
BEFORE UPDATE ON public.showcase_shops
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for showcase banners
INSERT INTO storage.buckets (id, name, public) VALUES ('showcase-banners', 'showcase-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view showcase banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'showcase-banners');

CREATE POLICY "Authenticated users can upload showcase banners"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'showcase-banners' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own showcase banners"
ON storage.objects FOR UPDATE
USING (bucket_id = 'showcase-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own showcase banners"
ON storage.objects FOR DELETE
USING (bucket_id = 'showcase-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
