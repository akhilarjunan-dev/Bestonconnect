import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Check, X, Star, Loader2, MessageSquare } from 'lucide-react';

interface Review {
  id: string;
  product_id: string;
  rating: number;
  review_text: string | null;
  buyer_email: string;
  status: string;
  created_at: string;
  admin_response: string | null;
  admin_response_at: string | null;
  product?: {
    name: string;
  };
}

export function ReviewModeration() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [respondingReview, setRespondingReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('product_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (reviewsError) {
      toast.error('Failed to fetch reviews');
      console.error(reviewsError);
      setLoading(false);
      return;
    }

    const productIds = [...new Set((reviewsData || []).map(r => r.product_id))];
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);

    const reviewsWithProducts = (reviewsData || []).map(review => ({
      ...review,
      product: productsData?.find(p => p.id === review.product_id)
    }));

    setReviews(reviewsWithProducts);
    setLoading(false);
  };

  const handleModerate = async (reviewId: string, status: 'approved' | 'rejected') => {
    setProcessingId(reviewId);
    
    const { error } = await supabase
      .from('product_reviews')
      .update({ status })
      .eq('id', reviewId);

    if (error) {
      toast.error('Failed to update review');
      console.error(error);
    } else {
      toast.success(`Review ${status}`);
      fetchReviews();
    }
    
    setProcessingId(null);
  };

  const handleOpenResponse = (review: Review) => {
    setRespondingReview(review);
    setResponseText(review.admin_response || '');
  };

  const handleSubmitResponse = async () => {
    if (!respondingReview || !user) return;
    
    setSubmittingResponse(true);
    
    const { error } = await supabase
      .from('product_reviews')
      .update({
        admin_response: responseText.trim() || null,
        admin_response_at: responseText.trim() ? new Date().toISOString() : null,
        admin_response_by: responseText.trim() ? user.id : null
      })
      .eq('id', respondingReview.id);

    if (error) {
      toast.error('Failed to save response');
      console.error(error);
    } else {
      toast.success(responseText.trim() ? 'Response saved' : 'Response removed');
      setRespondingReview(null);
      setResponseText('');
      fetchReviews();
    }
    
    setSubmittingResponse(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-earnings">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const pendingCount = reviews.filter(r => r.status === 'pending').length;

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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Review Moderation
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} pending</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Approve or reject product reviews and add public responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reviews to moderate
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">
                      {review.product?.name || 'Unknown Product'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? 'fill-warning text-warning'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {review.review_text || <span className="text-muted-foreground">No text</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {review.buyer_email}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(review.status)}
                    </TableCell>
                    <TableCell>
                      {review.admin_response ? (
                        <Badge variant="outline" className="text-primary">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Has response
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {review.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-earnings border-earnings hover:bg-earnings/10"
                              onClick={() => handleModerate(review.id, 'approved')}
                              disabled={processingId === review.id}
                            >
                              {processingId === review.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => handleModerate(review.id, 'rejected')}
                              disabled={processingId === review.id}
                            >
                              {processingId === review.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleModerate(review.id, 'pending' as any)}
                            disabled={processingId === review.id}
                          >
                            Reset
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenResponse(review)}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!respondingReview} onOpenChange={(open) => !open && setRespondingReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
          </DialogHeader>
          {respondingReview && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < respondingReview.rating
                          ? 'fill-warning text-warning'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm">{respondingReview.review_text || 'No review text'}</p>
                <p className="text-xs text-muted-foreground mt-2">— {respondingReview.buyer_email}</p>
              </div>
              
              <Textarea
                placeholder="Write your public response to this review..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This response will be visible publicly alongside the review.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondingReview(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitResponse} disabled={submittingResponse}>
              {submittingResponse && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {responseText.trim() ? 'Save Response' : 'Remove Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}