import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Eye, ShoppingBag, ChevronLeft, Volume2, VolumeX, Play, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface VideoAd {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  product_id: string | null;
  promoter_id: string;
  views_count: number;
  created_at: string;
  products?: {
    id: string;
    name: string;
    price: number;
    image_urls: string[] | null;
  };
  promoter_profile?: {
    full_name: string | null;
  };
}

export default function VideoAds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videoAds, setVideoAds] = useState<VideoAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewedVideos, setViewedVideos] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideoAds();
  }, [user]);

  const fetchVideoAds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('video_ads')
      .select(`
        *,
        products (
          id, name, price, image_urls
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching videos:', error);
      setLoading(false);
      return;
    }

    let sortedVideos = (data || []) as VideoAd[];

    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referred_by_promoter_id')
        .eq('id', user.id)
        .single();

      if (profileData?.referred_by_promoter_id) {
        const rid = profileData.referred_by_promoter_id;
        sortedVideos.sort((a, b) => {
          if (a.promoter_id === rid && b.promoter_id !== rid) return -1;
          if (a.promoter_id !== rid && b.promoter_id === rid) return 1;
          return 0;
        });
      }
    }

    setVideoAds(sortedVideos);
    setLoading(false);
  };

  const incrementViewCount = useCallback(async (videoId: string) => {
    if (viewedVideos.has(videoId)) return;
    setViewedVideos(prev => new Set([...prev, videoId]));
    const video = videoAds.find(v => v.id === videoId);
    if (video) {
      await supabase
        .from('video_ads')
        .update({ views_count: (video.views_count ?? 0) + 1 })
        .eq('id', videoId);
      // Update local state for immediate UI feedback
      setVideoAds(prev => prev.map(v => v.id === videoId ? { ...v, views_count: (v.views_count ?? 0) + 1 } : v));
    }
  }, [viewedVideos, videoAds]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videoAds.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, videoAds.length]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (videoAds.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white">
        <Play className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">No Videos Yet</h2>
        <p className="text-white/60 text-sm mb-6">Check back later for promotional videos.</p>
        <Button variant="outline" className="text-white border-white/30" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-[60] w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60]">
        <h1 className="text-white font-bold text-lg">Reels</h1>
      </div>

      {/* Snap scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {videoAds.map((video, index) => (
          <ReelCard
            key={video.id}
            video={video}
            isActive={index === activeIndex}
            onView={() => incrementViewCount(video.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ReelCard({ video, isActive, onView }: { video: VideoAd; isActive: boolean; onView: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const hasCountedView = useRef(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive) {
      el.currentTime = 0;
      el.play().catch(() => {});
      setPaused(false);
      if (!hasCountedView.current) {
        hasCountedView.current = true;
        onView();
      }
    } else {
      el.pause();
      hasCountedView.current = false;
    }
  }, [isActive]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  };

  const formatViews = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="h-full w-full snap-start relative flex items-center justify-center bg-black">
      {/* Video */}
      <video
        ref={videoRef}
        src={video.video_url}
        className="h-full w-full object-cover"
        loop
        muted={muted}
        playsInline
        onClick={togglePlay}
        poster={video.thumbnail_url || video.products?.image_urls?.[0] || undefined}
      />

      {/* Play/Pause indicator */}
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <Play className={`w-10 h-10 text-white ${paused ? '' : 'hidden'}`} fill="white" />
            {!paused && (
              <div className="flex gap-1.5">
                <div className="w-1.5 h-8 bg-white rounded-full" />
                <div className="w-1.5 h-8 bg-white rounded-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right side actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-6 z-20">
        {/* Views */}
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs mt-1 font-medium">{formatViews(video.views_count ?? 0)}</span>
        </div>

        {/* Mute toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
        >
          {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>

        {/* Shop button */}
        {video.products && (
          <Link to={`/product/${video.product_id}`} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
          </Link>
        )}
      </div>

      {/* Bottom overlay - video info */}
      <div className="absolute bottom-0 left-0 right-14 p-4 pb-8 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <h3 className="text-white font-bold text-base leading-tight">{video.title}</h3>
        {video.description && (
          <p className="text-white/80 text-sm mt-1 line-clamp-2">{video.description}</p>
        )}

        {/* Product card */}
        {video.products && (
          <Link to={`/product/${video.product_id}`} className="block mt-3">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/10">
              {video.products.image_urls?.[0] && (
                <img
                  src={video.products.image_urls[0]}
                  alt={video.products.name}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{video.products.name}</p>
                <p className="text-primary font-bold text-sm">₹{video.products.price}</p>
              </div>
              <ShoppingBag className="w-4 h-4 text-white/60 flex-shrink-0" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
