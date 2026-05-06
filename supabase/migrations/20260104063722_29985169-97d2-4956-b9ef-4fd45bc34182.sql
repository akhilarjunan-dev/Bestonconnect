-- Add refund processing columns to return_requests table
ALTER TABLE public.return_requests
ADD COLUMN IF NOT EXISTS refund_amount numeric,
ADD COLUMN IF NOT EXISTS refund_transaction_id text,
ADD COLUMN IF NOT EXISTS refund_method text,
ADD COLUMN IF NOT EXISTS refund_processed_at timestamp with time zone;