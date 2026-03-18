import { useState, useEffect, useCallback, useRef } from 'react';
import { getProducts } from '@/services/products.service';
import { getCachedProducts, cacheProducts } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

const PAGE_SIZE = 20;

export function useProducts() {
  const [allCached, setAllCached] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const offlineMode = useRef(false);

  // Apply local search + pagination over cached data
  function applyLocalFilters(all: Product[], q: string, p: number) {
    let filtered = all;
    if (q.trim()) {
      const lc = q.toLowerCase();
      filtered = all.filter((item) => item.name.toLowerCase().includes(lc));
    }
    const count = filtered.length;
    const pages = Math.ceil(count / PAGE_SIZE) || 1;
    const start = (p - 1) * PAGE_SIZE;
    return { paged: filtered.slice(start, start + PAGE_SIZE), count, pages };
  }

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
      setTotalPages(Math.ceil(result.total / PAGE_SIZE) || 1);
      setTotal(result.total);
      offlineMode.current = false;

      // Cache full product list on first page load with no search
      if (targetPage === 1 && !search) {
        getProducts({ page: 1, page_size: 10000 })
          .then((full) => {
            setAllCached(full.data);
            cacheProducts(full.data);
          })
          .catch(() => {});
      }
    } catch {
      // Network failed — fall back to cached data
      let cached = allCached;
      if (cached.length === 0) {
        cached = (await getCachedProducts()) || [];
        if (cached.length > 0) setAllCached(cached);
      }
      if (cached.length > 0) {
        offlineMode.current = true;
        const { paged, count, pages } = applyLocalFilters(cached, search, targetPage);
        setProducts(paged);
        setTotal(count);
        setTotalPages(pages);
        setError(null);
      } else {
        setError('No internet connection and no cached data available');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, allCached]);

  // Initial fetch + re-fetch when search changes
  useEffect(() => {
    setPage(1);
    if (offlineMode.current && allCached.length > 0) {
      const { paged, count, pages } = applyLocalFilters(allCached, search, 1);
      setProducts(paged);
      setTotal(count);
      setTotalPages(pages);
    } else {
      fetchProducts(1);
    }
  }, [search]);

  // Mount
  useEffect(() => {
    fetchProducts(1);
  }, []);

  const nextPage = useCallback(() => {
    if (page >= totalPages) return;
    const next = page + 1;
    setPage(next);
    if (offlineMode.current && allCached.length > 0) {
      const { paged, count, pages } = applyLocalFilters(allCached, search, next);
      setProducts(paged);
      setTotal(count);
      setTotalPages(pages);
    } else {
      fetchProducts(next);
    }
  }, [page, totalPages, fetchProducts, allCached, search]);

  const prevPage = useCallback(() => {
    if (page <= 1) return;
    const prev = page - 1;
    setPage(prev);
    if (offlineMode.current && allCached.length > 0) {
      const { paged, count, pages } = applyLocalFilters(allCached, search, prev);
      setProducts(paged);
      setTotal(count);
      setTotalPages(pages);
    } else {
      fetchProducts(prev);
    }
  }, [page, fetchProducts, allCached, search]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    offlineMode.current = false; // try online again
    await fetchProducts(page, true);
    setRefreshing(false);
  }, [fetchProducts, page]);

  const refetch = useCallback(() => {
    fetchProducts(page);
  }, [fetchProducts, page]);

  // Realtime stock updates
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
