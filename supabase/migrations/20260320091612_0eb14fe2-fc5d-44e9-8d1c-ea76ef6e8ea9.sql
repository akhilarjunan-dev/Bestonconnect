
-- 1. Add vendor RLS on orders table
CREATE POLICY "Vendors can view orders for their products"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = orders.product_id
      AND p.vendor_id = auth.uid()
    )
  );

-- 2. Add vendor RLS on sales table
CREATE POLICY "Vendors can view sales for their products"
  ON public.sales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = sales.product_id
      AND p.vendor_id = auth.uid()
    )
  );

-- 3. Create vendor_earnings table
CREATE TABLE public.vendor_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  commission_deducted numeric NOT NULL DEFAULT 0,
  net_earning numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own earnings"
  ON public.vendor_earnings FOR SELECT
  USING (auth.uid() = vendor_id);

CREATE POLICY "Admins can manage vendor earnings"
  ON public.vendor_earnings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert vendor earnings"
  ON public.vendor_earnings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update vendor earnings"
  ON public.vendor_earnings FOR UPDATE
  USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_vendor_earnings_updated_at
  BEFORE UPDATE ON public.vendor_earnings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
