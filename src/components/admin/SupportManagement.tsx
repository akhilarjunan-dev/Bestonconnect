import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageCircle, Send, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface SupportMessage {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
  user_email?: string;
}

export function SupportManagement() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch support messages');
      console.error(error);
    } else {
      // Fetch user emails
      const userIds = [...new Set((data || []).map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const emailMap = new Map(profiles?.map(p => [p.id, p.email]));
      
      setMessages((data || []).map(m => ({
        ...m,
        user_email: emailMap.get(m.user_id) || 'Unknown'
      })));
    }
    setLoading(false);
  };

  const handleReply = async () => {
    if (!selectedMessage || !reply.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('support_messages')
      .update({
        admin_reply: reply,
        admin_replied_by: user?.id,
        admin_replied_at: new Date().toISOString(),
        status: 'resolved'
      })
      .eq('id', selectedMessage.id);

    if (error) {
      setSubmitting(false);
      toast.error('Failed to send reply');
      console.error(error);
      return;
    }

    // Send email notification
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          type: 'support_reply',
          data: {
            user_email: selectedMessage.user_email,
            subject: selectedMessage.subject,
            original_message: selectedMessage.message,
            admin_reply: reply
          }
        }
      });
      console.log('Support reply email sent');
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Don't block the UI, just log the error
    }

    setSubmitting(false);
    toast.success('Reply sent successfully');
    setSelectedMessage(null);
    setReply('');
    fetchMessages();
  };

  const updateStatus = async (messageId: string, status: string) => {
    const { error } = await supabase
      .from('support_messages')
      .update({ status })
      .eq('id', messageId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      fetchMessages();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" />Open</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3" />In Progress</Badge>;
      case 'resolved':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Resolved</Badge>;
      case 'closed':
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredMessages = statusFilter === 'all' 
    ? messages 
    : messages.filter(m => m.status === statusFilter);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Loading support messages...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Customer Support
          </CardTitle>
          <CardDescription>Manage customer support messages</CardDescription>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Messages</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {filteredMessages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No support messages found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.map((message) => (
                <TableRow key={message.id}>
                  <TableCell className="text-sm">
                    {format(new Date(message.created_at), 'PP')}
                  </TableCell>
                  <TableCell className="text-sm">{message.user_email}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{message.subject}</TableCell>
                  <TableCell>{getStatusBadge(message.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedMessage(message);
                          setReply(message.admin_reply || '');
                        }}
                      >
                        View
                      </Button>
                      {message.status === 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(message.id, 'in_progress')}
                        >
                          Start
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Reply Dialog */}
        <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Support Message</DialogTitle>
            </DialogHeader>
            {selectedMessage && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">From:</span>
                    <p className="font-medium">{selectedMessage.user_email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">{format(new Date(selectedMessage.created_at), 'PPpp')}</p>
                  </div>
                </div>
                
                <div>
                  <span className="text-muted-foreground text-sm">Subject:</span>
                  <p className="font-medium">{selectedMessage.subject}</p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <span className="text-xs text-muted-foreground">Message:</span>
                  <p className="mt-1 whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>

                {selectedMessage.admin_reply && (
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <span className="text-xs text-muted-foreground">Admin Reply:</span>
                    <p className="mt-1 whitespace-pre-wrap">{selectedMessage.admin_reply}</p>
                    {selectedMessage.admin_replied_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Replied on {format(new Date(selectedMessage.admin_replied_at), 'PPpp')}
                      </p>
                    )}
                  </div>
                )}

                {selectedMessage.status !== 'resolved' && selectedMessage.status !== 'closed' && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Type your reply..."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={4}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => updateStatus(selectedMessage.id, 'closed')}>
                        Close Without Reply
                      </Button>
                      <Button onClick={handleReply} disabled={submitting} className="gap-2">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
