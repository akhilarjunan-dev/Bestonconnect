-- Create webhook_events table for persistent idempotency and auditing
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'processed',
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT
);

-- Add index for quick lookups
CREATE INDEX idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX idx_webhook_events_event_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events (for debugging)
CREATE POLICY "Admins can view webhook events"
ON public.webhook_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert webhook events (service role)
CREATE POLICY "System can insert webhook events"
ON public.webhook_events
FOR INSERT
WITH CHECK (true);