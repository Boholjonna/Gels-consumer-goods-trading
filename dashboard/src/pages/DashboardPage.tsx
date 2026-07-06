import { useState, useEffect, useMemo } from 'react';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { getPricelist } from '@/lib/parsePricelist';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { formatDistanceToNow, startOfDay, subDays, endOfDay, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingCart,
  Clock,
  Users,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileEdit,
  AlertTriangle,
  Package,
  Store,
  Plus,
  BarChart3,
  DollarSign,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Product } from '@/types';

type TimeRange = 'today' | 'week' | 'month';

const STATUS_COLORS: Record<string, string> = {
  pending: '#E5C07B',
  confirmed: '#5B9BD5',
  processing: '#C678DD',
  completed: '#98C379',
  cancelled: '#E06C75',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-[#E5C07B]/10 text-[#E5C07B]',
  confirmed: 'bg-[#5B9BD5]/10 text-[#5B9BD5]',
  processing: 'bg-[#C678DD]/10 text-[#C678DD]',
  completed: 'bg-[#98C379]/10 text-[#98C379]',
  cancelled: 'bg-[#E06C75]/10 text-[#E06C75]',
};

const ALL_STATUSES = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];

// --- Sparkline ---

function Sparkline({ data, color = '#5B9BD5' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 56;
  const h = 18;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="flex-shrink-0" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Hourly bar chart ---

function HourlyChart({ data, labels, color = '#5B9BD5' }: { data: number[]; labels?: string[]; color?: string }) {
  const padded = !labels && data.length < 12 ? [...data, ...Array(12 - data.length).fill(0)] : data;
  const max = Math.max(...padded, 1);
  const labelStep = padded.length <= 12 ? 2 : padded.length <= 16 ? 2 : 3;
  const barArea = 76; // px available for bars (remaining ~14px for label + gap)
  return (
    <div className="flex gap-[3px] h-[90px]">
      {padded.map((v, i) => {
        const isFuture = !labels && i >= data.length;
        const label = labels ? labels[i] : String(i).padStart(2, '0');
        const barPx = isFuture ? 2 : v > 0 ? Math.max(Math.round((v / max) * barArea), 6) : 2;
        return (
          <div key={i} className="flex flex-col justify-end items-center gap-1 flex-1 min-w-0">
            <div
              className="w-full max-w-[14px] rounded-t-sm mx-auto"
              title={`${label}: ${v}`}
              style={{
                height: `${barPx}px`,
                backgroundColor: isFuture ? '#1E3F5E' : v > 0 ? color : '#1E3F5E',
                opacity: isFuture ? 0.15 : v > 0 ? (0.6 + (v / max) * 0.4) : 0.3,
              }}
            />
            {i % labelStep === 0 && (
              <span className={cn('text-[8px] tabular-nums leading-none', isFuture ? 'text-[#8FAABE]/15' : 'text-[#8FAABE]/40')}>{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Metric Card ---

function MetricCard({ title, value, icon: Icon, accent, trend, sparkData, sparkColor }: {
  title: string; value: string | number; icon: React.ElementType; accent: string;
  trend?: number; sparkData?: number[]; sparkColor?: string;
}) {
  return (
    <section className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4 flex flex-col gap-2 hover:bg-[#1A3755] transition-colors duration-150">
      <div className="flex items-center justify-between">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', accent)}>
          <Icon size={14} />
        </div>
        {sparkData && sparkData.length >= 2 && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div>
        <p className="text-[10px] text-[#8FAABE]/50 font-semibold uppercase tracking-wider">{title}</p>
        <div className="flex items-end gap-1.5">
          <p className="text-xl font-extrabold text-[#E8EDF2] leading-tight tabular-nums">{value}</p>
          {trend !== undefined && (
            <div className={cn('flex items-center gap-0.5 text-[10px] font-medium pb-0.5', {
              'text-[#98C379]': trend > 0, 'text-[#E06C75]': trend < 0, 'text-[#8FAABE]/50': trend === 0,
            })}>
              {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
              {trend === 0 ? '0%' : `${Math.abs(trend).toFixed(0)}%`}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// --- Time filter pills ---

function TimeFilter({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  const options: { key: TimeRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ];
  return (
    <div className="flex items-center bg-[#0D1F33] rounded-lg p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none',
            value === o.key ? 'bg-[#1A3755] text-[#E8EDF2]' : 'text-[#8FAABE]/50 hover:text-[#8FAABE]'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- Main Page ---

export function DashboardPage() {
  const { orders, loading, error, refetch } = useRealtimeOrders();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [pricelistMap, setPricelistMap] = useState<Record<string, any>>({});

  const [collectors, setCollectors] = useState<Profile[]>([]);
  const [collectorsLoading, setCollectorsLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [lowStockLoading, setLowStockLoading] = useState(true);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [yesterdayData, setYesterdayData] = useState<{ revenue: number; orders: number; collectors: number } | null>(null);

  // Load pricelist
  useEffect(() => {
    getPricelist().then(setPricelistMap);
  }, []);

  useEffect(() => {
    async function fetchYesterday() {
      const yesterday = subDays(new Date(), 1);
      const { data } = await supabase.from('orders').select('total_amount, status, collector_id')
        .gte('created_at', startOfDay(yesterday).toISOString())
        .lte('created_at', endOfDay(yesterday).toISOString());
      if (data) {
        setYesterdayData({
          revenue: data.filter((o) => o.status === 'completed').reduce((sum, o) => sum + (o.total_amount || 0), 0),
          orders: data.length,
          collectors: new Set(data.map((o) => o.collector_id)).size,
        });
      }
    }
    async function fetchCollectors() {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'collector').eq('is_active', true).order('nickname');
      setCollectors((data as Profile[]) || []);
      setCollectorsLoading(false);
    }
    async function fetchLowStock() {
      const { data } = await supabase.from('products').select('*').eq('is_active', true).lte('stock_quantity', 30).order('stock_quantity', { ascending: true }).limit(5);
      setLowStockProducts((data as Product[]) || []);
      setLowStockLoading(false);
    }
    async function fetchStores() {
      const { data } = await supabase.from('stores').select('id, name').eq('is_active', true).order('name');
      setStores(data || []);
      setStoresLoading(false);
    }
    fetchYesterday();
    fetchCollectors();
    fetchLowStock();
    fetchStores();
  }, []);

  // Filter orders based on time range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    if (timeRange === 'today') {
      const todayStr = now.toDateString();
      return orders.filter((o) => new Date(o.created_at).toDateString() === todayStr);
    }
    if (timeRange === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      return orders.filter((o) => new Date(o.created_at) >= weekStart);
    }
    // month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return orders.filter((o) => new Date(o.created_at) >= monthStart);
  }, [orders, timeRange]);

  const { pendingOrders, todayOrders, rangeRevenue, rangeProfit, activeCollectors } = useMemo(() => {
    const today = new Date().toDateString();
    const pending = orders.filter((o) => o.status === 'pending');
    const todayOrd = orders.filter((o) => new Date(o.created_at).toDateString() === today);
    const revenue = filteredOrders.filter((o) => o.status === 'completed').reduce((sum, o) => sum + o.total_amount, 0);
    
    // Calculate profit
    let profit = 0;
    for (const order of filteredOrders.filter((o) => o.status === 'completed')) {
      for (const item of order.order_items || []) {
        const priceData = pricelistMap[item.product_name];
        if (priceData) {
          const profitPerUnit = priceData.retail_price - priceData.withdrawal_price;
          profit += profitPerUnit * item.quantity;
        }
      }
    }
    
    
    const collectorCount = new Set(filteredOrders.map((o) => o.collector_id)).size;
    return { pendingOrders: pending, todayOrders: todayOrd, rangeRevenue: revenue, rangeProfit: profit, activeCollectors: collectorCount };
  }, [orders, filteredOrders, pricelistMap]);

  const trends = useMemo(() => {
    if (!yesterdayData || timeRange !== 'today') return { revenue: undefined, orders: undefined, collectors: undefined };
    const calc = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;
    return {
      revenue: calc(rangeRevenue, yesterdayData.revenue),
      orders: calc(todayOrders.length, yesterdayData.orders),
      collectors: calc(activeCollectors, yesterdayData.collectors),
    };
  }, [rangeRevenue, todayOrders.length, activeCollectors, yesterdayData, timeRange]);

  const hourlyData = useMemo(() => {
    if (timeRange === 'today') {
      const buckets = Array(24).fill(0);
      filteredOrders.forEach((o) => {
        const h = new Date(o.created_at).getHours();
        buckets[h]++;
      });
      const revBuckets = Array(24).fill(0);
      filteredOrders.filter((o) => o.status === 'completed').forEach((o) => {
        const h = new Date(o.created_at).getHours();
        revBuckets[h] += o.total_amount;
      });
      return { orders: buckets, revenue: revBuckets, labels: undefined as string[] | undefined };
    }
    // Week/month: show daily buckets
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (timeRange === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const buckets = Array(7).fill(0);
      const revBuckets = Array(7).fill(0);
      const labels: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        labels.push(dayNames[d.getDay()]);
      }
      filteredOrders.forEach((o) => {
        const d = new Date(o.created_at);
        const diff = Math.floor((d.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < 7) {
          buckets[diff]++;
          if (o.status === 'completed') revBuckets[diff] += o.total_amount;
        }
      });
      return { orders: buckets, revenue: revBuckets, labels };
    }

    // Month: daily buckets
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayCount = Math.min(now.getDate(), daysInMonth);
    const buckets = Array(dayCount).fill(0);
    const revBuckets = Array(dayCount).fill(0);
    const labels = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
      return i === 0 || (i + 1) % 5 === 0 || i === dayCount - 1
        ? `${monthNames[d.getMonth()]} ${i + 1}`
        : String(i + 1);
    });
    filteredOrders.forEach((o) => {
      const d = new Date(o.created_at);
      const dayIdx = d.getDate() - 1;
      if (dayIdx >= 0 && dayIdx < dayCount) {
        buckets[dayIdx]++;
        if (o.status === 'completed') revBuckets[dayIdx] += o.total_amount;
      }
    });
    return { orders: buckets, revenue: revBuckets, labels };
  }, [filteredOrders, timeRange]);

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    filteredOrders.filter((o) => o.status === 'completed').forEach((o) => {
      o.order_items?.forEach((item) => {
        const existing = productMap.get(item.product_name) || { name: item.product_name, qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.line_total;
        productMap.set(item.product_name, existing);
      });
    });
    return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredOrders]);

  const storePerformance = useMemo(() => {
    if (storesLoading) return [];
    const storeMap = new Map<string, { name: string; orders: number; revenue: number }>();
    stores.forEach((s) => storeMap.set(s.id, { name: s.name, orders: 0, revenue: 0 }));
    filteredOrders.forEach((o) => {
      const entry = storeMap.get(o.store_id);
      if (entry) { entry.orders++; if (o.status === 'completed') entry.revenue += o.total_amount; }
    });
    return Array.from(storeMap.values()).filter((s) => s.orders > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredOrders, stores, storesLoading]);

  const collectorStatusToday = useMemo(() => {
    const completedIds = new Set(todayOrders.filter((o) => o.status === 'completed').map((o) => o.collector_id));
    const activeIds = new Set(todayOrders.map((o) => o.collector_id));
    return collectors.map((c) => ({
      ...c, hasCompleted: completedIds.has(c.id), hasActivity: activeIds.has(c.id),
    }));
  }, [collectors, todayOrders]);

  const statusCounts = useMemo(() => {
    return ALL_STATUSES.map((s) => ({ status: s, count: filteredOrders.filter((o) => o.status === s).length }));
  }, [filteredOrders]);

  // Is order "new" (created within last 30 min)
  const isNewOrder = (createdAt: string) => {
    return Date.now() - new Date(createdAt).getTime() < 30 * 60 * 1000;
  };

  const recentOrders = orders.slice(0, 5);

  if (error) {
    return (
      <div className="p-4 min-h-full bg-[#0D1F33]">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-6 text-center">
          <p className="text-sm text-[#E06C75] mb-3">{error}</p>
          <button onClick={refetch} className="text-xs text-[#5B9BD5] hover:text-[#7EB8E0] font-medium focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none rounded px-2 py-1">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#0D1F33] min-h-full flex flex-col gap-3">
      {/* Header: Time filter + Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <TimeFilter value={timeRange} onChange={setTimeRange} />
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate('/orders')} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium bg-[#5B9BD5] text-white rounded-lg hover:bg-[#4A8BC4] transition-colors focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1F33] focus-visible:outline-none">
            <Plus size={11} /> New Order
          </button>
          <button onClick={() => navigate('/products/new')} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium bg-[#1A3755] text-[#8FAABE] rounded-lg hover:bg-[#1E3F5E] hover:text-[#E8EDF2] transition-colors border border-[#1E3F5E]/60 focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none">
            <Package size={11} /> Add Product
          </button>
          <button onClick={() => navigate('/analytics')} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium bg-[#1A3755] text-[#8FAABE] rounded-lg hover:bg-[#1E3F5E] hover:text-[#E8EDF2] transition-colors border border-[#1E3F5E]/60 focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none">
            <BarChart3 size={11} /> Analytics
          </button>
        </div>
      </div>

      {/* Row 1: KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4 animate-pulse">
              <div className="h-8 w-8 bg-[#1A3755] rounded-lg mb-2" />
              <div className="h-3 bg-[#1A3755] rounded w-16 mb-1.5" />
              <div className="h-5 bg-[#1A3755] rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Revenue" value={formatCurrency(rangeRevenue)} icon={TrendingUp} accent="bg-[#5B9BD5]/15 text-[#5B9BD5]" trend={trends.revenue} sparkData={hourlyData.revenue} sparkColor="#5B9BD5" />
          <MetricCard title="Profit" value={formatCurrency(rangeProfit)} icon={DollarSign} accent="bg-[#98C379]/15 text-[#98C379]" />
          <MetricCard title="Orders" value={filteredOrders.length} icon={ShoppingCart} accent="bg-[#7EB8E0]/15 text-[#7EB8E0]" trend={trends.orders} sparkData={hourlyData.orders} sparkColor="#7EB8E0" />
          <MetricCard title="Pending" value={pendingOrders.length} icon={Clock} accent="bg-[#E5C07B]/15 text-[#E5C07B]" />
          <MetricCard title="Collectors" value={activeCollectors} icon={Users} accent="bg-[#98C379]/15 text-[#98C379]" trend={trends.collectors} />
        </div>
      )}

      {/* Row 2: Hourly chart (2 cols) + Order Status (1 col) + Collectors (1 col) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Activity Chart */}
        <section className="md:col-span-2 bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4 min-h-[120px]">
          <h2 className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider mb-3">
            {timeRange === 'today' ? 'Hourly Activity' : timeRange === 'week' ? 'Daily Activity (This Week)' : 'Daily Activity (This Month)'}
          </h2>
          {loading ? (
            <div className="h-[90px] bg-[#1A3755] rounded animate-pulse" />
          ) : hourlyData.orders.every((v) => v === 0) ? (
            <div className="flex flex-col items-center justify-center h-[90px] gap-1.5">
              <BarChart3 size={18} className="text-[#8FAABE]/15" />
              <p className="text-[11px] text-[#8FAABE]/40 font-medium">No activity recorded</p>
              <p className="text-[9px] text-[#8FAABE]/25">Orders will appear here once transactions start</p>
            </div>
          ) : (
            <HourlyChart data={hourlyData.orders} labels={hourlyData.labels} color="#5B9BD5" />
          )}
        </section>

        {/* Order Status — compact bars */}
        <section className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4 min-h-[120px]">
          <h2 className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider mb-3">Order Status</h2>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-[#1A3755] rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-1.5">
              {statusCounts.map(({ status, count }) => {
                const total = filteredOrders.length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
                    <span className="text-[10px] text-[#8FAABE]/70 capitalize w-16 truncate">{status}</span>
                    <div className="flex-1 h-1.5 bg-[#0D1F33] rounded-full">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] }} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#E8EDF2] tabular-nums w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Collectors */}
        <section className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4 min-h-[120px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider">Collectors</h2>
            <span className="text-[9px] text-[#8FAABE]/30 tabular-nums font-medium">
              {collectorStatusToday.filter((c) => c.hasActivity).length} active / {collectorStatusToday.length} total
            </span>
          </div>
          {collectorsLoading ? (
            <div className="space-y-1.5">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-[#1A3755] rounded animate-pulse" />)}</div>
          ) : collectorStatusToday.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 gap-1">
              <Users size={14} className="text-[#8FAABE]/20" />
              <p className="text-[10px] text-[#8FAABE]/40">No collectors registered</p>
            </div>
          ) : (
            <div className="space-y-1">
              {collectorStatusToday.map((c) => {
                const statusLabel = c.hasCompleted ? 'Completed' : c.hasActivity ? 'Delivering' : 'Idle';
                const statusColor = c.hasCompleted ? 'text-[#98C379]' : c.hasActivity ? 'text-[#E5C07B]' : 'text-[#8FAABE]/30';
                const dotColor = c.hasCompleted ? 'bg-[#98C379]' : c.hasActivity ? 'bg-[#E5C07B]' : 'bg-[#8FAABE]/20';
                return (
                  <div key={c.id} className="flex items-center gap-2 py-0.5 group">
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
                    <span className="text-[11px] text-[#E8EDF2]/80 flex-1 truncate font-medium">{c.nickname || c.full_name}</span>
                    <span className={cn('text-[9px] font-semibold', statusColor)}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Row 3: Recent Orders (2 cols) + Top Products (1 col) + Low Stock & Stores (1 col stacked) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Recent Orders — 2 cols */}
        <section className="md:col-span-2 bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl flex flex-col min-h-[200px]">
          <header className="flex items-center justify-between px-4 py-3 border-b border-[#1E3F5E]/60">
            <h2 className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider">Recent Orders</h2>
            <button onClick={() => navigate('/orders')} className="flex items-center gap-1 text-[10px] text-[#5B9BD5] hover:text-[#7EB8E0] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none rounded px-1 py-0.5">
              All orders <ArrowRight size={10} />
            </button>
          </header>
          {loading ? (
            <div className="p-4 space-y-2 flex-1">{[...Array(5)].map((_, i) => <div key={i} className="flex gap-2 animate-pulse"><div className="h-3.5 bg-[#1A3755] rounded w-16" /><div className="h-3.5 bg-[#1A3755] rounded flex-1" /><div className="h-3.5 bg-[#1A3755] rounded w-14" /></div>)}</div>
          ) : recentOrders.length === 0 ? (
            <div className="py-8 text-center px-4 flex-1 flex flex-col items-center justify-center">
              <ShoppingCart size={16} className="text-[#8FAABE]/30 mx-auto mb-2" />
              <p className="text-xs text-[#8FAABE]/50">No orders yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E3F5E]/40">
                  <th className="px-4 py-2 text-left text-[10px] font-medium text-[#8FAABE]/50 uppercase tracking-wide">Order</th>
                  <th className="px-4 py-2 text-left text-[10px] font-medium text-[#8FAABE]/50 uppercase tracking-wide hidden sm:table-cell">Time</th>
                  <th className="px-4 py-2 text-left text-[10px] font-medium text-[#8FAABE]/50 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium text-[#8FAABE]/50 uppercase tracking-wide">Total</th>
                  <th className="w-16"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-[#1E3F5E]/20 last:border-0 hover:bg-[#1A3755]/40 cursor-pointer transition-colors group" onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-[#E8EDF2] font-semibold whitespace-nowrap">{order.order_number}</span>
                        {isNewOrder(order.created_at) && (
                          <span className="px-1 py-px text-[8px] font-bold bg-[#5B9BD5]/15 text-[#5B9BD5] rounded uppercase leading-tight">New</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[11px] text-[#8FAABE]/50 hidden sm:table-cell whitespace-nowrap">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</td>
                    <td className="px-4 py-2">
                      <span className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-semibold capitalize', STATUS_BADGE[order.status])}>{order.status}</span>
                    </td>
                    <td className="px-4 py-2 text-[11px] font-semibold text-[#E8EDF2] text-right tabular-nums">{formatCurrency(order.total_amount)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/orders/${order.id}`); }} className="text-[#5B9BD5] hover:text-[#7EB8E0] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none rounded p-1" aria-label={`View order ${order.order_number}`}>
                          <Eye size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/orders/${order.id}`); }} className="text-[#8FAABE]/50 hover:text-[#E8EDF2] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none rounded p-1" aria-label={`Edit order ${order.order_number}`}>
                          <FileEdit size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Top Products */}
        <section className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4 min-h-[200px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider">Top Products</h2>
            <Package size={12} className="text-[#8FAABE]/40" />
          </div>
          {loading ? (
            <div className="space-y-1.5">{[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-[#1A3755] rounded animate-pulse" />)}</div>
          ) : topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1">
              <Package size={14} className="text-[#8FAABE]/20" />
              <p className="text-[10px] text-[#8FAABE]/40">No sales this period</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => {
                const maxRev = topProducts[0]?.revenue || 1;
                const pct = (p.revenue / maxRev) * 100;
                return (
                  <div key={p.name}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold text-[#8FAABE]/30 w-3 tabular-nums">{i + 1}</span>
                      <span className="text-[11px] text-[#E8EDF2] flex-1 truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-[18px]">
                      <div className="flex-1 h-1.5 bg-[#0D1F33] rounded-full">
                        <div className="h-1.5 rounded-full bg-[#5B9BD5]/50 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] text-[#8FAABE]/50 tabular-nums whitespace-nowrap">{p.qty} sold</span>
                      <span className="text-[10px] font-semibold text-[#E8EDF2] tabular-nums whitespace-nowrap">{formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Low Stock + Store Performance stacked */}
        <div className="space-y-3 min-h-[200px]">
          {/* Low Stock — urgency hierarchy */}
          <section className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider">Low Stock</h2>
              <AlertTriangle size={12} className="text-[#E5C07B]/60" />
            </div>
            {lowStockLoading ? (
              <div className="space-y-1.5">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-[#1A3755] rounded animate-pulse" />)}</div>
            ) : lowStockProducts.length === 0 ? (
              <div className="text-center py-2">
                <CheckCircle2 size={14} className="text-[#98C379] mx-auto mb-1" />
                <p className="text-[10px] text-[#8FAABE]/50">Stock healthy</p>
              </div>
            ) : (
              <div className="space-y-1">
                {lowStockProducts.map((p) => {
                  const level = p.stock_quantity === 0 ? 'out' : 'low';
                  const dotColor = level === 'out' ? 'bg-[#E06C75]' : 'bg-[#E5C07B]';
                  const textColor = level === 'out' ? 'text-[#E06C75]' : 'text-[#E5C07B]';
                  const label = level === 'out' ? 'Out' : String(p.stock_quantity);
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-[#1A3755]/50 -mx-1.5 px-1.5 rounded transition-colors" onClick={() => navigate(`/products/${p.id}/edit`)}>
                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
                      <span className="text-[11px] text-[#E8EDF2] flex-1 truncate">{p.name}</span>
                      <span className={cn('text-[10px] font-bold tabular-nums', textColor)}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Store Performance */}
          <section className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider">Stores</h2>
              <button onClick={() => navigate('/stores')} className="text-[#5B9BD5] hover:text-[#7EB8E0] transition-colors focus-visible:ring-2 focus-visible:ring-[#5B9BD5] focus-visible:outline-none rounded" aria-label="View all stores">
                <Store size={12} />
              </button>
            </div>
            {storesLoading || loading ? (
              <div className="space-y-1.5">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-[#1A3755] rounded animate-pulse" />)}</div>
            ) : storePerformance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-2 gap-1">
                <Store size={12} className="text-[#8FAABE]/20" />
                <p className="text-[10px] text-[#8FAABE]/40">No activity this period</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {storePerformance.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#E8EDF2] flex-1 truncate">{s.name}</span>
                    <span className="text-[9px] text-[#8FAABE]/50 tabular-nums">{s.orders}</span>
                    <span className="text-[10px] font-semibold text-[#E8EDF2] tabular-nums">{formatCurrency(s.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
