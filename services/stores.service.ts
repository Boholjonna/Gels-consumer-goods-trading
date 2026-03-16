import { supabase } from '@/lib/supabase';
import type { Store } from '@/types';

export async function getStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return data as Store[];
}

export async function getStore(storeId: string): Promise<Store> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();
  if (error) throw new Error(error.message);
  return data as Store;
}

export async function updateStore(storeId: string, updates: { name?: string }): Promise<Store> {
  const { data, error } = await supabase
    .from('stores')
    .update(updates)
    .eq('id', storeId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Store;
}

export async function deleteStore(storeId: string): Promise<void> {
  const { error } = await supabase
    .from('stores')
    .update({ is_active: false })
    .eq('id', storeId);
  if (error) throw new Error(error.message);
}

export async function getTopStores(limit = 5): Promise<{ store_id: string; store_name: string; order_count: number }[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('store_id, stores:store_id(name)')
    .not('store_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const counts = new Map<string, { name: string; count: number }>();
  for (const row of data || []) {
    const id = row.store_id as string;
    const name = (row.stores as any)?.name || 'Unknown';
    const entry = counts.get(id);
    if (entry) {
      entry.count++;
    } else {
      counts.set(id, { name, count: 1 });
    }
  }

  return Array.from(counts.entries())
    .map(([id, { name, count }]) => ({ store_id: id, store_name: name, order_count: count }))
    .sort((a, b) => b.order_count - a.order_count)
    .slice(0, limit);
}

export async function createStore(name: string): Promise<Store> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('stores')
    .insert({ name, is_active: true })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Store;
}
