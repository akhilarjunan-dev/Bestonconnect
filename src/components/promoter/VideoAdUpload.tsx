import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Video, Upload, Trash2, Loader2, Eye, Play, Image as ImageIcon } from 'lucide-react';

interface Product {
  id: string;
  name: string;
}

interface VideoAd {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  product_id: string | null;
  status: string;
  views_count: number;
  created_at: string;
}

export function VideoAdUpload() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [videoAds, setVideoAds] = useState<VideoAd[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [promoterTier, setPromoterTier] = useState<'free' | 'premium'>('free');

  // Free tier limit: 1 video upload, Premium: unlimited
  const FREE_TIER_VIDEO_LIMIT = 1;
  const canUploadVideo = promoterTier === 'premium' || videoAds.length < FREE_TIER_VIDEO_LIMIT;

  useEffect(() => {
    fetchProducts();
    fetchVideoAds();
    fetchPromoterTier();
  }, [user]);

  const fetchPromoterTier = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('promoter_tier')
      .eq('id', user.id)
      .maybeSingle();
    if (data?.promoter_tier) {
      setPromoterTier(data.promoter_tier as 'free' | 'premium');
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true);
    if (data) setProducts(data);
  };

  const fetchVideoAds = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('video_ads')
      .select('*')
      .eq('promoter_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) setVideoAds(data as VideoAd[]);
    setLoading(false);
  };

  const validateVideoDuration = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 20) {
          toast.error('Video must be 20 seconds or less');
          resolve(false);
        } else {
          resolve(true);
        }
      };
      
      video.onerror = () => {
        toast.error('Could not read video file');
        resolve(false);
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const generateThumbnail = (videoFile: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadeddata = () => {
        // Seek to 1 second or 25% of video duration (whichever is smaller)
        video.currentTime = Math.min(1, video.duration * 0.25);
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(video.src);
            setThumbnailPreview(blob ? URL.createObjectURL(blob) : null);
            resolve(blob);
          }, 'image/jpeg', 0.8);
        } else {
          resolve(null);
        }
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setVideoFile(file);
    setThumbnailPreview(null);
    
    if (file) {
      // Validate duration
      const isValid = await validateVideoDuration(file);
      if (!isValid) {
        setVideoFile(null);
        return;
      }
      
      // Generate thumbnail preview
      await generateThumbnail(file);
    }
  };

  const handleUpload = async () => {
    if (!user || !videoFile || !title) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!canUploadVideo) {
      toast.error('Free tier allows only 1 video. Upgrade to Premium for unlimited uploads!');
      return;
    }

    setUploading(true);
    try {
      // Upload video to storage
      const fileExt = videoFile.name.split('.').pop();
      const timestamp = Date.now();
      const videoFileName = `${user.id}/${timestamp}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('video-ads')
        .upload(videoFileName, videoFile);

      if (uploadError) throw uploadError;

      // Get public URL for video
      const { data: videoUrlData } = supabase.storage
        .from('video-ads')
        .getPublicUrl(videoFileName);

      // Generate and upload thumbnail
      let thumbnailUrl: string | null = null;
      const thumbnailBlob = await generateThumbnail(videoFile);
      
      if (thumbnailBlob) {
        const thumbnailFileName = `${user.id}/${timestamp}_thumb.jpg`;
        const { error: thumbUploadError } = await supabase.storage
          .from('video-ads')
          .upload(thumbnailFileName, thumbnailBlob, { contentType: 'image/jpeg' });
        
        if (!thumbUploadError) {
          const { data: thumbUrlData } = supabase.storage
            .from('video-ads')
            .getPublicUrl(thumbnailFileName);
          thumbnailUrl = thumbUrlData.publicUrl;
        }
      }

      // Create video ad record
      const { error: insertError } = await supabase
        .from('video_ads')
        .insert({
          promoter_id: user.id,
          title,
          description: description || null,
          video_url: videoUrlData.publicUrl,
          thumbnail_url: thumbnailUrl,
          product_id: selectedProduct || null,
          status: 'active'
        });

      if (insertError) throw insertError;

      toast.success('Video uploaded successfully!');
      setTitle('');
      setDescription('');
      setSelectedProduct('');
      setVideoFile(null);
      setThumbnailPreview(null);
      fetchVideoAds();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const deleteVideo = async (id: string, videoUrl: string, thumbnailUrl: string | null) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('video_ads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Try to delete video from storage
      const videoPath = videoUrl.split('/video-ads/')[1];
      if (videoPath) {
        await supabase.storage.from('video-ads').remove([videoPath]);
      }

      // Try to delete thumbnail from storage
      if (thumbnailUrl) {
        const thumbPath = thumbnailUrl.split('/video-ads/')[1];
        if (thumbPath) {
          await supabase.storage.from('video-ads').remove([thumbPath]);
        }
      }

      toast.success('Video deleted');
      fetchVideoAds();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete video');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tier Limit Warning */}
      {promoterTier === 'free' && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Video className="h-5 w-5 text-warning" />
              <div className="flex-1">
                <p className="font-medium">Free Tier Limit</p>
                <p className="text-sm text-muted-foreground">
                  You can upload {FREE_TIER_VIDEO_LIMIT} video ad. Upgrade to Premium for unlimited uploads!
                </p>
              </div>
              <Badge variant="outline">{videoAds.length}/{FREE_TIER_VIDEO_LIMIT}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Video Ad
          </CardTitle>
          <CardDescription>
            Upload short promotional videos (max 20 seconds) to attract more buyers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Video Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your video"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product">Link to Product (optional)</Label>
            <Select value={selectedProduct} onValueChange={(value) => setSelectedProduct(value === 'none' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No product</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="video">Video File *</Label>
            <Input
              id="video"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Max duration: 20 seconds. Supported formats: MP4, MOV, WebM
            </p>
          </div>

          {thumbnailPreview && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Auto-generated Thumbnail Preview
              </Label>
              <div className="relative w-48 aspect-video rounded-lg overflow-hidden border bg-muted">
                <img 
                  src={thumbnailPreview} 
                  alt="Thumbnail preview" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || !title || !videoFile || !canUploadVideo}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Video className="w-4 h-4 mr-2" />
                Upload Video
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            My Video Ads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : videoAds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No video ads yet. Upload your first video above!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {videoAds.map((video) => (
                <Card key={video.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted relative group">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:hidden"
                      />
                    ) : null}
                    <video
                      src={video.video_url}
                      className={`w-full h-full object-cover ${video.thumbnail_url ? 'hidden group-hover:block' : ''}`}
                      controls
                      poster={video.thumbnail_url || undefined}
                    />
                    {video.thumbnail_url && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:hidden">
                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold truncate">{video.title}</h4>
                        {video.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {video.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={video.status === 'active' ? 'default' : 'secondary'}>
                            {video.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {video.views_count}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteVideo(video.id, video.video_url, video.thumbnail_url)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}