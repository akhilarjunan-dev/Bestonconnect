-- Add return shipping columns to return_requests table
ALTER TABLE public.return_requests 
ADD COLUMN IF NOT EXISTS shipping_label_url text,
ADD COLUMN IF NOT EXISTS return_tracking_number text,
ADD COLUMN IF NOT EXISTS return_carrier text,
ADD COLUMN IF NOT EXISTS return_tracking_url text,
ADD COLUMN IF NOT EXISTS pickup_scheduled_at timestamptz,
ADD COLUMN IF NOT EXISTS pickup_address jsonb;