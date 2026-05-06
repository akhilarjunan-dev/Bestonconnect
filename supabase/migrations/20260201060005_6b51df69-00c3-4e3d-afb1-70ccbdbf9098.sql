-- Add COD (Cash on Delivery) settings to order_settings table
INSERT INTO public.order_settings (setting_key, setting_value, description)
VALUES (
  'cod_enabled',
  '{"enabled": true, "min_order_amount": 0, "max_order_amount": 10000}'::jsonb,
  'Cash on Delivery settings - enable/disable COD and set order amount limits'
)
ON CONFLICT (setting_key) DO NOTHING;