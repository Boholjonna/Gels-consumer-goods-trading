import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

const PAGE_SIZE = 20;

interface FetchProductsParams {
  page?: number;
  search?: string;
  isActive?: boolean;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async ({ page: pageNum = 1, search, isActive }: FetchProductsParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('products')
        .select('*, categories(name)', { count: 'exact' });

      if (search) query = query.ilike('name', `%${search}%`);
      if (isActive !== undefined) query = query.eq('is_active', isActive);

      query = query.order('name').range(from, to);

      const { data, count, error: err } = await query;
      if (err) throw err;

      const totalCount = count || 0;
      setProducts((data as Product[]) || []);
      setTotal(totalCount);
      setPage(pageNum);
      setTotalPages(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  async function createProduct(data: Partial<Product>): Promise<Product> {
    const { data: result, error: err } = await supabase
      .from('products')
      .insert(data)
      .select()
      .single();
    if (err) throw err;
    await fetchProducts({ page: 1 });
    return result as Product;
  }

  async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const { data: result, error: err } = await supabase
      .from('products')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (err) throw err;
    await fetchProducts({ page: 1 });
    return result as Product;
  }

  async function deleteProduct(id: string): Promise<void> {
    const { error: err } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (err) throw err;
    await fetchProducts({ page: 1 });
  }

  async function batchCreateProducts(rows: Partial<Product>[]): Promise<void> {
    const { error: err } = await supabase.from('products').insert(rows);
    if (err) throw err;
    await fetchProducts({ page: 1 });
  }

  async function clearAllProducts(): Promise<void> {
    const { error: err } = await supabase
      .from('products')
      .delete()
      .gte('created_at', '2000-01-01');
    if (err) throw err;
    await fetchProducts({ page: 1 });
  }

  return {
    products,
    total,
    totalPages,
    page,
    loading,
    error,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    batchCreateProducts,
    clearAllProducts,
  };
}
