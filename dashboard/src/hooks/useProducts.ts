import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Category } from '@/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (search?: string, categoryId?: string, isActive?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('products').select('*, categories(name)', { count: 'exact' });
      if (search) query = query.ilike('name', `%${search}%`);
      if (categoryId) query = query.eq('category_id', categoryId);
      if (isActive !== undefined) query = query.eq('is_active', isActive);
      query = query.order('name').limit(500);

      const { data, count, error: err } = await query;
      if (err) throw err;
      setProducts((data as Product[]) || []);
      setTotal(count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');
      if (err) throw err;
      setCategories((data as Category[]) || []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  async function createProduct(data: Partial<Product>): Promise<Product> {
    const { data: result, error: err } = await supabase
      .from('products')
      .insert(data)
      .select()
      .single();
    if (err) throw err;
    await fetchProducts();
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
    await fetchProducts();
    return result as Product;
  }

  async function deleteProduct(id: string): Promise<void> {
    const { error: err } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);
    if (err) throw err;
    await fetchProducts();
  }

  async function createCategory(data: { name: string; description?: string }): Promise<Category> {
    const { data: result, error: err } = await supabase
      .from('categories')
      .insert(data)
      .select()
      .single();
    if (err) throw err;
    await fetchCategories();
    return result as Category;
  }

  async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const { data: result, error: err } = await supabase
      .from('categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (err) throw err;
    await fetchCategories();
    return result as Category;
  }

  async function deleteCategory(id: string): Promise<void> {
    const { error: err } = await supabase
      .from('categories')
      .update({ is_active: false })
      .eq('id', id);
    if (err) throw err;
    await fetchCategories();
  }

  return {
    products,
    categories,
    total,
    loading,
    error,
    fetchProducts,
    fetchCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
