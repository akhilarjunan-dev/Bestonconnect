
-- Add display_order column to categories for ordering
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Add availability_slots JSON column for multiple time windows
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS availability_slots jsonb DEFAULT NULL;

-- Migrate existing single time slot data to the new JSON column
UPDATE public.products
SET availability_slots = jsonb_build_array(
  jsonb_build_object('from', available_from::text, 'to', available_to::text)
)
WHERE available_from IS NOT NULL AND available_to IS NOT NULL;
