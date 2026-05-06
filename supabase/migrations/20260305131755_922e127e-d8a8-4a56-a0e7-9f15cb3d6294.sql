
ALTER TABLE public.home_sections 
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS selected_category_ids uuid[] DEFAULT '{}'::uuid[];
