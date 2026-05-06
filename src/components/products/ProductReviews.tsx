import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Star, MessageSquare, Loader2, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  buyer_email: string;
  created_at: string;
  admin_response: string | null;
  admin_response_at: string | null;
}

interface ProductReviewsProps {
  productId: string;
  productName: string;
}

function StarRating({ 
  rating, 
  onRate, 
  interactive = false,
  size = 'md'
}: { 
  rating: number; 
  onRate?: (rating: number) => void;
  interactive?: boolean;
  size?: 'sm' | 'md';
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          className={cn(
            "transition-colors",
            interactive && "cursor-pointer hover:scale-110"
          )}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          onClick={() => onRate?.(star)}
        >
          <Star
            className={cn(
              sizeClass,
              (hovered || rating) >= star
                ? "fill-warning text-warning"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId, productName }: ProductReviewsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 0,
    review_text: ''
  });

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please sign in to leave a review');
      return;
    }

    if (newReview.rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: productId,
        rating: newReview.rating,
        review_text: newReview.review_text.trim() || null,
        buyer_email: user.email || '',
        user_id: user.id
      });

    if (error) {
      toast.error('Failed to submit review');
      console.error(error);
    } else {
      toast.success('Review submitted! It will appear after moderation.');
      setNewReview({ rating: 0, review_text: '' });
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Reviews
          </CardTitle>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <StarRating rating={Math.round(averageRating)} size="sm" />
              <span className="text-sm text-muted-foreground">
                {averageRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>
        {user ? (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowForm(!showForm)}
          >
            Write a Review
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/auth')}
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign in to Review
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Review Form */}
        {showForm && user && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-4">
            <h4 className="font-medium">Rate {productName}</h4>
            <p className="text-sm text-muted-foreground">
              Reviewing as {user.email}
            </p>
            
            <div className="space-y-2">
              <Label>Your Rating *</Label>
              <StarRating 
                rating={newReview.rating} 
                onRate={(r) => setNewReview(prev => ({ ...prev, rating: r }))}
                interactive
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-text">Your Review (optional)</Label>
              <Textarea
                id="review-text"
                placeholder="Share your experience with this product..."
                value={newReview.review_text}
                onChange={(e) => setNewReview(prev => ({ ...prev, review_text: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmitReview} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Review
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No reviews yet. Be the first to review this product!
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} size="sm" />
                    <span className="text-sm text-muted-foreground">
                      {maskEmail(review.buyer_email)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.review_text && (
                  <p className="text-sm">{review.review_text}</p>
                )}
                {review.admin_response && (
                  <div className="ml-4 p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">Store Response</Badge>
                      {review.admin_response_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.admin_response_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{review.admin_response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}