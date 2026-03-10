import { useState, useEffect, useCallback } from 'react';
import { getProducts } from '@/services/products.service';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

const PAGE_SIZE = 20;

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = useCallback(async (targetPage: number, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await getProducts({
        search: search || undefined,
        page_size: PAGE_SIZE,
        page: targetPage,
      });
      setProducts(result.data);
      const computed = Math.ceil(result.total / PAGE_SIZE) || 1;
      setTotalPages(computed);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search]);

  // Runs on mount and whenever search changes (fetchProducts is recreated).
  // Resetting to page 1 here ensures a search change always starts from the first page.
  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      const next = page + 1;
      setPage(next);
      fetchProducts(next);
    }
  }, [page, totalPages, fetchProducts]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      const prev = page - 1;
      setPage(prev);
      fetchProducts(prev);
    }
  }, [page, fetchProducts]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts(page, true);
    setRefreshing(false);
  }, [fetchProducts, page]);

  const refetch = useCallback(() => {
    fetchProducts(page);
  }, [fetchProducts, page]);

  // Subscribe to realtime stock updates — patches the current page in place
  useEffect(() => {
    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === payload.new.id
                ? { ...p, stock_quantity: payload.new.stock_quantity }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    products,
    loading,
    error,
    search,
    setSearch,
    page,
    totalPages,
    total,
    nextPage,
    prevPage,
    refreshing,
    refresh,
    refetch,
  };
}
