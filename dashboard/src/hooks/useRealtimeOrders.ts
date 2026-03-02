import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { apiGet } from '@/lib/api';
import type { Order, PaginatedResponse } from '@/types';

interface UseRealtimeOrdersOptions {
  onNewOrder?: (orderId: string) => void;
}

export function useRealtimeOrders(options?: UseRealtimeOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onNewOrderRef = useRef(options?.onNewOrder);
  onNewOrderRef.current = options?.onNewOrder;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<PaginatedResponse<Order>>('/orders?page_size=100');
      setOrders(result.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Subscribe to realtime order changes
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          // Refetch to get full joined data
          await fetchOrders();
          // Notify about new order
          if (onNewOrderRef.current && payload.new?.id) {
            onNewOrderRef.current(payload.new.id as string);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.new.id
                ? { ...o, ...payload.new as Partial<Order> }
                : o
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}
