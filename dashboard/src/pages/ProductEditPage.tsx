import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

const inputCls = 'border border-[#1E3F5E]/60 rounded-md px-2.5 py-1.5 text-xs bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] w-full';
const labelCls = 'block text-xs font-medium text-[#8FAABE]/70 mb-1';

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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [cartonQty, setCartonQty] = useState('0');
  const [cartonSize, setCartonSize] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-calculate cartons when quantity changes
  function handleStockQuantityChange(value: string) {
    setStockQuantity(value);
    const qty = parseInt(value, 10) || 0;
    const size = parseInt(cartonSize, 10) || 0;
    if (size > 0) {
      setCartonQty(Math.floor(qty / size).toString());
    }
  }

  // Auto-calculate quantity when cartons change
  function handleCartonQtyChange(value: string) {
    setCartonQty(value);
    const ctns = parseInt(value, 10) || 0;
    const size = parseInt(cartonSize, 10) || 0;
    if (size > 0) {
      setStockQuantity((ctns * size).toString());
    }
  }

  // Recalculate cartons when carton size changes
  function handleCartonSizeChange(value: string) {
    setCartonSize(value);
    const qty = parseInt(stockQuantity, 10) || 0;
    const size = parseInt(value, 10) || 0;
    if (size > 0) {
      setCartonQty(Math.floor(qty / size).toString());
    } else {
      setCartonQty('0');
    }
  }

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
        setCartonSize(p.carton_size?.toString() || '');
        // Calculate carton qty from stock and carton size
        if (p.carton_size && p.carton_size > 0) {
          setCartonQty(Math.floor((p.stock_quantity || 0) / p.carton_size).toString());
        }
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
      carton_size: cartonSize.trim() ? parseInt(cartonSize, 10) : null,
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
      <div className="p-4 bg-[#0D1F33] min-h-full">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-6 max-w-2xl animate-pulse">
          <div className="h-5 bg-[#1A3755] rounded w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-[#1A3755] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#0D1F33] min-h-full">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-1 text-xs text-[#8FAABE]/70 hover:text-[#E8EDF2] transition-colors"
        >
          <ArrowLeft size={14} />
          Products
        </button>
        <div className="h-3 w-px bg-[#1E3F5E]/60" />
        <p className="text-sm font-semibold text-[#E8EDF2]">
          {isEditing ? `Edit: ${product?.name}` : 'New Product'}
        </p>
      </div>

      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-5 max-w-2xl">
        {error && (
          <div className="bg-[#E06C75]/10 border border-[#E06C75]/30 rounded-md p-3 mb-4 text-xs text-[#E06C75]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Product Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter product name" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} className={`${inputCls} resize-none`} />
          </div>

          <div>
            <label className={labelCls}>SKU <span className="text-[#8FAABE]/40 font-normal">(auto-generated if blank)</span></label>
            <div className="flex gap-2">
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. PRD-001" className={inputCls} />
              <button
                type="button"
                onClick={() => setSku(generateSku(name || 'PRD'))}
                className="shrink-0 border border-[#1E3F5E]/60 text-[#8FAABE]/70 text-xs px-2.5 py-1.5 rounded-md hover:bg-[#1A3755] transition-colors whitespace-nowrap"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Price *</label>
              <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Pcs/Carton</label>
              <input type="number" min="1" value={cartonSize} onChange={(e) => handleCartonSizeChange(e.target.value)} placeholder="e.g. 24" className={inputCls} aria-label="Pieces per carton" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Stock Qty (pieces)</label>
              <input type="number" min="0" value={stockQuantity} onChange={(e) => handleStockQuantityChange(e.target.value)} className={inputCls} aria-label="Stock quantity" />
            </div>
            <div>
              <label className={labelCls}>Cartons</label>
              <input
                type="number"
                min="0"
                value={cartonQty}
                onChange={(e) => handleCartonQtyChange(e.target.value)}
                className={inputCls}
                aria-label="Carton quantity"
                disabled={!cartonSize || parseInt(cartonSize, 10) <= 0}
              />
              {cartonSize && parseInt(cartonSize, 10) > 0 && (
                <p className="text-[10px] text-[#8FAABE]/50 mt-1">
                  {cartonQty} cartons × {cartonSize} = {parseInt(cartonQty, 10) * parseInt(cartonSize, 10)} pcs
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-[#1E3F5E]/60 text-[#5B9BD5] focus:ring-[#5B9BD5]"
            />
            <label htmlFor="is_active" className="text-xs text-[#8FAABE]/70 font-medium">
              Active (visible to collectors)
            </label>
          </div>

          <div className="flex gap-2 pt-2 border-t border-[#1E3F5E]/60">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#5B9BD5] text-white text-xs px-4 py-2 rounded-md hover:bg-[#4A8BC4] disabled:opacity-60 font-medium"
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#8FAABE]/70 text-xs px-4 py-2 rounded-md hover:bg-[#1A3755]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
