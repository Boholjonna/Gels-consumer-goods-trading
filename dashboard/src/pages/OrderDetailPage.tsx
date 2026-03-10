import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { clsx } from 'clsx';
import { ArrowLeft, Printer } from 'lucide-react';
import { PrintableReceipt } from '@/components/PrintableReceipt';
import type { Order } from '@/types';
import toast from 'react-hot-toast';

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-500',
};

const statusFlow = ['pending', 'confirmed', 'processing', 'completed'];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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
      <div className="p-4 bg-[#f0f4f8] min-h-full">
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-6 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 bg-gray-200 rounded w-20 mb-1" />
                <div className="h-4 bg-gray-200 rounded w-32" />
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
    <div className="p-4 bg-[#f0f4f8] min-h-full">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1 text-xs text-[#4b5e73] hover:text-[#0d1f35] transition-colors"
        >
          <ArrowLeft size={14} />
          Orders
        </button>
        <div className="h-3 w-px bg-[#e2ecf9]" />
        <p className="text-sm font-semibold text-[#0d1f35] font-mono">{order.order_number}</p>
        <span
          className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium capitalize',
            statusBadge[order.status]
          )}
        >
          {order.status}
        </span>
      </div>

      {/* Two column layout */}
      <div className="flex gap-3 flex-col lg:flex-row">
        {/* Left: Order info */}
        <div className="flex-1 space-y-3">
          {/* Order details card */}
          <div className="bg-white border border-[#e2ecf9] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#4b5e73] uppercase tracking-wide mb-3">Order Information</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide mb-0.5">Order #</p>
                <p className="text-xs font-mono font-semibold text-[#0d1f35]">{order.order_number}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide mb-0.5">Date</p>
                <p className="text-xs text-[#0d1f35]">{formatDate(order.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide mb-0.5">Collector</p>
                <p className="text-xs text-[#0d1f35] font-medium">
                  {(order.profiles as any)?.nickname || order.profiles?.full_name || '—'}
                </p>
                <p className="text-[10px] text-[#8aa0b8]">{order.profiles?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide mb-0.5">Store</p>
                <p className="text-xs text-[#0d1f35] font-medium">{order.stores?.name || '—'}</p>
                {order.stores?.address && (
                  <p className="text-[10px] text-[#8aa0b8]">{order.stores.address}</p>
                )}
              </div>
              {order.notes && (
                <div className="col-span-2">
                  <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide mb-0.5">Notes</p>
                  <p className="text-xs text-[#0d1f35]">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status actions */}
          <div className="bg-white border border-[#e2ecf9] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#4b5e73] uppercase tracking-wide mb-3">Actions</p>
            <div className="flex flex-wrap gap-2">
              {nextStatus && order.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusChange(order.id, nextStatus)}
                  disabled={updating}
                  className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] flex items-center gap-1.5 disabled:opacity-60"
                >
                  Mark as {nextStatus}
                </button>
              )}
              {order.status !== 'cancelled' && order.status !== 'completed' && (
                <button
                  onClick={() => handleStatusChange(order.id, 'cancelled')}
                  disabled={updating}
                  className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-60"
                >
                  Cancel Order
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8] flex items-center gap-1.5 ml-auto"
              >
                <Printer size={12} />
                Print Receipt
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white border border-[#e2ecf9] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#4b5e73] uppercase tracking-wide mb-3">Summary</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#4b5e73]">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#4b5e73]">
                <span>Tax</span>
                <span>{formatCurrency(order.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-[#0d1f35] pt-1.5 border-t border-[#e2ecf9]">
                <span>Total</span>
                <span className="text-[#1a56db]">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Order items */}
        <div className="lg:w-[400px] flex-shrink-0">
          <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2ecf9]">
              <p className="text-xs font-semibold text-[#0d1f35]">
                Order Items ({order.order_items?.length || 0})
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items?.map((item) => (
                  <tr key={item.id} className="border-b border-[#f0f4f8]">
                    <td className="px-3 py-2 text-xs text-[#0d1f35]">{item.product_name}</td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-[#0d1f35] text-right">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f8fafd]">
                  <td colSpan={3} className="px-3 py-2 text-xs font-bold text-[#0d1f35] text-right">Total</td>
                  <td className="px-3 py-2 text-xs font-bold text-[#1a56db] text-right">
                    {formatCurrency(order.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Hidden printable receipt */}
      <div className="print-receipt-container hidden">
        <PrintableReceipt order={order} />
      </div>
    </div>
  );
}
