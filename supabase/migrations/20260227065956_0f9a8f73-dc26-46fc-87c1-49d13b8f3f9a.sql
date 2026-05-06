
-- Fix 1: Add UPDATE and DELETE policies for managers/admins on video_ads
CREATE POLICY "Admins and managers can update video ads"
ON public.video_ads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete video ads"
ON public.video_ads
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- Fix 2: Add showcase subscription columns to showcase_shops for monthly/yearly model
ALTER TABLE public.showcase_shops
ADD COLUMN IF NOT EXISTS subscription_plan_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_auto_renew boolean DEFAULT false;
