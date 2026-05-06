ALTER TABLE public.banners 
ADD COLUMN IF NOT EXISTS position text NOT NULL DEFAULT 'top',
ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';