-- Create sales table to track purchases via referral links
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  promoter_id UUID NOT NULL,
  buyer_email TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  refunded_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Policies for sales table
CREATE POLICY "Admins and managers can view all sales"
ON public.sales
FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Promoters can view own sales"
ON public.sales
FOR SELECT
USING (auth.uid() = promoter_id);

CREATE POLICY "System can insert sales"
ON public.sales
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update sales"
ON public.sales
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_sales_promoter_id ON public.sales(promoter_id);
CREATE INDEX idx_sales_referral_link_id ON public.sales(referral_link_id);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);

-- Function to auto-create earnings when sale is recorded
CREATE OR REPLACE FUNCTION public.create_earning_from_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  return_window_days INTEGER := 7;
BEGIN
  -- Only create earning for completed sales
  IF NEW.status = 'completed' THEN
    INSERT INTO public.earnings (
      promoter_id,
      base_amount,
      amount,
      sale_date,
      status,
      return_window_ends_at,
      formula_breakdown
    ) VALUES (
      NEW.promoter_id,
      NEW.commission_amount,
      NEW.commission_amount,
      NEW.created_at::date,
      'pending',
      NEW.created_at + (return_window_days || ' days')::interval,
      jsonb_build_object(
        'sale_id', NEW.id,
        'product_id', NEW.product_id,
        'unit_price', NEW.unit_price,
        'quantity', NEW.quantity,
        'commission_rate', NEW.commission_rate
      )
    );
    
    -- Update referral link conversions
    IF NEW.referral_link_id IS NOT NULL THEN
      UPDATE public.referral_links
      SET conversions = COALESCE(conversions, 0) + 1
      WHERE id = NEW.referral_link_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create earnings
CREATE TRIGGER on_sale_created
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.create_earning_from_sale();

-- Function to update referral link clicks
CREATE OR REPLACE FUNCTION public.increment_referral_clicks(link_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.referral_links
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE referral_links.link_code = increment_referral_clicks.link_code;
END;
$$;