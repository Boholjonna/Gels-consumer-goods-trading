import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { clsx } from 'clsx';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ChevronRight, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { statusBadge } from '@/lib/constants';
import type { Order } from '@/types';

const statusFilters = ['all', 'pending', 'confirmed', 'processing', 'completed', 'cancelled'] as const;
const PAGE_SIZE = 20;

export function OrdersPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  const { orders, loading, error, refetch } = useRealtimeOrders();

  async function handleDeleteOrder() {
    if (!deleteTarget) return;
    try {
      // order_items cascade automatically via ON DELETE CASCADE
      const { error: err } = await supabase
        .from('orders')
        .delete()
        .eq('id', deleteTarget.id);
      if (err) throw err;
      toast.success('Order removed');
      refetch();
    } catch {
      toast.error('Failed to remove order');
    } finally {
      setDeleteTarget(null);
    }
  }

  const filteredOrders = useMemo(() => {
    let result = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.stores?.name || '').toLowerCase().includes(q) ||
          (o.profiles?.nickname || o.profiles?.full_name || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  // Reset page when filters change
  function handleStatusChange(status: string) {
    setStatusFilter(status);
    setPage(1);
  }
  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="p-3 bg-[#f0f4f8] min-h-full">
      {/* Search + Status filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0b8]"
          />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#e2ecf9] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a56db] focus:border-[#1a56db]"
          />
        </div>
      </div>

      <div className="bg-white border border-[#e2ecf9] rounded-lg p-2 mb-3 flex gap-1.5 overflow-x-auto flex-wrap">
        {statusFilters.map((status) => {
          const count = status === 'all' ? orders.length : orders.filter((o) => o.status === status).length;
          return (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={clsx(
                'px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1',
                statusFilter === status
                  ? 'bg-[#1a56db] text-white'
                  : 'text-[#4b5e73] hover:bg-[#f0f4f8]'
              )}
            >
              <span className="capitalize">{status === 'all' ? 'All' : status}</span>
              <span
                className={clsx(
                  'text-[10px] px-1 rounded',
                  statusFilter === status ? 'bg-white/20' : 'bg-[#f0f4f8]'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-xs text-red-500 mb-2">{error}</p>
            <button onClick={refetch} className="text-xs text-[#1a56db] hover:text-[#1447c0] font-medium">
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-1">
                <div className="h-3 bg-gray-200 rounded w-24" />
                <div className="h-3 bg-gray-200 rounded flex-1" />
                <div className="h-3 bg-gray-200 rounded w-16" />
                <div className="h-3 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-[#8aa0b8]">
              {search ? 'No orders match your search' : 'No orders match this filter'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Order</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden sm:table-cell">Date/Time</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden md:table-cell">Store</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden lg:table-cell">Collector</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[#8aa0b8] uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className="border-b border-[#f0f4f8] hover:bg-[#f8fafd] cursor-pointer transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-3 py-2 text-xs text-[#8aa0b8]">{startIdx + idx + 1}</td>
                    <td className="px-3 py-2">
                      <p className="text-xs font-mono font-semibold text-[#0d1f35]">
                        {order.order_number}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] hidden sm:table-cell">
                      {format(new Date(order.created_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] hidden md:table-cell">
                      {order.stores?.name || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] hidden lg:table-cell">
                      {order.profiles?.nickname || order.profiles?.full_name || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={clsx(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
                          statusBadge[order.status]
                        )}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-[#0d1f35] text-right">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(order); }}
                          className="p-1 text-[#8aa0b8] hover:text-red-500 transition-colors"
                          title="Delete order"
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="text-[#8aa0b8]" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="px-3 py-2 border-t border-[#e2ecf9] bg-[#f8fafd] flex justify-between items-center">
            <p className="text-[10px] text-[#8aa0b8]">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-[10px] px-2 py-0.5 rounded border border-[#e2ecf9] text-[#4b5e73] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="text-[10px] text-[#4b5e73]">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  disabled={safePage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-[10px] px-2 py-0.5 rounded border border-[#e2ecf9] text-[#4b5e73] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Remove Order"
          message={`Remove order ${deleteTarget.order_number} from history? This cannot be undone.`}
          confirmLabel="Remove"
          onConfirm={handleDeleteOrder}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
