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
