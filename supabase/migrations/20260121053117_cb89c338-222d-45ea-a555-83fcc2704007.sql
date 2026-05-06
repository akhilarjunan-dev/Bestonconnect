-- Update the create_earning_from_sale trigger function to auto-approve commissions
-- Only manual decline needed for fraudulent/suspicious activity
CREATE OR REPLACE FUNCTION public.create_earning_from_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  return_window_days INTEGER := 7;
  product_is_digital BOOLEAN := false;
BEGIN
  -- Only create earning for completed sales
  IF NEW.status = 'completed' THEN
    -- Check if product is digital
    SELECT COALESCE(is_digital, false) INTO product_is_digital
    FROM public.products
    WHERE id = NEW.product_id;
    
    -- Auto-approve all commissions (only manual decline if fraud detected)
    -- This simplifies the workflow - managers only need to reject suspicious activity
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
      NEW.promoter_id,
      NEW.commission_amount,
      NEW.commission_amount,
      NEW.created_at::date,
      'approved', -- Auto-approve - only decline manually if fraud
      CASE 
        WHEN product_is_digital THEN NEW.created_at -- No return window for digital
        ELSE NEW.created_at + (return_window_days || ' days')::interval
      END,
      'direct_sale',
      jsonb_build_object(
        'sale_id', NEW.id,
        'product_id', NEW.product_id,
        'unit_price', NEW.unit_price,
        'quantity', NEW.quantity,
        'commission_rate', NEW.commission_rate,
        'auto_approved', true
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