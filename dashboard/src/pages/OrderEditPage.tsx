import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ArrowLeft, Plus, Minus, Trash2, Loader2 } from 'lucide-react';
import type { Order, OrderItem } from '@/types';
import toast from 'react-hot-toast';

interface ProductRow {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
}

interface StoreRow {
  id: string;
  name: string;
}

interface EditableOrderItem extends OrderItem {
  _isNew?: boolean;
}

const inputCls = 'border border-[#1E3F5E]/60 rounded-md px-2.5 py-1.5 text-xs bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] w-full';
const labelCls = 'block text-xs font-medium text-[#8FAABE]/70 mb-1';

export function OrderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  
  const [selectedStore, setSelectedStore] = useState('');
  const [notes, setNotes] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [items, setItems] = useState<EditableOrderItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*, profiles:collector_id(full_name, email), stores:store_id(name), order_items(*)')
          .eq('id', id)
          .single();
        
        if (orderError) throw orderError;
        
        const fetchedOrder = orderData as Order;
        setOrder(fetchedOrder);
        setSelectedStore(fetchedOrder.store_id || '');
        setNotes(fetchedOrder.notes || '');
        setOrderDate(fetchedOrder.created_at ? new Date(fetchedOrder.created_at).toISOString().slice(0, 16) : '');
        setDeliveryAddress(fetchedOrder.delivery_address || '');
        setItems(fetchedOrder.order_items || []);

        // Fetch stores and products
        const [{ data: storesData }, { data: productsData }] = await Promise.all([
          supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
          supabase.from('products').select('id, name, price, stock_quantity').eq('is_active', true).order('name'),
        ]);
        
        setStores((storesData as StoreRow[]) || []);
        setProducts((productsData as ProductRow[]) || []);
      } catch (err) {
        toast.error('Failed to load order');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [id, navigate]);

  function updateItemQuantity(itemId: string, delta: number) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      return {
        ...item,
        quantity: newQty,
        line_total: newQty * item.unit_price,
      };
    }));
  }

  function removeItem(itemId: string) {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }

  function addProduct(productId: string) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = items.find(item => item.product_id === productId);
    if (existing) {
      updateItemQuantity(existing.id, 1);
      return;
    }

    const newItem: EditableOrderItem = {
      id: `temp-${Date.now()}`,
      order_id: id!,
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: product.price,
      line_total: product.price,
      created_at: new Date().toISOString(),
      _isNew: true,
    };
    
    setItems(prev => [...prev, newItem]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    if (items.length === 0) {
      setError('Order must have at least one item');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Update order basic info
      const updateData: any = {
        store_id: selectedStore || null,
        notes: notes || null,
        delivery_address: deliveryAddress || null,
        updated_at: new Date().toISOString(),
      };

      // Update created_at if date was changed
      if (orderDate) {
        updateData.created_at = new Date(orderDate).toISOString();
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id);

      if (orderError) throw orderError;

      // Delete removed items
      const currentItemIds = items.filter(item => !item._isNew).map(item => item.id);
      const originalItemIds = order?.order_items?.map(item => item.id) || [];
      const deletedIds = originalItemIds.filter(oid => !currentItemIds.includes(oid));
      
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', deletedIds);
        
        if (deleteError) throw deleteError;
      }

      // Update existing items
      for (const item of items.filter(i => !i._isNew)) {
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            line_total: item.line_total,
          })
          .eq('id', item.id);
        
        if (updateError) throw updateError;
      }

      // Insert new items
      const newItems = items.filter(i => i._isNew).map(item => ({
        order_id: id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
      }));

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from('order_items')
          .insert(newItems);
        
        if (insertError) throw insertError;
      }

      // Recalculate order totals
      const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
      const { error: totalError } = await supabase
        .from('orders')
        .update({
          subtotal,
          total_amount: subtotal,
        })
        .eq('id', id);

      if (totalError) throw totalError;

      toast.success('Order updated successfully');
      navigate(`/orders/${id}`);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Failed to update order';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);

  if (loading) {
    return (
      <div className="p-4 bg-[#0D1F33] min-h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5B9BD5]" size={24} />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="p-4 bg-[#0D1F33] min-h-full">
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="flex items-center gap-1 text-xs text-[#8FAABE]/70 hover:text-[#E8EDF2] transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="h-3 w-px bg-[#1E3F5E]/60" />
        <p className="text-sm font-semibold text-[#E8EDF2]">
          Edit Order: {order.order_number}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Items */}
        <div className="lg:col-span-2">
          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-[#8FAABE]/70 uppercase tracking-wide mb-3">Order Items</p>
            
            {error && (
              <div className="bg-[#E06C75]/10 border border-[#E06C75]/30 rounded-md p-3 mb-4 text-xs text-[#E06C75]">
                {error}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-[#0D1F33] border border-[#1E3F5E]/60 rounded-md p-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#E8EDF2]">{item.product_name}</p>
                    <p className="text-[10px] text-[#8FAABE]/50">{formatCurrency(item.unit_price)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateItemQuantity(item.id, -1)}
                      className="p-1 text-[#8FAABE]/60 hover:text-[#E8EDF2] hover:bg-[#1A3755] rounded transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-medium text-[#E8EDF2] w-8 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateItemQuantity(item.id, 1)}
                      className="p-1 text-[#8FAABE]/60 hover:text-[#E8EDF2] hover:bg-[#1A3755] rounded transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="text-xs font-semibold text-[#E8EDF2] w-20 text-right">
                    {formatCurrency(item.line_total)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-[#8FAABE]/40 hover:text-[#E06C75] transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-[#1E3F5E]/60 pt-3">
              <label className={labelCls}>Add Product</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addProduct(e.target.value);
                    e.target.value = '';
                  }
                }}
                className={inputCls}
                aria-label="Select product to add"
              >
                <option value="">Select a product to add...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {formatCurrency(product.price)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Order Details & Summary */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-[#8FAABE]/70 uppercase tracking-wide mb-3">Order Details</p>
            
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Order Date & Time</label>
                <input
                  type="datetime-local"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className={inputCls}
                  aria-label="Order date and time"
                />
              </div>

              <div>
                <label className={labelCls}>Store</label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className={inputCls}
                  aria-label="Select store"
                >
                  <option value="">No store selected</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Delivery Address <span className="text-[#8FAABE]/40 font-normal">(overrides store address)</span></label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter custom delivery address for this order..."
                  rows={2}
                  className={cn(inputCls, 'resize-none')}
                />
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                  className={cn(inputCls, 'resize-none')}
                />
              </div>
            </div>

            <div className="border-t border-[#1E3F5E]/60 mt-4 pt-4">
              <div className="flex justify-between text-xs text-[#8FAABE]/70 mb-1">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-[#E8EDF2] pt-2 border-t border-[#1E3F5E]/60">
                <span>Total</span>
                <span className="text-[#5B9BD5]">{formatCurrency(subtotal)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="flex-1 bg-[#5B9BD5] text-white text-xs px-4 py-2 rounded-md hover:bg-[#4A8BC4] disabled:opacity-60 font-medium"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/orders/${id}`)}
                className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#8FAABE]/70 text-xs px-4 py-2 rounded-md hover:bg-[#1A3755]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
