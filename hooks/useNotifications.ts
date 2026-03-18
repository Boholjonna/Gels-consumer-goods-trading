import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getNotifications, markAsRead, markAllAsRead } from '@/services/notifications.service';
import { getCachedNotifications, cacheNotifications } from '@/lib/offline-cache';
import type { Notification } from '@/types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
      cacheNotifications(data);
    } catch {
      const cached = await getCachedNotifications();
      if (cached && cached.length > 0) setNotifications(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime: prepend new notifications as they arrive
  useEffect(() => {
    let userId: string | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      userId = session.user.id;

      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  const handleMarkAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await markAsRead(id);
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllAsRead();
  }, []);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    refetch: fetch,
  };
}
