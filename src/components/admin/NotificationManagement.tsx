import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Bell, Send, Users, User, History, RefreshCw, AlertCircle, CheckCircle, Info, AlertTriangle, Save, FileText, Trash2, Code, Eye, BarChart3, TrendingUp, Mail, MailOpen } from 'lucide-react';
import { formatDistanceToNow, format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Progress } from '@/components/ui/progress';

// Available placeholders organized by category
const PLACEHOLDER_CATEGORIES = [
  {
    category: 'Customer',
    placeholders: [
      { key: '{{customer_name}}', description: 'Customer full name', sample: 'John Doe' },
      { key: '{{customer_email}}', description: 'Customer email address', sample: 'john@example.com' },
    ],
  },
  {
    category: 'Order',
    placeholders: [
      { key: '{{order_id}}', description: 'Order ID', sample: 'ORD-12345' },
      { key: '{{order_total}}', description: 'Order total amount', sample: '₹2,499' },
      { key: '{{product_name}}', description: 'Product name', sample: 'Premium Wireless Headphones' },
      { key: '{{quantity}}', description: 'Order quantity', sample: '2' },
      { key: '{{tracking_number}}', description: 'Shipping tracking number', sample: 'TRK789456123' },
    ],
  },
  {
    category: 'Date/Time',
    placeholders: [
      { key: '{{date}}', description: 'Current date', sample: format(new Date(), 'MMMM d, yyyy') },
      { key: '{{time}}', description: 'Current time', sample: format(new Date(), 'h:mm a') },
    ],
  },
];

// Flatten for easy lookup
const ALL_PLACEHOLDERS = PLACEHOLDER_CATEGORIES.flatMap(cat => cat.placeholders);

// Sample values for preview
const SAMPLE_VALUES: Record<string, string> = ALL_PLACEHOLDERS.reduce((acc, p) => {
  acc[p.key] = p.sample;
  return acc;
}, {} as Record<string, string>);

interface UserOption {
  id: string;
  email: string;
  full_name: string | null;
}

interface NotificationHistory {
  title: string;
  message: string;
  type: string;
  created_at: string;
  recipient_count: number;
}

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

interface NotificationAnalytics {
  total: number;
  read: number;
  unread: number;
  openRate: number;
  byType: Record<string, { total: number; read: number }>;
  last7Days: { date: string; sent: number; read: number }[];
  avgReadTime: number; // in hours
}

export function NotificationManagement() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistory[]>([]);
  
  // Analytics state
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Templates state
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  
  // Form state
  const [targetType, setTargetType] = useState<'single' | 'all' | 'role'>('single');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'promoter' | 'manager'>('buyer');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  useEffect(() => {
    fetchUsers();
    fetchNotificationHistory();
    fetchTemplates();
    fetchAnalytics();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .order('full_name', { ascending: true });

    if (error) {
      toast.error('Failed to fetch users');
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    
    try {
      // Fetch all notifications for analytics
      const { data: allNotifications, error } = await supabase
        .from('notifications')
        .select('id, is_read, type, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const notifications = allNotifications || [];
      const total = notifications.length;
      const read = notifications.filter(n => n.is_read).length;
      const unread = total - read;
      const openRate = total > 0 ? (read / total) * 100 : 0;

      // Group by type
      const byType: Record<string, { total: number; read: number }> = {};
      notifications.forEach(n => {
        if (!byType[n.type]) {
          byType[n.type] = { total: 0, read: 0 };
        }
        byType[n.type].total++;
        if (n.is_read) byType[n.type].read++;
      });

      // Last 7 days breakdown
      const last7Days: { date: string; sent: number; read: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        
        const dayNotifications = notifications.filter(n => {
          const createdAt = new Date(n.created_at);
          return createdAt >= dayStart && createdAt <= dayEnd;
        });

        last7Days.push({
          date: format(date, 'MMM d'),
          sent: dayNotifications.length,
          read: dayNotifications.filter(n => n.is_read).length,
        });
      }

      setAnalytics({
        total,
        read,
        unread,
        openRate,
        byType,
        last7Days,
        avgReadTime: 2.5, // Placeholder - would need timestamp tracking for actual value
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
    
    setAnalyticsLoading(false);
  };

  const fetchNotificationHistory = async () => {
    setHistoryLoading(true);
    
    // Fetch recent notifications and group by title, message, type within 1 minute window
    const { data, error } = await supabase
      .from('notifications')
      .select('title, message, type, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      toast.error('Failed to fetch notification history');
      setHistoryLoading(false);
      return;
    }

    // Group notifications by title + message + type within 1 minute
    const grouped = new Map<string, NotificationHistory>();
    
    (data || []).forEach((notification) => {
      const timestamp = new Date(notification.created_at);
      // Round to the nearest minute for grouping
      timestamp.setSeconds(0, 0);
      const key = `${notification.title}|${notification.message}|${notification.type}|${timestamp.toISOString()}`;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.recipient_count += 1;
      } else {
        grouped.set(key, {
          title: notification.title,
          message: notification.message,
          type: notification.type,
          created_at: notification.created_at,
          recipient_count: 1,
        });
      }
    });

    // Convert to array and sort by date
    const historyArray = Array.from(grouped.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20); // Show last 20 unique notifications

    setNotificationHistory(historyArray);
    setHistoryLoading(false);
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch templates:', error);
    } else {
      setTemplates(data || []);
    }
    setTemplatesLoading(false);
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !title.trim() || !message.trim()) {
      toast.error('Template name, title, and message are required');
      return;
    }

    setSavingTemplate(true);
    const { error } = await supabase
      .from('notification_templates')
      .insert({
        name: templateName.trim(),
        title: title.trim(),
        message: message.trim(),
        type: notificationType,
      });

    if (error) {
      toast.error('Failed to save template');
    } else {
      toast.success('Template saved successfully');
      setTemplateName('');
      setSaveTemplateOpen(false);
      fetchTemplates();
    }
    setSavingTemplate(false);
  };

  const loadTemplate = (template: NotificationTemplate) => {
    setTitle(template.title);
    setMessage(template.message);
    setNotificationType(template.type as 'info' | 'success' | 'warning' | 'error');
    toast.success(`Loaded template: ${template.name}`);
  };

  const deleteTemplate = async (templateId: string) => {
    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
      fetchTemplates();
    }
  };

  // Replace placeholders with actual values
  const replacePlaceholders = (text: string, user: UserOption, orderData?: Record<string, string>) => {
    const now = new Date();
    let result = text
      .replace(/\{\{customer_name\}\}/g, user.full_name || 'Valued Customer')
      .replace(/\{\{customer_email\}\}/g, user.email)
      .replace(/\{\{date\}\}/g, format(now, 'MMMM d, yyyy'))
      .replace(/\{\{time\}\}/g, format(now, 'h:mm a'));

    // Replace order-related placeholders if provided
    if (orderData) {
      result = result
        .replace(/\{\{order_id\}\}/g, orderData.order_id || '')
        .replace(/\{\{order_total\}\}/g, orderData.order_total || '')
        .replace(/\{\{product_name\}\}/g, orderData.product_name || '')
        .replace(/\{\{quantity\}\}/g, orderData.quantity || '')
        .replace(/\{\{tracking_number\}\}/g, orderData.tracking_number || '');
    }

    return result;
  };

  // Replace with sample values for preview
  const replaceWithSampleValues = (text: string) => {
    let result = text;
    ALL_PLACEHOLDERS.forEach(p => {
      result = result.replace(new RegExp(p.key.replace(/[{}]/g, '\\$&'), 'g'), p.sample);
    });
    return result;
  };

  const insertPlaceholder = (placeholder: string) => {
    setMessage(prev => prev + placeholder);
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    if (targetType === 'single' && !selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setSending(true);

    try {
      let targetUsers: UserOption[] = [];

      if (targetType === 'single') {
        const user = users.find(u => u.id === selectedUserId);
        if (user) targetUsers = [user];
      } else if (targetType === 'all') {
        targetUsers = users;
      } else if (targetType === 'role') {
        // Fetch users with the selected role
        const { data: roleUsers, error: roleError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', selectedRole);

        if (roleError) {
          throw new Error('Failed to fetch users with role');
        }

        const roleUserIds = (roleUsers || []).map(r => r.user_id);
        targetUsers = users.filter(u => roleUserIds.includes(u.id));
      }

      if (targetUsers.length === 0) {
        toast.error('No users found to notify');
        setSending(false);
        return;
      }

      // Insert notifications for all target users with personalized placeholders
      const notifications = targetUsers.map(user => ({
        user_id: user.id,
        title: replacePlaceholders(title.trim(), user),
        message: replacePlaceholders(message.trim(), user),
        type: notificationType,
        is_read: false
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        throw new Error('Failed to send notifications');
      }

      toast.success(`Notification sent to ${targetUsers.length} user(s)`);
      
      // Reset form
      setTitle('');
      setMessage('');
      setSelectedUserId('');
      setNotificationType('info');
      
      // Refresh history
      fetchNotificationHistory();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      warning: 'secondary',
      error: 'destructive',
      info: 'outline',
    };
    return (
      <Badge variant={variants[type] || 'outline'} className="capitalize">
        {type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Analytics Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Notification Analytics
              </CardTitle>
              <CardDescription>
                Track engagement and delivery metrics
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Mail className="h-4 w-4" />
                    <span className="text-xs font-medium">Total Sent</span>
                  </div>
                  <p className="text-2xl font-bold">{analytics.total.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MailOpen className="h-4 w-4" />
                    <span className="text-xs font-medium">Opened</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{analytics.read.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Bell className="h-4 w-4" />
                    <span className="text-xs font-medium">Unread</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">{analytics.unread.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium">Open Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">{analytics.openRate.toFixed(1)}%</p>
                </div>
              </div>

              {/* Open Rate Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Overall Open Rate</span>
                  <span className="font-medium">{analytics.openRate.toFixed(1)}%</span>
                </div>
                <Progress value={analytics.openRate} className="h-2" />
              </div>

              {/* Last 7 Days Chart */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Last 7 Days</h4>
                <div className="grid grid-cols-7 gap-2">
                  {analytics.last7Days.map((day) => {
                    const maxSent = Math.max(...analytics.last7Days.map(d => d.sent), 1);
                    const height = (day.sent / maxSent) * 100;
                    const readHeight = day.sent > 0 ? (day.read / day.sent) * height : 0;
                    
                    return (
                      <div key={day.date} className="flex flex-col items-center gap-1">
                        <div className="relative w-full h-20 bg-muted rounded-t flex flex-col justify-end overflow-hidden">
                          <div 
                            className="w-full bg-primary/30 transition-all"
                            style={{ height: `${height}%` }}
                          >
                            <div 
                              className="w-full bg-primary transition-all"
                              style={{ height: `${day.sent > 0 ? (day.read / day.sent) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{day.date}</span>
                        <span className="text-xs font-medium">{day.sent}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-primary" />
                    <span>Opened</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-primary/30" />
                    <span>Sent</span>
                  </div>
                </div>
              </div>

              {/* By Type Breakdown */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">By Notification Type</h4>
                <div className="grid gap-2">
                  {Object.entries(analytics.byType).map(([type, stats]) => {
                    const typeOpenRate = stats.total > 0 ? (stats.read / stats.total) * 100 : 0;
                    return (
                      <div key={type} className="flex items-center gap-3 p-2 rounded border">
                        {getTypeIcon(type)}
                        <span className="capitalize font-medium text-sm flex-1">{type}</span>
                        <span className="text-sm text-muted-foreground">{stats.total} sent</span>
                        <Badge variant={typeOpenRate > 50 ? 'default' : 'secondary'}>
                          {typeOpenRate.toFixed(0)}% opened
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">No analytics data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Create Manual Notification
          </CardTitle>
          <CardDescription>
            Send notifications to individual users, all users, or users by role. Users with browser notifications enabled will receive real-time push alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target Type Selection */}
          <div className="space-y-2">
            <Label>Send To</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as 'single' | 'all' | 'role')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Single User
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    All Users
                  </div>
                </SelectItem>
                <SelectItem value="role">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    By Role
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User Selection (for single user) */}
          {targetType === 'single' && (
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading users...</div>
                  ) : users.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No users found</div>
                  ) : (
                    users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Role Selection (for by role) */}
          {targetType === 'role' && (
            <div className="space-y-2">
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'buyer' | 'promoter' | 'manager')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyers</SelectItem>
                  <SelectItem value="promoter">Promoters</SelectItem>
                  <SelectItem value="manager">Managers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notification Type */}
          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select value={notificationType} onValueChange={(v) => setNotificationType(v as 'info' | 'success' | 'warning' | 'error')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Notification title... (use placeholders like {{customer_name}})"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Notification message... (use placeholders like {{customer_name}})"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          {/* Available Placeholders */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Available Placeholders
            </Label>
            <div className="space-y-3">
              {PLACEHOLDER_CATEGORIES.map((category) => (
                <div key={category.category} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{category.category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {category.placeholders.map((placeholder) => (
                      <Button
                        key={placeholder.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs font-mono h-7 px-2"
                        onClick={() => insertPlaceholder(placeholder.key)}
                        title={`${placeholder.description} (e.g., ${placeholder.sample})`}
                      >
                        {placeholder.key}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click a placeholder to insert it into the message. Hover for examples.
            </p>
          </div>

          {/* Live Preview */}
          {(title.trim() || message.trim()) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Live Preview
              </Label>
              <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
                <div className="flex items-start gap-3">
                  {getTypeIcon(notificationType)}
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">
                      {replaceWithSampleValues(title) || 'Notification Title'}
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {replaceWithSampleValues(message) || 'Notification message will appear here...'}
                    </p>
                  </div>
                  {getTypeBadge(notificationType)}
                </div>
                <p className="text-xs text-muted-foreground italic mt-2 pt-2 border-t">
                  Sample values shown above. Actual values will be used when sent.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleSendNotification} 
              disabled={sending || !title.trim() || !message.trim()}
              className="flex-1"
            >
              {sending ? (
                'Sending...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setSaveTemplateOpen(true)}
              disabled={!title.trim() || !message.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notification Templates
              </CardTitle>
              <CardDescription>
                Saved templates for quick reuse
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchTemplates}
              disabled={templatesLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${templatesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">No templates saved yet</p>
              <p className="text-xs">Fill out the form above and click "Save as Template"</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template) => (
                <div 
                  key={template.id}
                  className="border rounded-lg p-4 space-y-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">{template.title}</p>
                    </div>
                    {getTypeBadge(template.type)}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{template.message}</p>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => loadTemplate(template)}
                      className="flex-1"
                    >
                      Use Template
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteTemplate(template.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Template Dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Welcome Message, Order Update..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Preview:</p>
              <p className="text-sm"><strong>Title:</strong> {title}</p>
              <p className="text-sm"><strong>Type:</strong> {notificationType}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{message}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Notification History
              </CardTitle>
              <CardDescription>
                Recently sent notifications with recipient counts
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchNotificationHistory}
              disabled={historyLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notificationHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">No notifications sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Message</TableHead>
                    <TableHead className="text-center">Recipients</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificationHistory.map((notification, index) => (
                    <TableRow key={`${notification.title}-${notification.created_at}-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(notification.type)}
                          <span className="hidden sm:inline">{getTypeBadge(notification.type)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[150px] truncate">
                        {notification.title}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">
                        {notification.message}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit mx-auto">
                          <Users className="h-3 w-3" />
                          {notification.recipient_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        <span className="hidden sm:inline">
                          {format(new Date(notification.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                        <span className="sm:hidden">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}