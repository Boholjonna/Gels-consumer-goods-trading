import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { format, startOfDay, subDays, endOfDay, eachDayOfInterval, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  BarChart2,
  Minus,
  CheckCircle2,
  Users,
  Store,
  Package,
  CalendarDays,
} from 'lucide-react';

type Period = 7 | 14 | 30 | 90 | 'custom';

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface OrderRow {
  total_amount: number;
  created_at: string;
  status: string;
  collector_id: string;
  store_id: string;
}

interface TopProduct {
  product_name: string;
  units: number;
  revenue: number;
  pct: number;
}

interface OrderItemRow {
  product_name: string;
  quantity: number;
  line_total: number;
  orders: {
    created_at: string;
    status: string;
  };
}

interface StoreRow {
  id: string;
  name: string;
}

interface CollectorRow {
  id: string;
  full_name: string;
  nickname: string | null;
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'processing', 'completed'];
const PRODUCTS_PAGE_SIZE = 10;
const DAILY_PAGE_SIZE = 14;

// --- SVG Area Chart ---
function AreaChart({ data, valueKey, color = '#5B9BD5', height = 180 }: { data: DailyData[]; valueKey: 'revenue' | 'orders'; color?: string; height?: number }) {
  const width = 800;
  const paddingLeft = valueKey === 'revenue' ? 60 : 40;
  const paddingRight = 20;
  const paddingTop = 16;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = data.map((d) => d[valueKey]);
  const maxVal = Math.max(...values, 1);

  function xPos(i: number) {
    return paddingLeft + (i / Math.max(data.length - 1, 1)) * chartWidth;
  }
  function yPos(value: number) {
    return paddingTop + chartHeight - (value / maxVal) * chartHeight;
  }

  const points = data.map((d, i) => ({ x: xPos(i), y: yPos(d[valueKey]) }));
  const linePath = points.length > 1 ? points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ') : '';
  const fillPath = points.length > 1 ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z` : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    value: maxVal * t,
    y: paddingTop + chartHeight - t * chartHeight,
  }));

  const xLabelStep = data.length <= 7 ? 1 : data.length <= 14 ? 2 : data.length <= 30 ? 5 : 10;
  const gradientId = `fill-${valueKey}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line x1={paddingLeft} y1={tick.y} x2={width - paddingRight} y2={tick.y} stroke="#1E3F5E" strokeWidth="1" opacity="0.4" />
          <text x={paddingLeft - 6} y={tick.y + 4} fontSize="10" fill="#8FAABE" textAnchor="end" opacity="0.6">
            {valueKey === 'revenue'
              ? tick.value >= 1000 ? `${(tick.value / 1000).toFixed(0)}k` : tick.value.toFixed(0)
              : tick.value.toFixed(0)}
          </text>
        </g>
      ))}
      {fillPath && <path d={fillPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill={color} stroke="#162F4D" strokeWidth="1.5" />
          {i % xLabelStep === 0 && (
            <text x={p.x} y={paddingTop + chartHeight + 18} fontSize="9" fill="#8FAABE" textAnchor="middle" opacity="0.6">
              {format(new Date(data[i].date), 'MMM d')}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// --- Horizontal Bar ---
function HorizontalBar({ label, value, maxValue, formattedValue, subLabel, color = '#5B9BD5' }: {
  label: string; value: number; maxValue: number; formattedValue: string; subLabel?: string; color?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#E8EDF2] truncate flex-1 font-medium">{label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {subLabel && <span className="text-[10px] text-[#8FAABE]/50 tabular-nums">{subLabel}</span>}
          <span className="text-xs font-semibold text-[#E8EDF2] tabular-nums">{formattedValue}</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-[#0D1F33] rounded-full">
        <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// --- KPI Card ---
function KpiCard({ title, value, sub, icon: Icon, trend }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; trend?: number;
}) {
  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;

  return (
    <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-lg font-bold text-[#E8EDF2] tabular-nums">{value}</p>
          {sub && <p className="text-[10px] text-[#8FAABE]/50 mt-0.5">{sub}</p>}
        </div>
        <div className="w-8 h-8 rounded-lg bg-[#0D1F33] flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-[#5B9BD5]" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 mt-2 text-[10px] font-medium', {
          'text-[#98C379]': trendPositive,
          'text-[#E06C75]': trendNegative,
          'text-[#8FAABE]/50': trend === 0,
        })}>
          {trendPositive ? <TrendingUp size={11} /> : trendNegative ? <TrendingDown size={11} /> : <Minus size={11} />}
          {trend === 0 ? 'No change' : `${Math.abs(trend).toFixed(1)}% vs prior period`}
        </div>
      )}
    </div>
  );
}

// --- Hourly heatmap ---
function HourlyHeatmap({ orders }: { orders: OrderRow[] }) {
  const buckets = Array(24).fill(0);
  orders.forEach((o) => { buckets[new Date(o.created_at).getHours()]++; });
  const max = Math.max(...buckets, 1);

  return (
    <div className="flex gap-[3px]">
      {buckets.map((count, h) => {
        const intensity = count / max;
        return (
          <div key={h} className="flex-1 flex flex-col items-center gap-1" title={`${String(h).padStart(2, '0')}:00 — ${count} order${count !== 1 ? 's' : ''}`}>
            <div
              className="w-full aspect-square rounded-sm"
              style={{ backgroundColor: count > 0 ? `rgba(91, 155, 213, ${0.15 + intensity * 0.85})` : 'rgba(30, 63, 94, 0.2)' }}
            />
            {h % 3 === 0 && <span className="text-[7px] text-[#8FAABE]/40 tabular-nums leading-none">{String(h).padStart(2, '0')}</span>}
          </div>
        );
      })}
    </div>
  );
}

// --- Status breakdown ---
function StatusBreakdown({ orders }: { orders: OrderRow[] }) {
  const total = orders.length || 1;
  const statuses = [
    { key: 'completed', label: 'Completed', color: '#98C379' },
    { key: 'processing', label: 'Processing', color: '#C678DD' },
    { key: 'confirmed', label: 'Confirmed', color: '#5B9BD5' },
    { key: 'pending', label: 'Pending', color: '#E5C07B' },
    { key: 'cancelled', label: 'Cancelled', color: '#E06C75' },
  ];
  const counts = statuses.map((s) => ({ ...s, count: orders.filter((o) => o.status === s.key).length }));

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-[#0D1F33]">
        {counts.filter((s) => s.count > 0).map((s) => (
          <div key={s.key} className="transition-all duration-300" style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {counts.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-[#8FAABE]/70 flex-1">{s.label}</span>
            <span className="text-[10px] font-semibold text-[#E8EDF2] tabular-nums">{s.count}</span>
            <span className="text-[9px] text-[#8FAABE]/40 tabular-nums w-8 text-right">{((s.count / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(7);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [priorOrders, setPriorOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [storesList, setStoresList] = useState<StoreRow[]>([]);
  const [collectorsList, setCollectorsList] = useState<CollectorRow[]>([]);
  const [productsPage, setProductsPage] = useState(1);
  const [dailyPage, setDailyPage] = useState(1);

  // Custom date range state
  const [customStart, setCustomStart] = useState(() => format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const customPickerRef = useRef<HTMLDivElement>(null);

  // Close custom picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customPickerRef.current && !customPickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const presets: (7 | 14 | 30 | 90)[] = [7, 14, 30, 90];

  // Compute the actual number of days for the current period
  const effectiveDays = useMemo(() => {
    if (period === 'custom') {
      return Math.max(1, differenceInDays(new Date(customEnd), new Date(customStart)) + 1);
    }
    return period;
  }, [period, customStart, customEnd]);

  async function loadData(start: Date, end: Date, days: number) {
    setLoading(true);
    const priorStart = startOfDay(subDays(start, days));
    const priorEnd = startOfDay(subDays(start, 1));

    try {
      const [{ data: ordersData }, { data: priorData }, { data: itemsData }, { data: storesData }, { data: collectorsData }] = await Promise.all([
        supabase.from('orders').select('total_amount, created_at, status, collector_id, store_id')
          .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
        supabase.from('orders').select('total_amount, created_at, status, collector_id, store_id')
          .gte('created_at', priorStart.toISOString()).lte('created_at', priorEnd.toISOString()),
        supabase.from('order_items').select('product_name, quantity, line_total, orders!inner(created_at, status)')
          .gte('orders.created_at', start.toISOString()),
        supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
        supabase.from('profiles').select('id, full_name, nickname').eq('role', 'collector').eq('is_active', true).order('nickname'),
      ]);

      setOrders((ordersData as OrderRow[]) || []);
      setPriorOrders((priorData as OrderRow[]) || []);
      setOrderItems((itemsData as unknown as OrderItemRow[]) || []);
      setStoresList((storesData as StoreRow[]) || []);
      setCollectorsList((collectorsData as CollectorRow[]) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let start: Date;
    let end: Date;
    if (period === 'custom') {
      start = startOfDay(new Date(customStart));
      end = endOfDay(new Date(customEnd));
    } else {
      end = endOfDay(new Date());
      start = startOfDay(subDays(new Date(), period - 1));
    }
    loadData(start, end, effectiveDays);
    setProductsPage(1);
    setDailyPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStart, customEnd]);

  const activeOrders = useMemo(() => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)), [orders]);
  const priorActive = useMemo(() => priorOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)), [priorOrders]);

  const { dailyData, totalRevenue, totalOrdersCount, avgOrderValue, revenueGrowth, ordersGrowth, completionRate, completionTrend } = useMemo(() => {
    let startDate: Date;
    if (period === 'custom') {
      startDate = startOfDay(new Date(customStart));
    } else {
      startDate = startOfDay(subDays(new Date(), period - 1));
    }
    const endDate = period === 'custom' ? startOfDay(new Date(customEnd)) : new Date();
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    const dailyData: DailyData[] = allDays.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = activeOrders.filter((o) => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr);
      return { date: dayStr, orders: dayOrders.length, revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) };
    });

    const totalRevenue = activeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalOrdersCount = activeOrders.length;
    const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

    const priorRevenue = priorActive.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const calcGrowth = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    const completedCount = orders.filter((o) => o.status === 'completed').length;
    const completionRate = orders.length > 0 ? (completedCount / orders.length) * 100 : 0;
    const priorCompleted = priorOrders.filter((o) => o.status === 'completed').length;
    const priorCompRate = priorOrders.length > 0 ? (priorCompleted / priorOrders.length) * 100 : 0;

    return {
      dailyData,
      totalRevenue,
      totalOrdersCount,
      avgOrderValue,
      revenueGrowth: calcGrowth(totalRevenue, priorRevenue),
      ordersGrowth: calcGrowth(activeOrders.length, priorActive.length),
      completionRate,
      completionTrend: calcGrowth(completionRate, priorCompRate),
    };
  }, [activeOrders, priorActive, orders, priorOrders, period, customStart, customEnd, effectiveDays]);

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { units: number; revenue: number }>();
    for (const item of orderItems) {
      if (!ACTIVE_STATUSES.includes(item.orders?.status)) continue;
      const existing = productMap.get(item.product_name) || { units: 0, revenue: 0 };
      productMap.set(item.product_name, { units: existing.units + (item.quantity || 0), revenue: existing.revenue + (item.line_total || 0) });
    }
    const totalItemRevenue = Array.from(productMap.values()).reduce((s, v) => s + v.revenue, 0);
    return Array.from(productMap.entries())
      .map(([name, v]): TopProduct => ({ product_name: name, units: v.units, revenue: v.revenue, pct: totalItemRevenue > 0 ? (v.revenue / totalItemRevenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orderItems]);

  const storeRevenue = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; revenue: number }>();
    storesList.forEach((s) => map.set(s.id, { name: s.name, orders: 0, revenue: 0 }));
    activeOrders.forEach((o) => { const e = map.get(o.store_id); if (e) { e.orders++; e.revenue += o.total_amount; } });
    return Array.from(map.values()).filter((s) => s.orders > 0).sort((a, b) => b.revenue - a.revenue);
  }, [activeOrders, storesList]);

  const collectorRevenue = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; revenue: number }>();
    collectorsList.forEach((c) => map.set(c.id, { name: c.nickname || c.full_name, orders: 0, revenue: 0 }));
    activeOrders.forEach((o) => { const e = map.get(o.collector_id); if (e) { e.orders++; e.revenue += o.total_amount; } });
    return Array.from(map.values()).filter((c) => c.orders > 0).sort((a, b) => b.revenue - a.revenue);
  }, [activeOrders, collectorsList]);

  // Pagination
  const productsTotalPages = Math.max(1, Math.ceil(topProducts.length / PRODUCTS_PAGE_SIZE));
  const safeProductsPage = Math.min(productsPage, productsTotalPages);
  const pagedProducts = topProducts.slice((safeProductsPage - 1) * PRODUCTS_PAGE_SIZE, safeProductsPage * PRODUCTS_PAGE_SIZE);

  const reversedDaily = useMemo(() => [...dailyData].reverse(), [dailyData]);
  const dailyTotalPages = Math.max(1, Math.ceil(reversedDaily.length / DAILY_PAGE_SIZE));
  const safeDailyPage = Math.min(dailyPage, dailyTotalPages);
  const pagedDaily = reversedDaily.slice((safeDailyPage - 1) * DAILY_PAGE_SIZE, safeDailyPage * DAILY_PAGE_SIZE);

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-sm font-bold text-[#E8EDF2]">Analytics</h1>
          <p className="text-[10px] text-[#8FAABE]/50">Business performance insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
            {presets.map((p) => (
              <button key={p} onClick={() => { setPeriod(p); setShowCustomPicker(false); }} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', period === p ? 'bg-[#5B9BD5] text-white' : 'text-[#E8EDF2]/80 hover:bg-[#1A3755]')}>
                {p}d
              </button>
            ))}
          </div>
          <div className="relative" ref={customPickerRef}>
            <button
              onClick={() => { setShowCustomPicker(!showCustomPicker); if (period !== 'custom') setPeriod('custom'); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                period === 'custom'
                  ? 'bg-[#5B9BD5] text-white border-[#5B9BD5]'
                  : 'bg-[#162F4D] border-[#1E3F5E]/60 text-[#E8EDF2]/80 hover:bg-[#1A3755]'
              )}
            >
              <CalendarDays size={12} />
              {period === 'custom' ? `${format(new Date(customStart), 'MMM d')} — ${format(new Date(customEnd), 'MMM d')}` : 'Custom'}
            </button>
            {showCustomPicker && (
              <div className="absolute right-0 top-full mt-1.5 bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg shadow-xl p-3 z-50 w-64">
                <p className="text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider mb-2">Custom Range</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-[#8FAABE]/50 mb-0.5 block">Start Date</label>
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full border border-[#1E3F5E]/60 rounded-md px-2.5 py-1.5 text-xs bg-[#0D1F33] text-[#E8EDF2] focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] transition-colors [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8FAABE]/50 mb-0.5 block">End Date</label>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full border border-[#1E3F5E]/60 rounded-md px-2.5 py-1.5 text-xs bg-[#0D1F33] text-[#E8EDF2] focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3">
                  {[
                    { label: 'This Week', start: startOfDay(subDays(new Date(), new Date().getDay())), end: new Date() },
                    { label: 'This Month', start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), end: new Date() },
                    { label: 'Last Month', start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), end: new Date(new Date().getFullYear(), new Date().getMonth(), 0) },
                  ].map((q) => (
                    <button
                      key={q.label}
                      onClick={() => {
                        setCustomStart(format(q.start, 'yyyy-MM-dd'));
                        setCustomEnd(format(q.end, 'yyyy-MM-dd'));
                      }}
                      className="flex-1 text-[9px] text-[#8FAABE]/70 border border-[#1E3F5E]/60 rounded px-1.5 py-1 hover:bg-[#1A3755] transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCustomPicker(false)}
                  className="w-full mt-2 bg-[#5B9BD5] text-white text-xs py-1.5 rounded-md hover:bg-[#4A8BC4] transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} trend={loading ? undefined : revenueGrowth} sub={period === 'custom' ? `${effectiveDays} days selected` : `last ${period} days`} />
        <KpiCard title="Orders" value={totalOrdersCount} icon={ShoppingCart} trend={loading ? undefined : ordersGrowth} sub={period === 'custom' ? `${effectiveDays} days selected` : `last ${period} days`} />
        <KpiCard title="Avg Order Value" value={formatCurrency(avgOrderValue)} icon={BarChart2} sub="per order" />
        <KpiCard title="Completion Rate" value={`${completionRate.toFixed(1)}%`} icon={CheckCircle2} trend={loading ? undefined : completionTrend} sub="orders completed" />
      </div>

      {/* Charts: Revenue Trend + Order Volume */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <p className="text-xs font-semibold text-[#E8EDF2] mb-3">Revenue Trend</p>
          {loading ? <div className="h-[180px] bg-[#1A3755] rounded animate-pulse" /> : <div className="h-[180px]"><AreaChart data={dailyData} valueKey="revenue" color="#5B9BD5" /></div>}
        </div>
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <p className="text-xs font-semibold text-[#E8EDF2] mb-3">Order Volume</p>
          {loading ? <div className="h-[180px] bg-[#1A3755] rounded animate-pulse" /> : <div className="h-[180px]"><AreaChart data={dailyData} valueKey="orders" color="#7EB8E0" /></div>}
        </div>
      </div>

      {/* Hourly Distribution + Status Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <p className="text-xs font-semibold text-[#E8EDF2] mb-3">Hourly Order Distribution</p>
          {loading ? <div className="h-8 bg-[#1A3755] rounded animate-pulse" />
           : orders.length === 0 ? <p className="text-xs text-[#8FAABE]/50 text-center py-4">No data for this period</p>
           : <HourlyHeatmap orders={orders} />}
          <p className="text-[9px] text-[#8FAABE]/40 mt-2">Darker blocks = higher volume. Hover for counts.</p>
        </div>
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <p className="text-xs font-semibold text-[#E8EDF2] mb-3">Order Status Distribution</p>
          {loading ? <div className="h-20 bg-[#1A3755] rounded animate-pulse" />
           : orders.length === 0 ? <p className="text-xs text-[#8FAABE]/50 text-center py-4">No data for this period</p>
           : <StatusBreakdown orders={orders} />}
        </div>
      </div>

      {/* Revenue by Store + Revenue by Collector */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Store size={13} className="text-[#5B9BD5]" />
            <p className="text-xs font-semibold text-[#E8EDF2]">Revenue by Store</p>
          </div>
          {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-[#1A3755] rounded animate-pulse" />)}</div>
           : storeRevenue.length === 0 ? <p className="text-xs text-[#8FAABE]/50 text-center py-4">No store data</p>
           : <div className="space-y-3">{storeRevenue.map((s) => (
              <HorizontalBar key={s.name} label={s.name} value={s.revenue} maxValue={storeRevenue[0]?.revenue || 1} formattedValue={formatCurrency(s.revenue)} subLabel={`${s.orders} order${s.orders !== 1 ? 's' : ''}`} />
           ))}</div>}
        </div>
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Users size={13} className="text-[#5B9BD5]" />
            <p className="text-xs font-semibold text-[#E8EDF2]">Revenue by Collector</p>
          </div>
          {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-[#1A3755] rounded animate-pulse" />)}</div>
           : collectorRevenue.length === 0 ? <p className="text-xs text-[#8FAABE]/50 text-center py-4">No collector data</p>
           : <div className="space-y-3">{collectorRevenue.map((c) => (
              <HorizontalBar key={c.name} label={c.name} value={c.revenue} maxValue={collectorRevenue[0]?.revenue || 1} formattedValue={formatCurrency(c.revenue)} subLabel={`${c.orders} order${c.orders !== 1 ? 's' : ''}`} color="#7EB8E0" />
           ))}</div>}
        </div>
      </div>

      {/* Top Products (paginated) + Daily Revenue Log (paginated) */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E3F5E]/60 flex items-center gap-1.5">
            <Package size={13} className="text-[#5B9BD5]" />
            <p className="text-xs font-semibold text-[#E8EDF2]">Top Products</p>
            <span className="text-[10px] text-[#8FAABE]/40 ml-auto tabular-nums">{topProducts.length} products</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="flex gap-3 animate-pulse py-1"><div className="h-3 bg-[#1A3755] rounded flex-1" /><div className="h-3 bg-[#1A3755] rounded w-16" /></div>)}</div>
          ) : topProducts.length === 0 ? (
            <div className="py-10 text-center"><p className="text-xs text-[#8FAABE]/50">No order data for this period</p></div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E3F5E]/60 bg-[#1A3755]/50">
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Product</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Units</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Revenue</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProducts.map((p, i) => (
                    <tr key={p.product_name} className="border-b border-[#1E3F5E]/30 hover:bg-[#1A3755]/40 transition-colors">
                      <td className="px-3 py-2 text-xs text-[#E8EDF2] font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-[#8FAABE]/30 w-4 tabular-nums">{(safeProductsPage - 1) * PRODUCTS_PAGE_SIZE + i + 1}</span>
                          <span className="truncate">{p.product_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#E8EDF2]/80 text-right tabular-nums">{p.units}</td>
                      <td className="px-3 py-2 text-xs text-[#E8EDF2] font-medium text-right tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 bg-[#0D1F33] rounded-full h-1.5"><div className="h-1.5 rounded-full bg-[#5B9BD5]" style={{ width: `${Math.min(p.pct, 100)}%` }} /></div>
                          <span className="text-[10px] text-[#E8EDF2]/80 w-8 text-right tabular-nums">{p.pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productsTotalPages > 1 && (
                <div className="px-3 py-2 border-t border-[#1E3F5E]/60 bg-[#1A3755]/50 flex justify-between items-center">
                  <p className="text-[10px] text-[#8FAABE]/50 tabular-nums">Page {safeProductsPage} of {productsTotalPages}</p>
                  <div className="flex items-center gap-1">
                    <button disabled={safeProductsPage === 1} onClick={() => setProductsPage((p) => p - 1)} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                    <button disabled={safeProductsPage === productsTotalPages} onClick={() => setProductsPage((p) => p + 1)} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Daily Revenue Log */}
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E3F5E]/60">
            <p className="text-xs font-semibold text-[#E8EDF2]">Daily Revenue Log</p>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(7)].map((_, i) => <div key={i} className="flex gap-3 animate-pulse py-1"><div className="h-3 bg-[#1A3755] rounded w-20" /><div className="h-3 bg-[#1A3755] rounded flex-1" /><div className="h-3 bg-[#1A3755] rounded w-16" /></div>)}</div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E3F5E]/60 bg-[#1A3755]/50">
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Date</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Orders</th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Revenue</th>
                    <th className="px-3 py-2 text-center text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDaily.map((day, i) => {
                    const fullIdx = (safeDailyPage - 1) * DAILY_PAGE_SIZE + i;
                    const prevRevenue = reversedDaily[fullIdx + 1]?.revenue ?? null;
                    const hasPrev = prevRevenue !== null;
                    const up = hasPrev && day.revenue > prevRevenue;
                    const down = hasPrev && day.revenue < prevRevenue;
                    return (
                      <tr key={day.date} className="border-b border-[#1E3F5E]/30 hover:bg-[#1A3755]/40 transition-colors">
                        <td className="px-3 py-2 text-xs text-[#E8EDF2]/80">{format(new Date(day.date), 'MMM d, yyyy')}</td>
                        <td className="px-3 py-2 text-xs text-[#E8EDF2]/80 text-right tabular-nums">{day.orders}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-[#E8EDF2] text-right tabular-nums">{formatCurrency(day.revenue)}</td>
                        <td className="px-3 py-2 text-center">
                          {up ? <TrendingUp size={13} className="text-[#98C379] inline-block" />
                           : down ? <TrendingDown size={13} className="text-[#E06C75] inline-block" />
                           : <Minus size={13} className="text-[#8FAABE]/30 inline-block" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {dailyTotalPages > 1 && (
                <div className="px-3 py-2 border-t border-[#1E3F5E]/60 bg-[#1A3755]/50 flex justify-between items-center">
                  <p className="text-[10px] text-[#8FAABE]/50 tabular-nums">Page {safeDailyPage} of {dailyTotalPages}</p>
                  <div className="flex items-center gap-1">
                    <button disabled={safeDailyPage === 1} onClick={() => setDailyPage((p) => p - 1)} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                    <button disabled={safeDailyPage === dailyTotalPages} onClick={() => setDailyPage((p) => p + 1)} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
