import { useState, useEffect, useMemo } from 'react';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { format, startOfDay, subDays, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ShoppingCart, Clock, Users, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { statusBadge } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

const PAGE_SIZE = 12;

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  processing: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
};

// --- Sub-components ---

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  trend?: number;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', accent)}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{title}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        {trend !== undefined ? (
          <div
            className={cn('flex items-center gap-1 mt-1 text-[11px] font-medium', {
              'text-green-600': trend > 0,
              'text-red-500': trend < 0,
              'text-muted-foreground': trend === 0,
            })}
          >
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {trend === 0 ? 'No change' : `${Math.abs(trend).toFixed(0)}% vs yesterday`}
          </div>
        ) : (
          sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export function DashboardPage() {
  const { orders, loading, error, refetch } = useRealtimeOrders();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const [collectors, setCollectors] = useState<Profile[]>([]);
  const [collectorsLoading, setCollectorsLoading] = useState(true);

  const [yesterdayData, setYesterdayData] = useState<{
    revenue: number;
    orders: number;
    collectors: number;
  } | null>(null);

  useEffect(() => {
    async function fetchYesterday() {
      const yesterday = subDays(new Date(), 1);
      const start = startOfDay(yesterday).toISOString();
      const end = endOfDay(yesterday).toISOString();

      const { data } = await supabase
        .from('orders')
        .select('total_amount, status, collector_id')
        .gte('created_at', start)
        .lte('created_at', end);

      if (data) {
        setYesterdayData({
          revenue: data.filter((o) => o.status === 'completed').reduce((sum, o) => sum + (o.total_amount || 0), 0),
          orders: data.length,
          collectors: new Set(data.map((o) => o.collector_id)).size,
        });
      }
    }

    async function fetchCollectors() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'collector')
        .eq('is_active', true)
        .order('nickname');
      setCollectors((data as Profile[]) || []);
      setCollectorsLoading(false);
    }

    fetchYesterday();
    fetchCollectors();
  }, []);

  const { pendingOrders, todayOrders, todayRevenue, activeCollectors } = useMemo(() => {
    const today = new Date().toDateString();
    const pending = orders.filter((o) => o.status === 'pending');
    const todayOrd = orders.filter((o) => new Date(o.created_at).toDateString() === today);
    const revenue = todayOrd
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + o.total_amount, 0);
    const collectorCount = new Set(todayOrd.map((o) => o.collector_id)).size;
    return { pendingOrders: pending, todayOrders: todayOrd, todayRevenue: revenue, activeCollectors: collectorCount };
  }, [orders]);

  const trends = useMemo(() => {
    if (!yesterdayData) return { revenue: undefined, orders: undefined, collectors: undefined };
    function calc(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    }
    return {
      revenue: calc(todayRevenue, yesterdayData.revenue),
      orders: calc(todayOrders.length, yesterdayData.orders),
      collectors: calc(activeCollectors, yesterdayData.collectors),
    };
  }, [todayRevenue, todayOrders.length, activeCollectors, yesterdayData]);

  const collectorStatusToday = useMemo(() => {
    const completedIds = new Set(
      todayOrders.filter((o) => o.status === 'completed').map((o) => o.collector_id)
    );
    const activeIds = new Set(todayOrders.map((o) => o.collector_id));
    return collectors.map((c) => ({
      ...c,
      hasCompleted: completedIds.has(c.id),
      hasActivity: activeIds.has(c.id),
    }));
  }, [collectors, todayOrders]);

  // Status counts for sidebar
  const statusCounts = useMemo(() => {
    const statuses = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];
    const total = orders.length;
    return statuses
      .map((s) => ({ status: s, count: orders.filter((o) => o.status === s).length, total }))
      .filter(({ count }) => count > 0);
  }, [orders]);

  // Pagination
  const recentOrders = orders.slice(0, 60);
  const totalPages = Math.max(1, Math.ceil(recentOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = recentOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  if (error) {
    return (
      <div className="p-4 bg-background min-h-full">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button onClick={refetch} className="text-xs text-primary hover:text-primary/80 font-medium">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-background min-h-full flex flex-col">
      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard title="Today Revenue" value={formatCurrency(todayRevenue)} sub="from completed orders" icon={TrendingUp} accent="bg-blue-50 text-blue-600" trend={trends.revenue} />
          <MetricCard title="Today Orders" value={todayOrders.length} sub="orders placed today" icon={ShoppingCart} accent="bg-indigo-50 text-indigo-600" trend={trends.orders} />
          <MetricCard title="Pending" value={pendingOrders.length} sub="awaiting confirmation" icon={Clock} accent="bg-amber-50 text-amber-600" />
          <MetricCard title="Active Collectors" value={activeCollectors} sub="active today" icon={Users} accent="bg-emerald-50 text-emerald-600" trend={trends.collectors} />
        </div>
      )}

      {/* Main content: Orders table + right sidebar */}
      <div className="flex gap-3 flex-col lg:flex-row flex-1 min-h-0">
        {/* Recent Orders — primary focus */}
        <div className="bg-card border border-border rounded-lg flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Recent Orders</p>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="p-4 space-y-3 flex-1">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded flex-1" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-16 text-center px-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center mx-auto mb-3">
                <ShoppingCart size={18} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No orders yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Orders will appear here as collectors submit them from the mobile app.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => navigate('/orders')}
                  className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15 transition-colors"
                >
                  View Orders
                </button>
                <button
                  onClick={() => navigate('/products')}
                  className="px-3 py-1.5 text-xs font-medium text-foreground/80 bg-background rounded-lg hover:bg-muted transition-colors"
                >
                  View Products
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-4 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Order</th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Store</th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Collector</th>
                      <th className="px-4 py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="px-4 py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-muted hover:bg-secondary cursor-pointer transition-colors"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <td className="px-4 py-2.5 text-xs font-mono text-foreground font-semibold whitespace-nowrap">
                          {order.order_number}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground/80 hidden sm:table-cell">
                          <span className="truncate block max-w-[160px]">{order.stores?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground/80 hidden md:table-cell">
                          <span className="truncate block max-w-[140px]">{order.profiles?.nickname || order.profiles?.full_name || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-foreground text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium capitalize', statusBadge[order.status])}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-muted-foreground text-right hidden lg:table-cell tabular-nums whitespace-nowrap">
                          {format(new Date(order.created_at), 'MMM d, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-2 border-t border-border bg-secondary flex justify-between items-center mt-auto rounded-b-lg">
                <p className="text-[11px] text-muted-foreground">
                  {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, recentOrders.length)} of {recentOrders.length}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={safePage === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="text-[11px] px-2 py-0.5 rounded border border-border text-foreground/80 hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <span className="text-[11px] text-foreground/80 tabular-nums">{safePage}/{totalPages}</span>
                    <button
                      disabled={safePage === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="text-[11px] px-2 py-0.5 rounded border border-border text-foreground/80 hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right sidebar — compact widgets */}
        <div className="lg:w-[260px] flex-shrink-0 space-y-3">
          {/* Status Breakdown — compact counters */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-foreground/80 uppercase tracking-wide mb-3">Status Breakdown</p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : statusCounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No orders</p>
            ) : (
              <div className="space-y-2">
                {statusCounts.map(({ status, count, total }) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
                      <span className="text-xs text-foreground/80 capitalize flex-1">{status}</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums">{count}</span>
                      <div className="w-12 bg-background rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 mt-1 border-t border-muted flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Total</span>
                  <span className="text-xs font-bold text-foreground">{orders.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Collector Status Today — compact list */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">Collectors Today</p>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {collectorStatusToday.filter((c) => c.hasCompleted).length}/{collectorStatusToday.length}
              </span>
            </div>
            {collectorsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-5 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : collectorStatusToday.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-xs text-muted-foreground">No active collectors</p>
                <button
                  onClick={() => navigate('/users')}
                  className="mt-1 text-[11px] text-primary hover:text-primary/80 font-medium"
                >
                  Manage collectors
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {collectorStatusToday.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-1">
                    {c.hasCompleted ? (
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                    ) : c.hasActivity ? (
                      <Clock size={13} className="text-amber-500 flex-shrink-0" />
                    ) : (
                      <XCircle size={13} className="text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className="text-xs text-foreground flex-1 truncate">
                      {c.nickname || c.full_name}
                    </span>
                    <span
                      className={cn('text-[10px] font-medium', {
                        'text-emerald-600': c.hasCompleted,
                        'text-amber-600': !c.hasCompleted && c.hasActivity,
                        'text-muted-foreground': !c.hasActivity,
                      })}
                    >
                      {c.hasCompleted ? 'Done' : c.hasActivity ? 'Active' : 'Idle'}
                    </span>
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
