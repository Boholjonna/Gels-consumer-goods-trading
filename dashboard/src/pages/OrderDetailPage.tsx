import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ArrowLeft, Printer, Pencil } from 'lucide-react';
import { PrintableReceipt } from '@/components/PrintableReceipt';
import { printReceiptElement } from '@/lib/printReceipt';
import { statusBadge } from '@/lib/constants';
import type { Order } from '@/types';
import toast from 'react-hot-toast';

const statusFlow = ['pending', 'confirmed', 'processing', 'completed'];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const el = receiptRef.current?.querySelector('.receipt-container') as HTMLElement | null;
    if (el) printReceiptElement(el);
  }

  useEffect(() => {
    async function fetchOrder() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, profiles:collector_id(full_name, email, nickname), stores:store_id(name, address), order_items(*)')
          .eq('id', id)
          .single();
        if (error) throw error;
        setOrder(data as Order);
      } catch {
        toast.error('Failed to load order');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id, navigate]);

  async function handleStatusChange(orderId: string, status: string) {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      setOrder((prev) => prev ? { ...prev, status: status as Order['status'] } : null);
      toast.success(`Order marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-[#0D1F33] min-h-full">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-6 animate-pulse">
          <div className="h-5 bg-[#1A3755] rounded w-40 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 bg-[#1A3755] rounded w-20 mb-1" />
                <div className="h-4 bg-[#1A3755] rounded w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const currentStatusIndex = statusFlow.indexOf(order.status);
  const nextStatus = currentStatusIndex < statusFlow.length - 1 ? statusFlow[currentStatusIndex + 1] : null;

  return (
    <div className="p-4 bg-[#0D1F33] min-h-full">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1 text-xs text-[#8FAABE]/70 hover:text-[#E8EDF2] transition-colors"
        >
          <ArrowLeft size={14} />
          Orders
        </button>
        <div className="h-3 w-px bg-[#1E3F5E]/60" />
        <p className="text-sm font-semibold text-[#E8EDF2] font-mono">{order.order_number}</p>
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', statusBadge[order.status])}>
          {order.status}
        </span>
      </div>

      <div className="flex gap-3 flex-col lg:flex-row">
        <div className="flex-1 space-y-3">
          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-[#8FAABE]/70 uppercase tracking-wide mb-3">Order Information</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide mb-0.5">Order #</p>
                <p className="text-xs font-mono font-semibold text-[#E8EDF2]">{order.order_number}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide mb-0.5">Date</p>
                <p className="text-xs text-[#E8EDF2]">{formatDate(order.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide mb-0.5">Collector</p>
                <p className="text-xs text-[#E8EDF2] font-medium">
                  {order.profiles?.nickname || order.profiles?.full_name || '—'}
                </p>
                <p className="text-[10px] text-[#8FAABE]/50">{order.profiles?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide mb-0.5">Store</p>
                <p className="text-xs text-[#E8EDF2] font-medium">{order.stores?.name || '—'}</p>
                {(order.delivery_address || order.stores?.address) && (
                  <p className="text-[10px] text-[#8FAABE]/50">
                    {order.delivery_address || order.stores?.address}
                  </p>
                )}
                {order.delivery_address && order.stores?.address && (
                  <p className="text-[9px] text-[#E5C07B] italic">(Custom address)</p>
                )}
              </div>
              {order.notes && (
                <div className="col-span-2">
                  <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide mb-0.5">Notes</p>
                  <p className="text-xs text-[#E8EDF2]">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-[#8FAABE]/70 uppercase tracking-wide mb-3">Actions</p>
            <div className="flex flex-wrap gap-2">
              {nextStatus && order.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange(order.id, nextStatus)}
                  disabled={updating}
                  className="bg-[#5B9BD5] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#4A8BC4] flex items-center gap-1.5 disabled:opacity-60"
                >
                  Mark as {nextStatus}
                </button>
              )}
              {order.status !== 'cancelled' && order.status !== 'completed' && (
                <button
                  onClick={() => handleStatusChange(order.id, 'cancelled')}
                  disabled={updating}
                  className="bg-[#E06C75] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#D45F68] disabled:opacity-60"
                >
                  Cancel Order
                </button>
              )}
              <button
                onClick={handlePrint}
                className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#8FAABE]/70 text-xs px-3 py-1.5 rounded-md hover:bg-[#1A3755] flex items-center gap-1.5"
              >
                <Printer size={12} />
                Print Receipt
              </button>
              <button
                onClick={() => navigate(`/orders/${order.id}/edit`)}
                className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#8FAABE]/70 text-xs px-3 py-1.5 rounded-md hover:bg-[#1A3755] flex items-center gap-1.5"
              >
                <Pencil size={12} />
                Edit Order
              </button>
            </div>
          </div>

          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-[#8FAABE]/70 uppercase tracking-wide mb-3">Summary</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#8FAABE]/70">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#8FAABE]/70">
                <span>Tax</span>
                <span>{formatCurrency(order.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-[#E8EDF2] pt-1.5 border-t border-[#1E3F5E]/60">
                <span>Total</span>
                <span className="text-[#5B9BD5]">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-[400px] flex-shrink-0">
          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1E3F5E]/60">
              <p className="text-xs font-semibold text-[#E8EDF2]">
                Order Items ({order.order_items?.length || 0})
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E3F5E]/60 bg-[#1A3755]/50">
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Product</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Qty</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Price</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items?.map((item) => (
                  <tr key={item.id} className="border-b border-[#1E3F5E]/30">
                    <td className="px-3 py-2 text-xs text-[#E8EDF2]">{item.product_name}</td>
                    <td className="px-3 py-2 text-xs text-[#8FAABE]/70 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-xs text-[#8FAABE]/70 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-[#E8EDF2] text-right">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1A3755]/50">
                  <td colSpan={3} className="px-3 py-2 text-xs font-bold text-[#E8EDF2] text-right">Total</td>
                  <td className="px-3 py-2 text-xs font-bold text-[#5B9BD5] text-right">
                    {formatCurrency(order.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div ref={receiptRef} className="hidden">
        <PrintableReceipt order={order} />
      </div>
    </div>
  );
}
