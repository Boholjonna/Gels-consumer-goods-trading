import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

const inputCls = 'border border-[#dce8f5] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db] w-full';
const labelCls = 'block text-xs font-medium text-[#4b5e73] mb-1';

function generateSku(name: string): string {
  const prefix = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [loading, setLoading] = useState(!!id);
  const isEditing = !!id;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    async function fetchProduct() {
      try {
        const { data, error: err } = await supabase
          .from('products')
          .select('*, categories(name)')
          .eq('id', id)
          .single();
        if (err) throw err;
        const p = data as Product;
        setProduct(p);
        setName(p.name || '');
        setDescription(p.description || '');
        setSku(p.sku || '');
        setPrice(p.price?.toString() || '');
        setStockQuantity(p.stock_quantity?.toString() || '0');
        setIsActive(p.is_active);
      } catch {
        toast.error('Product not found');
        navigate('/products');
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) {
      setError('Name and price are required');
      return;
    }
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stockQuantity, 10) || 0;
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a non-negative number');
      return;
    }
    if (parsedStock < 0) {
      setError('Stock must be non-negative');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload: Partial<Product> = {
      name: name.trim(),
      description: description.trim() || null,
      sku: sku.trim() || generateSku(name.trim()),
      price: parsedPrice,
      stock_quantity: parsedStock,
      is_active: isActive,
    };

    try {
      if (isEditing && id) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', id);
        if (err) throw err;
        toast.success('Product updated');
      } else {
        const { error: err } = await supabase.from('products').insert(payload);
        if (err) throw err;
        toast.success('Product created');
      }
      navigate('/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-[#f0f4f8] min-h-full">
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-6 max-w-2xl animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#f0f4f8] min-h-full">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-1 text-xs text-[#4b5e73] hover:text-[#0d1f35] transition-colors"
        >
          <ArrowLeft size={14} />
          Products
        </button>
        <div className="h-3 w-px bg-[#e2ecf9]" />
        <p className="text-sm font-semibold text-[#0d1f35]">
          {isEditing ? `Edit: ${product?.name}` : 'New Product'}
        </p>
      </div>

      <div className="bg-white border border-[#e2ecf9] rounded-lg p-5 max-w-2xl">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-xs text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Product Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name"
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* SKU */}
          <div>
            <label className={labelCls}>SKU <span className="text-[#8aa0b8] font-normal">(auto-generated if blank)</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. PRD-001"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setSku(generateSku(name || 'PRD'))}
                className="shrink-0 border border-[#dce8f5] text-[#4b5e73] text-xs px-2.5 py-1.5 rounded-md hover:bg-[#f0f4f8] transition-colors whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>

          {/* Price + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Stock Qty</label>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className={inputCls}
                aria-label="Stock quantity"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-[#dce8f5] text-[#1a56db] focus:ring-[#1a56db]"
            />
            <label htmlFor="is_active" className="text-xs text-[#4b5e73] font-medium">
              Active (visible to collectors)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-[#e2ecf9]">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#1a56db] text-white text-xs px-4 py-2 rounded-md hover:bg-[#1447c0] disabled:opacity-60 font-medium"
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-4 py-2 rounded-md hover:bg-[#f0f4f8]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
