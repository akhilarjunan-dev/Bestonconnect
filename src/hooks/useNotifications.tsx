import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Json } from '@/integrations/supabase/types';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  metadata?: Json;
}

// Browser push notification helpers
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }
  
  return Notification.permission;
};

export const showBrowserNotification = (title: string, message: string, type: string) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  
  const iconMap: Record<string, string> = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };
  
  const notification = new window.Notification(title, {
    body: message,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: `notification-${Date.now()}`,
    requireInteraction: false,
  });
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
  
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const hasRequestedPermission = useRef(false);

  // Check and request notification permission on mount
  useEffect(() => {
    if (!hasRequestedPermission.current && 'Notification' in window) {
      hasRequestedPermission.current = true;
      if (Notification.permission === 'granted') {
        setPushEnabled(true);
      } else if (Notification.permission === 'default') {
        // Auto-request permission for logged-in users
        requestNotificationPermission().then((permission) => {
          setPushEnabled(permission === 'granted');
        });
      }
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show browser push notification for new notifications
          if (pushEnabled) {
            showBrowserNotification(
              newNotification.title,
              newNotification.message,
              newNotification.type
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, pushEnabled]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const enablePushNotifications = async () => {
    const permission = await requestNotificationPermission();
    setPushEnabled(permission === 'granted');
    return permission === 'granted';
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
    pushEnabled,
    enablePushNotifications,
  };
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'success' | 'info' | 'warning' | 'error' = 'info',
  metadata?: Record<string, any>
) {
  return supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    metadata,
  });
}
