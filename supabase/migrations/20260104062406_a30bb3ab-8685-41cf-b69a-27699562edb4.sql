-- Create order_settings table for configurable time periods
CREATE TABLE public.order_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage order settings"
ON public.order_settings FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view order settings"
ON public.order_settings FOR SELECT
USING (true);

-- Insert default settings
INSERT INTO public.order_settings (setting_key, setting_value, description) VALUES
('return_period_days', '7', 'Number of days after delivery to request return'),
('replacement_period_days', '7', 'Number of days after delivery to request replacement'),
('cancel_period_hours', '24', 'Number of hours after delivery to cancel order');

-- Create return_requests table
CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('return', 'replacement', 'cancellation')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

-- Policies for return_requests
CREATE POLICY "Users can view own return requests"
ON public.return_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own return requests"
ON public.return_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view all return requests"
ON public.return_requests FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update return requests"
ON public.return_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Add trigger for updated_at
CREATE TRIGGER update_order_settings_updated_at
BEFORE UPDATE ON public.order_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_return_requests_updated_at
BEFORE UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();