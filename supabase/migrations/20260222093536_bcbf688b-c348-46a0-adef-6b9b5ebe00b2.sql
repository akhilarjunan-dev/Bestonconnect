
-- Create storage bucket for category images
INSERT INTO storage.buckets (id, name, public) VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view category images
CREATE POLICY "Anyone can view category images"
ON storage.objects FOR SELECT
USING (bucket_id = 'category-images');

-- Allow admins to upload category images
CREATE POLICY "Admins can upload category images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to update category images
CREATE POLICY "Admins can update category images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to delete category images
CREATE POLICY "Admins can delete category images"
ON storage.objects FOR DELETE
USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
