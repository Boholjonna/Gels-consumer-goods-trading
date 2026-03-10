import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { clsx } from 'clsx';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';

const statusFilters = ['all', 'pending', 'confirmed', 'processing', 'completed', 'cancelled'] as const;

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-500',
};

export function OrdersPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { orders, loading, error, refetch } = useRealtimeOrders();

  const filteredOrders =
    statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="p-4 bg-[#f0f4f8] min-h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#0d1f35]">Orders</p>
        <p className="text-xs text-[#8aa0b8]">{orders.length} total</p>
      </div>

      {/* Status filter bar */}
      <div className="bg-white border border-[#e2ecf9] rounded-lg p-2 mb-3 flex gap-1.5 overflow-x-auto flex-wrap">
        {statusFilters.map((status) => {
          const count = status === 'all' ? orders.length : orders.filter((o) => o.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
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
            <p className="text-xs text-[#8aa0b8]">No orders match this filter</p>
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
                {filteredOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className="border-b border-[#f0f4f8] hover:bg-[#f8fafd] cursor-pointer transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-3 py-2 text-xs text-[#8aa0b8]">{idx + 1}</td>
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
                      {(order.profiles as any)?.nickname || order.profiles?.full_name || '—'}
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
                      <ChevronRight size={14} className="text-[#8aa0b8] inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
