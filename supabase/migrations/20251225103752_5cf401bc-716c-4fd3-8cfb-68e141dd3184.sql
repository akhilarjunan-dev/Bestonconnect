-- Create a promoter referral relationship: Akhil (premium) as referrer, Promoter1 as referred
INSERT INTO public.promoter_referrals (referrer_promoter_id, referred_promoter_id, current_tier, tier_at_referral, referral_code)
VALUES ('31a4fa23-41e7-4dfe-b08a-acdd2a4c6ad2', '0402b157-7e87-46c1-aefe-c9c275573f88', 'free', 'free', '31A4FA23')
ON CONFLICT (referred_promoter_id) DO NOTHING;

-- Create a sample sale for the referred promoter (Promoter1)
INSERT INTO public.sales (
  referral_link_id,
  product_id,
  promoter_id,
  buyer_email,
  quantity,
  unit_price,
  total_amount,
  commission_rate,
  commission_amount,
  status
) VALUES (
  'f7eece4b-01be-45e4-95c7-6bd95bd4709c',  -- Promoter1's referral link
  '4a55de09-67e9-4d13-9126-c899e8a61adf',  -- Product: LED Headlamp
  '0402b157-7e87-46c1-aefe-c9c275573f88',  -- Promoter1
  'testbuyer@example.com',
  2,
  599.25,
  1198.50,
  5,
  59.93,  -- 5% of 1198.50
  'completed'
);

-- Create the direct sale earning for Promoter1
INSERT INTO public.earnings (
  promoter_id,
  base_amount,
  amount,
  sale_date,
  status,
  return_window_ends_at,
  earning_type,
  formula_breakdown
) VALUES (
  '0402b157-7e87-46c1-aefe-c9c275573f88',
  59.93,
  59.93,
  CURRENT_DATE,
  'pending',
  NOW() + INTERVAL '7 days',
  'direct_sale',
  '{"product_id": "4a55de09-67e9-4d13-9126-c899e8a61adf", "unit_price": 599.25, "quantity": 2, "commission_rate": 5}'::jsonb
);

-- Create the referral earning for the referrer (Akhil) - 5% of Promoter1's commission
INSERT INTO public.earnings (
  promoter_id,
  base_amount,
  amount,
  sale_date,
  status,
  return_window_ends_at,
  earning_type,
  referral_source_promoter_id,
  formula_breakdown
) VALUES (
  '31a4fa23-41e7-4dfe-b08a-acdd2a4c6ad2',  -- Akhil (referrer)
  3.00,  -- 5% of 59.93 = ~3.00
  3.00,
  CURRENT_DATE,
  'pending',
  NOW() + INTERVAL '7 days',
  'sales_referral',
  '0402b157-7e87-46c1-aefe-c9c275573f88',  -- Referred promoter
  '{"referred_promoter_id": "0402b157-7e87-46c1-aefe-c9c275573f88", "original_commission": 59.93, "referral_percent": 5}'::jsonb
);

-- Create a second sample: Digital product sale with immediate approval
INSERT INTO public.sales (
  referral_link_id,
  product_id,
  promoter_id,
  buyer_email,
  quantity,
  unit_price,
  total_amount,
  commission_rate,
  commission_amount,
  status
) VALUES (
  'f7eece4b-01be-45e4-95c7-6bd95bd4709c',
  '57efbd4c-f483-4225-8b7b-5cc7322810f8',  -- Digital product
  '0402b157-7e87-46c1-aefe-c9c275573f88',  -- Promoter1
  'testbuyer2@example.com',
  1,
  10,
  10,
  10,
  1.00,
  'completed'
);

-- Direct earning for digital product (approved immediately)
INSERT INTO public.earnings (
  promoter_id,
  base_amount,
  amount,
  sale_date,
  status,
  return_window_ends_at,
  earning_type,
  formula_breakdown
) VALUES (
  '0402b157-7e87-46c1-aefe-c9c275573f88',
  1.00,
  1.00,
  CURRENT_DATE,
  'approved',  -- Digital products are immediately approved
  NOW(),
  'direct_sale',
  '{"product_id": "57efbd4c-f483-4225-8b7b-5cc7322810f8", "unit_price": 10, "quantity": 1, "commission_rate": 10, "is_digital": true}'::jsonb
);

-- Referral earning for Akhil from digital product sale
INSERT INTO public.earnings (
  promoter_id,
  base_amount,
  amount,
  sale_date,
  status,
  return_window_ends_at,
  earning_type,
  referral_source_promoter_id,
  formula_breakdown
) VALUES (
  '31a4fa23-41e7-4dfe-b08a-acdd2a4c6ad2',
  0.05,  -- 5% of 1.00
  0.05,
  CURRENT_DATE,
  'approved',
  NOW(),
  'sales_referral',
  '0402b157-7e87-46c1-aefe-c9c275573f88',
  '{"referred_promoter_id": "0402b157-7e87-46c1-aefe-c9c275573f88", "original_commission": 1.00, "referral_percent": 5, "is_digital": true}'::jsonb
);