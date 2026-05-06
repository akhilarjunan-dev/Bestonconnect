import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Video, CheckCircle, XCircle, Loader2, Eye, Clock, Play, Ban, Trash2 } from 'lucide-react';

interface VideoAd {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  status: string;
  promoter_id: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
}

export function VideoModeration() {
  const [videos, setVideos] = useState<VideoAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoAd | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('video_ads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load videos');
      setLoading(false);
      return;
    }

    // Fetch promoter profiles
    if (data && data.length > 0) {
      const promoterIds = [...new Set(data.map(v => v.promoter_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', promoterIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      data.forEach((v: any) => {
        v.profiles = profileMap.get(v.promoter_id);
      });
    }

    setVideos(data || []);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    
    const { error } = await supabase
      .from('video_ads')
      .update({ status: 'active' })
      .eq('id', id);

    if (error) {
      toast.error('Failed to approve video');
    } else {
      toast.success('Video approved and now visible to public');
      fetchVideos();
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!selectedVideoId) return;
    
    setActionLoading(selectedVideoId);
    
    const { error } = await supabase
      .from('video_ads')
      .update({ status: 'rejected' })
      .eq('id', selectedVideoId);

    if (error) {
      toast.error('Failed to reject video');
    } else {
      toast.success('Video rejected');
      fetchVideos();
    }
    
    setSelectedVideoId(null);
    setRejectReason('');
    setActionLoading(null);
  };

  const handleDisable = async (id: string) => {
    setActionLoading(id);
    
    const { error } = await supabase
      .from('video_ads')
      .update({ status: 'disabled' })
      .eq('id', id);

    if (error) {
      toast.error('Failed to disable video');
    } else {
      toast.success('Video disabled');
      fetchVideos();
    }
    setActionLoading(null);
  };

  const handleEnable = async (id: string) => {
    setActionLoading(id);
    
    const { error } = await supabase
      .from('video_ads')
      .update({ status: 'active' })
      .eq('id', id);

    if (error) {
      toast.error('Failed to enable video');
    } else {
      toast.success('Video enabled');
      fetchVideos();
    }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    
    // Get video details first to delete from storage
    const video = videos.find(v => v.id === id);
    
    const { error } = await supabase
      .from('video_ads')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete video');
    } else {
      // Try to delete from storage too
      if (video) {
        const videoPath = video.video_url.split('/').pop();
        const thumbPath = video.thumbnail_url?.split('/').pop();
        
        if (videoPath) {
          await supabase.storage.from('video-ads').remove([videoPath]);
        }
        if (thumbPath) {
          await supabase.storage.from('video-ads').remove([thumbPath]);
        }
      }
      toast.success('Video deleted permanently');
      fetchVideos();
    }
    setDeleteVideoId(null);
    setActionLoading(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'active':
        return <Badge variant="default" className="bg-earnings"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'disabled':
        return <Badge variant="outline" className="text-muted-foreground"><Ban className="w-3 h-3 mr-1" />Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = videos.filter(v => v.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5" />
          Video Moderation
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-1">{pendingCount}</Badge>
          )}
        </CardTitle>
        <CardDescription>Review and approve promoter video ads</CardDescription>
      </CardHeader>
      <CardContent>
        {videos.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No videos to moderate</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Promoter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div 
                        className="relative w-20 h-12 rounded-lg bg-muted overflow-hidden cursor-pointer group"
                        onClick={() => setPreviewVideo(video)}
                      >
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium line-clamp-1">{video.title}</p>
                        {video.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{video.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{video.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{video.profiles?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(video.status)}</TableCell>
                  <TableCell>{new Date(video.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewVideo(video)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {video.status === 'pending' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleApprove(video.id)}
                          disabled={actionLoading === video.id}
                        >
                          {actionLoading === video.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-earnings" />
                          )}
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedVideoId(video.id)}
                            >
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Video</DialogTitle>
                              <DialogDescription>
                                Provide a reason for rejecting this video.
                              </DialogDescription>
                            </DialogHeader>
                            <Textarea
                              placeholder="Reason for rejection..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <DialogFooter>
                              <Button variant="destructive" onClick={handleReject}>
                                Reject
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    {video.status === 'active' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDisable(video.id)}
                        disabled={actionLoading === video.id}
                        title="Disable video"
                      >
                        {actionLoading === video.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Ban className="w-4 h-4 text-warning" />
                        )}
                      </Button>
                    )}
                    {(video.status === 'disabled' || video.status === 'rejected') && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEnable(video.id)}
                        disabled={actionLoading === video.id}
                        title="Enable video"
                      >
                        {actionLoading === video.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-earnings" />
                        )}
                      </Button>
                    )}
                    <AlertDialog open={deleteVideoId === video.id} onOpenChange={(open) => !open && setDeleteVideoId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setDeleteVideoId(video.id)}
                          title="Delete video permanently"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Video Permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. The video will be permanently deleted from the system and storage.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(video.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Video Preview Dialog */}
        <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{previewVideo?.title}</DialogTitle>
              {previewVideo?.description && (
                <DialogDescription>{previewVideo.description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {previewVideo && (
                <video 
                  src={previewVideo.video_url} 
                  controls 
                  className="w-full h-full"
                  autoPlay
                />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                By: {previewVideo?.profiles?.full_name || 'Unknown'}
              </div>
              {previewVideo?.status === 'pending' && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (previewVideo) handleApprove(previewVideo.id);
                      setPreviewVideo(null);
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2 text-earnings" />
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      if (previewVideo) setSelectedVideoId(previewVideo.id);
                      setPreviewVideo(null);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
