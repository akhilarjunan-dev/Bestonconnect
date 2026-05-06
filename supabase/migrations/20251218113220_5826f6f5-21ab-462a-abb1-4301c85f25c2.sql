-- Create storage bucket for video ads
INSERT INTO storage.buckets (id, name, public) VALUES ('video-ads', 'video-ads', true);

-- Create policies for video ad uploads (promoters can upload)
CREATE POLICY "Promoters can upload video ads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'video-ads' 
  AND auth.uid() IS NOT NULL
);

-- Create policies for public video viewing
CREATE POLICY "Video ads are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'video-ads');

-- Allow promoters to update their own videos
CREATE POLICY "Promoters can update their own video ads"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'video-ads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow promoters to delete their own videos
CREATE POLICY "Promoters can delete their own video ads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'video-ads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create video_ads table
CREATE TABLE public.video_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promoter_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on video_ads
ALTER TABLE public.video_ads ENABLE ROW LEVEL SECURITY;

-- Allow public to view active video ads
CREATE POLICY "Anyone can view active video ads"
ON public.video_ads
FOR SELECT
USING (status = 'active');

-- Allow promoters to manage their own videos
CREATE POLICY "Promoters can insert their own video ads"
ON public.video_ads
FOR INSERT
WITH CHECK (auth.uid() = promoter_id);

CREATE POLICY "Promoters can update their own video ads"
ON public.video_ads
FOR UPDATE
USING (auth.uid() = promoter_id);

CREATE POLICY "Promoters can delete their own video ads"
ON public.video_ads
FOR DELETE
USING (auth.uid() = promoter_id);

-- Managers and admins can view all video ads
CREATE POLICY "Managers can view all video ads"
ON public.video_ads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('manager', 'admin')
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_video_ads_updated_at
BEFORE UPDATE ON public.video_ads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();