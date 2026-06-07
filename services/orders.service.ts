import { supabase } from '@/lib/supabase';
import type { Order, CreateOrderRequest, CreateOrderResponse, PaginatedResponse, OrderFilters } from '@/types';

export async function createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data: result, error } = await supabase.rpc('create_order', {
    p_collector_id: session.user.id,
    p_store_id: data.store_id || null,
    p_notes: data.notes || null,
    p_items: data.items,
  });

  if (error) throw new Error(error.message);
  return result as CreateOrderResponse;
}

export async function getOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
  let query = supabase
    .from('orders')
    .select('*, profiles:collector_id(full_name, email), stores:store_id(name, address, contact_phone), order_items(*)', { count: 'exact' });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.store_id) query = query.eq('store_id', filters.store_id);
  if (filters?.date) {
    query = query.gte('created_at', `${filters.date}T00:00:00`).lt('created_at', `${filters.date}T23:59:59.999`);
  }

  const sortBy = filters?.sort_by || 'newest';
  if (sortBy === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else if (sortBy === 'highest') {
    query = query.order('total_amount', { ascending: false });
  } else if (sortBy === 'lowest') {
    query = query.order('total_amount', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const page = filters?.page || 1;
  const pageSize = filters?.page_size || 20;
  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    data: data as Order[],
    total: count || 0,
    page,
    page_size: pageSize,
  };
}

export async function getOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles:collector_id(full_name, email), stores:store_id(name, address, contact_phone), order_items(*)')
    .eq('id', orderId)
    .single();
  if (error) throw new Error(error.message);
  return data as Order;
}
