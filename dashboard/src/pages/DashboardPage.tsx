import { useMemo } from 'react';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { TrendingUp, ShoppingCart, Clock, Users, ArrowRight } from 'lucide-react';
import { statusBadge } from '@/lib/constants';
import type { Order } from '@/types';

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#e2ecf9] rounded-lg p-3 flex items-start gap-3">
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', accent)}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#8aa0b8] mb-0.5">{title}</p>
        <p className="text-base font-bold text-[#0d1f35] leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-[#8aa0b8] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusDistribution({ orders }: { orders: Order[] }) {
  const statuses = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];
  const counts = statuses.map((s) => ({
    status: s,
    count: orders.filter((o) => o.status === s).length,
  }));
  const total = orders.length;

  return (
    <div className="space-y-2">
      {counts.map(({ status, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={status} className="flex items-center gap-2">
            <span
              className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-medium w-[80px] text-center capitalize',
                statusBadge[status]
              )}
            >
              {status}
            </span>
            <div className="flex-1 bg-[#f0f4f8] rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-[#1a56db]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-[#4b5e73] w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const { orders, loading, error, refetch } = useRealtimeOrders();
  const navigate = useNavigate();

  const { pendingOrders, todayOrders, todayRevenue, activeCollectors } = useMemo(() => {
    const today = new Date().toDateString();
    const pending = orders.filter((o) => o.status === 'pending');
    const todayOrd = orders.filter((o) => new Date(o.created_at).toDateString() === today);
    const revenue = todayOrd.reduce((sum, o) => sum + o.total_amount, 0);
    const collectors = new Set(todayOrd.map((o) => o.collector_id)).size;
    return { pendingOrders: pending, todayOrders: todayOrd, todayRevenue: revenue, activeCollectors: collectors };
  }, [orders]);

  const recentOrders = orders.slice(0, 10);

  if (error) {
    return (
      <div className="p-3 bg-[#f0f4f8] min-h-full">
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-6 text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button
            onClick={refetch}
            className="text-xs text-[#1a56db] hover:text-[#1447c0] font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#f0f4f8] min-h-full">
      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-[#e2ecf9] rounded-lg p-3 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <MetricCard
            title="Today Revenue"
            value={formatCurrency(todayRevenue)}
            sub="from completed orders"
            icon={TrendingUp}
            accent="bg-blue-50 text-blue-600"
          />
          <MetricCard
            title="Today Orders"
            value={todayOrders.length}
            sub="orders placed today"
            icon={ShoppingCart}
            accent="bg-indigo-50 text-indigo-600"
          />
          <MetricCard
            title="Pending"
            value={pendingOrders.length}
            sub="awaiting confirmation"
            icon={Clock}
            accent="bg-amber-50 text-amber-600"
          />
          <MetricCard
            title="Active Collectors"
            value={activeCollectors}
            sub="active today"
            icon={Users}
            accent="bg-emerald-50 text-emerald-600"
          />
        </div>
      )}

      {/* Main two-column area */}
      <div className="flex gap-2 flex-col lg:flex-row">
        {/* Recent Orders table */}
        <div className="bg-white border border-[#e2ecf9] rounded-lg flex-1 min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2ecf9]">
            <p className="text-xs font-semibold text-[#0d1f35]">Recent Orders</p>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1 text-[10px] text-[#1a56db] hover:text-[#1447c0] font-medium"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded flex-1" />
                  <div className="h-3 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-[#8aa0b8]">No orders yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2ecf9]">
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Order #</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden sm:table-cell">Store</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden md:table-cell">Collector</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden lg:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-[#f0f4f8] hover:bg-[#f8fafd] cursor-pointer transition-colors"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <td className="px-3 py-2 text-xs font-mono text-[#0d1f35] font-medium">
                        {order.order_number}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#4b5e73] hidden sm:table-cell">
                        {order.stores?.name || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#4b5e73] hidden md:table-cell">
                        {order.profiles?.nickname || order.profiles?.full_name || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-[#0d1f35]">
                        {formatCurrency(order.total_amount)}
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
                      <td className="px-3 py-2 text-[10px] text-[#8aa0b8] hidden lg:table-cell">
                        {format(new Date(order.created_at), 'HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:w-[260px] flex-shrink-0 space-y-2">
          {/* Status breakdown */}
          <div className="bg-white border border-[#e2ecf9] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#4b5e73] uppercase tracking-wide mb-3">
              Status Breakdown
            </p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <StatusDistribution orders={orders} />
            )}
          </div>

          {/* Today's timeline */}
          <div className="bg-white border border-[#e2ecf9] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#4b5e73] uppercase tracking-wide mb-3">
              Today's Activity
            </p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : todayOrders.length === 0 ? (
              <p className="text-xs text-[#8aa0b8] text-center py-4">No activity today</p>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {todayOrders.slice(0, 8).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-[#f8fafd] rounded px-1 py-0.5 transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="w-1 h-1 rounded-full bg-[#1a56db] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-[#0d1f35] truncate">
                        {order.order_number}
                      </p>
                      <p className="text-[10px] text-[#8aa0b8]">
                        {order.stores?.name || '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-semibold text-[#0d1f35]">
                        {formatCurrency(order.total_amount)}
                      </p>
                      <span
                        className={clsx(
                          'text-[9px] px-1 py-0.5 rounded capitalize font-medium',
                          statusBadge[order.status]
                        )}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
