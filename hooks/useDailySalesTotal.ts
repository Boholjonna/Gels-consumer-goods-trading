import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export function useDailySalesTotal() {
  const { user } = useAuth();
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const userId = user.id;

    async function fetchDailySales() {
      try {
        // Get today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayStr = today.toISOString();
        const tomorrowStr = tomorrow.toISOString();

        // Count today's active orders immediately when the collector creates them.
        const { data, error } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('collector_id', userId)
          .neq('status', 'cancelled')
          .gte('created_at', todayStr)
          .lt('created_at', tomorrowStr);

        if (error) throw error;

        const total = (data || []).reduce((sum, order) => sum + order.total_amount, 0);
        setTotalSales(total);
      } catch (error) {
        console.error('Error fetching daily sales:', error);
        setTotalSales(0);
      } finally {
        setLoading(false);
      }
    }

    fetchDailySales();

    // Subscribe to realtime updates for this collector's orders
    const subscription = supabase
      .channel('daily-sales')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `collector_id=eq.${userId}`,
        },
        () => {
          fetchDailySales();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  return { totalSales, loading };
}
