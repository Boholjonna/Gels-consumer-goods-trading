import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  ShoppingCart,
  Store,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductRow {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
}

interface StoreRow {
  id: string;
  name: string;
}

interface CartItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  stock_quantity: number;
}

export function CreateOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedStore, setSelectedStore] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('0');

  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: strs }] = await Promise.all([
        supabase.from('products').select('id, name, price, stock_quantity, is_active').eq('is_active', true).order('name'),
        supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
      ]);
      setProducts((prods as ProductRow[]) || []);
      setStores((strs as StoreRow[]) || []);
      setLoadingData(false);
    }
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  function addToCart(product: ProductRow) {
    const existing = cart.find((c) => c.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        toast.error('Insufficient stock');
        return;
      }
      setCart((prev) =>
        prev.map((c) => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c)
      );
    } else {
      if (product.stock_quantity <= 0) {
        toast.error('Out of stock');
        return;
      }
      setCart((prev) => [...prev, {
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        quantity: 1,
        stock_quantity: product.stock_quantity,
      }]);
    }
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product_id !== productId) return c;
        const newQty = c.quantity + delta;
        if (newQty <= 0) return c;
        if (newQty > c.stock_quantity) { toast.error('Insufficient stock'); return c; }
        return { ...c, quantity: newQty };
      })
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }

  function handleQuantityEdit(productId: string, currentQty: number) {
    setEditingProductId(productId);
    setEditingQuantity(currentQty.toString());
  }

  function handleQuantitySave(productId: string) {
    const newQty = parseInt(editingQuantity, 10);
    if (!isNaN(newQty) && newQty > 0) {
      const item = cart.find((c) => c.product_id === productId);
      if (item && newQty <= item.stock_quantity) {
        setCart((prev) =>
          prev.map((c) => c.product_id === productId ? { ...c, quantity: newQty } : c)
        );
      }
    }
    setEditingProductId(null);
    setEditingQuantity('0');
  }

  async function handleSubmit() {
    if (cart.length === 0) { toast.error('Add at least one product'); return; }
    if (!user) { toast.error('Not authenticated'); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_order', {
        p_collector_id: user.id,
        p_store_id: selectedStore || null,
        p_notes: notes || null,
        p_items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
      });
      if (error) throw error;
      const result = data as { order_id: string; order_number: string };
      toast.success(`Order ${result.order_number} created`);
      navigate(`/orders/${result.order_id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full border border-[#1E3F5E]/60 rounded-md px-3 py-2 text-xs bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] transition-colors';

  if (loadingData) {
    return (
      <div className="p-4 bg-[#0D1F33] min-h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5B9BD5]" size={24} />
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#0D1F33] min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1 text-xs text-[#8FAABE]/70 hover:text-[#E8EDF2] transition-colors"
        >
          <ArrowLeft size={14} />
          Orders
        </button>
        <div className="h-3 w-px bg-[#1E3F5E]/60" />
        <p className="text-sm font-semibold text-[#E8EDF2]">New Order</p>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Left — Product selection */}
        <div className="flex-1">
          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FAABE]/40" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#1E3F5E]/60 rounded-lg bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]"
                />
              </div>
              <p className="text-[10px] text-[#8FAABE]/40">{filteredProducts.length} products</p>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-[#8FAABE]/40 text-center py-4">No products found</p>
              ) : (
                filteredProducts.map((product) => {
                  const inCart = cart.find((c) => c.product_id === product.id);
                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1A3755]/50 transition-colors cursor-pointer group"
                      onClick={() => addToCart(product)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#E8EDF2] font-medium truncate">{product.name}</p>
                        <p className="text-[10px] text-[#8FAABE]/50">{formatCurrency(product.price)} &middot; Stock: {product.stock_quantity}</p>
                      </div>
                      {inCart ? (
                        <span className="text-[10px] font-semibold text-[#5B9BD5] bg-[#5B9BD5]/10 px-1.5 py-0.5 rounded">{inCart.quantity} in cart</span>
                      ) : (
                        <Plus size={14} className="text-[#8FAABE]/30 group-hover:text-[#5B9BD5] transition-colors flex-shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right — Cart + Order details */}
        <div className="lg:w-[380px] flex-shrink-0 space-y-3">
          {/* Store selection */}
          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
            <p className="text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider mb-2">Order Details</p>
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider mb-1.5">
                <Store size={10} className="inline mr-1" />
                Store
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className={cn(inputCls, 'appearance-none')}
                aria-label="Select store"
              >
                <option value="">Walk-in (No store)</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider mb-1.5">Notes</label>
              <textarea
                className={cn(inputCls, 'resize-none')}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {/* Cart items */}
          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1E3F5E]/60 flex items-center justify-between">
              <p className="text-xs font-semibold text-[#E8EDF2]">Cart ({cart.length})</p>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-[10px] text-[#E06C75] hover:text-[#E06C75]/80 transition-colors">Clear</button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center">
                <ShoppingCart size={20} className="text-[#8FAABE]/20 mx-auto mb-2" />
                <p className="text-xs text-[#8FAABE]/40">Click products to add them</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E3F5E]/30">
                {cart.map((item) => (
                  <div key={item.product_id} className="px-4 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#E8EDF2] font-medium truncate">{item.product_name}</p>
                      <p className="text-[10px] text-[#8FAABE]/50">{formatCurrency(item.unit_price)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.product_id, -1)}
                        disabled={item.quantity <= 1 || editingProductId === item.product_id}
                        className="w-6 h-6 rounded bg-[#0D1F33] flex items-center justify-center text-[#8FAABE]/50 hover:text-[#E8EDF2] disabled:opacity-30 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={10} />
                      </button>
                      {editingProductId === item.product_id ? (
                        <input
                          type="number"
                          min="1"
                          max={item.stock_quantity}
                          value={editingQuantity}
                          onChange={(e) => setEditingQuantity(e.target.value)}
                          onBlur={() => handleQuantitySave(item.product_id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuantitySave(item.product_id);
                            if (e.key === 'Escape') setEditingProductId(null);
                          }}
                          autoFocus
                          className="w-16 text-center text-xs font-semibold text-[#E8EDF2] bg-[#1e3a5f] border-2 border-[#5B9BD5] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/50 tabular-nums number-input-no-spinner"
                          style={{
                            MozAppearance: 'textfield' as any,
                            WebkitAppearance: 'none' as any,
                            appearance: 'textfield',
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => handleQuantityEdit(item.product_id, item.quantity)}
                          className="min-w-[40px] px-2 py-1 text-xs font-semibold text-[#E8EDF2] bg-[#1e3a5f] border border-[#2e4a6f] rounded tabular-nums hover:border-[#5B9BD5] hover:text-[#5B9BD5] transition-colors"
                          title="Click to edit quantity"
                        >
                          {item.quantity}
                        </button>
                      )}
                      <button
                        onClick={() => updateQty(item.product_id, 1)}
                        disabled={item.quantity >= item.stock_quantity || editingProductId === item.product_id}
                        className="w-6 h-6 rounded bg-[#0D1F33] flex items-center justify-center text-[#8FAABE]/50 hover:text-[#E8EDF2] disabled:opacity-30 transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-[#E8EDF2] w-20 text-right tabular-nums">{formatCurrency(item.unit_price * item.quantity)}</p>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="p-1 text-[#8FAABE]/30 hover:text-[#E06C75] transition-colors"
                      aria-label="Remove from cart"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="px-4 py-3 border-t border-[#1E3F5E]/60 bg-[#1A3755]/50">
                <div className="flex justify-between text-xs font-bold text-[#E8EDF2] mb-3">
                  <span>Total</span>
                  <span className="text-[#5B9BD5]">{formatCurrency(subtotal)}</span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || cart.length === 0}
                  className="w-full bg-[#5B9BD5] text-white text-xs py-2.5 rounded-md hover:bg-[#4A8BC4] flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors font-medium"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
                  {submitting ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
