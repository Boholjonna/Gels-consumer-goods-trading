import { useState, useEffect, useCallback, useMemo } from 'react';
import { getProducts } from '@/services/products.service';
import { getCachedProducts, cacheProducts } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

const PAGE_SIZE = 20;

export function useProducts() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const categories = useMemo(() => {
    const categoryMap = new Map<string, string>();
    const categoryCount = new Map<string, number>();
    for (const product of allProducts) {
      const category = extractCategory(product.name);
      if (category) {
        const key = category.toLowerCase();
        if (!categoryMap.has(key)) categoryMap.set(key, category);
        categoryCount.set(key, (categoryCount.get(key) || 0) + 1);
      }
    }
    const existingCategories = Array.from(categoryMap.entries())
      .filter(([key]) => (categoryCount.get(key) || 0) > 0)
      .map(([, label]) => label)
      .sort((a, b) => a.localeCompare(b));

    return ['All', ...existingCategories];
  }, [allProducts]);

  useEffect(() => {
    if (selectedCategory !== 'All' && !categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  // Apply local search/category + pagination over available data
  function applyLocalFilters(all: Product[], q: string, category: string, p: number) {
    let filtered = all;
    if (category !== 'All') {
      const selected = category.toLowerCase();
      filtered = filtered.filter((item) => extractCategory(item.name).toLowerCase() === selected);
    }
    if (q.trim()) {
      const lc = q.toLowerCase();
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(lc));
    }
    const count = filtered.length;
    const pages = Math.ceil(count / PAGE_SIZE) || 1;
    const start = (p - 1) * PAGE_SIZE;
    return { paged: filtered.slice(start, start + PAGE_SIZE), count, pages };
  }

  const applyView = useCallback(
    (all: Product[], targetPage: number) => {
      const { paged, count, pages } = applyLocalFilters(all, search, selectedCategory, targetPage);
      setProducts(paged);
      setTotal(count);
      setTotalPages(pages);
      setPage(Math.min(targetPage, pages));
    },
    [search, selectedCategory]
  );

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const full = await getProducts({ page: 1, page_size: 10000 });
      setAllProducts(full.data);
      applyView(full.data, 1);
      cacheProducts(full.data).catch(() => {});
    } catch {
      const cached = (await getCachedProducts()) || [];
      if (cached.length > 0) {
        setAllProducts(cached);
        applyView(cached, 1);
        setError(null);
      } else {
        setError('No internet connection and no cached data available');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyView]);

  // Re-apply local view when filters change
  useEffect(() => {
    applyView(allProducts, 1);
  }, [search, selectedCategory, allProducts, applyView]);

  // Mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const nextPage = useCallback(() => {
    if (page >= totalPages) return;
    const next = page + 1;
    applyView(allProducts, next);
  }, [page, totalPages, allProducts, applyView]);

  const prevPage = useCallback(() => {
    if (page <= 1) return;
    const prev = page - 1;
    applyView(allProducts, prev);
  }, [page, allProducts, applyView]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts(true);
    setRefreshing(false);
  }, [fetchProducts]);

  const refetch = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Realtime stock updates
  useEffect(() => {
    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          setAllProducts((prev) =>
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
    selectedCategory,
    setSelectedCategory,
    categories,
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

const SIZE_OR_UNIT_TOKEN = /^(\d+([./]\d+)?(ml|l|g|kg|pcs|pc|ctn)?|x\d+|\d+x)$/i;
const CATEGORY_ALIASES: Record<string, string> = {
  WHITE: 'WHITE HOUSE',
  WHOLE: 'WHOLE KERNEL',
};

function extractCategory(name: string): string {
  const tokens = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0];

  const first = tokens[0];
  const second = tokens[1];
  const firstUpper = first.toUpperCase();

  if (CATEGORY_ALIASES[firstUpper]) {
    return CATEGORY_ALIASES[firstUpper];
  }

  if (first === first.toUpperCase()) {
    if (first.length <= 2 && second && !SIZE_OR_UNIT_TOKEN.test(second)) {
      return `${first} ${second}`;
    }
    return first;
  }

  if (SIZE_OR_UNIT_TOKEN.test(second)) {
    return first;
  }

  return `${first} ${second}`;
}
