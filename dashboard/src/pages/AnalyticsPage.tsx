import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { format, startOfDay, subDays, endOfDay, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  BarChart2,
  Minus,
} from 'lucide-react';

type Period = 7 | 14 | 30;

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface OrderRow {
  total_amount: number;
  created_at: string;
  status: string;
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

const ACTIVE_STATUSES = ['pending', 'confirmed', 'processing', 'completed'];

// --- SVG Line Chart ---
function LineChart({ data }: { data: DailyData[] }) {
  const width = 800;
  const height = 200;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 16;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  function xPos(i: number) {
    return paddingLeft + (i / Math.max(data.length - 1, 1)) * chartWidth;
  }

  function yPos(value: number) {
    return paddingTop + chartHeight - (value / maxRevenue) * chartHeight;
  }

  const points = data.map((d, i) => ({ x: xPos(i), y: yPos(d.revenue) }));

  const linePath =
    points.length > 1
      ? points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
      : '';

  const fillPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    value: maxRevenue * t,
    y: paddingTop + chartHeight - t * chartHeight,
  }));

  const xLabelStep = data.length <= 7 ? 1 : data.length <= 14 ? 2 : 5;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1060C0" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1060C0" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={paddingLeft}
            y1={tick.y}
            x2={width - paddingRight}
            y2={tick.y}
            stroke="#e2ecf9"
            strokeWidth="1"
          />
          <text x={paddingLeft - 6} y={tick.y + 4} fontSize="10" fill="#8aa0b8" textAnchor="end">
            {tick.value >= 1000 ? `${(tick.value / 1000).toFixed(0)}k` : tick.value.toFixed(0)}
          </text>
        </g>
      ))}

      {fillPath && <path d={fillPath} fill="url(#chartFill)" />}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="#1060C0"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#1060C0" stroke="white" strokeWidth="1.5" />
          {i % xLabelStep === 0 && (
            <text
              x={p.x}
              y={paddingTop + chartHeight + 18}
              fontSize="9"
              fill="#8aa0b8"
              textAnchor="middle"
            >
              {format(new Date(data[i].date), 'MMM d')}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// --- KPI Card ---
function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
}) {
  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-primary" />
        </div>
      </div>
      {trend !== undefined && (
        <div
          className={cn('flex items-center gap-1 mt-2 text-[10px] font-medium', {
            'text-green-600': trendPositive,
            'text-red-500': trendNegative,
            'text-muted-foreground': trend === 0,
          })}
        >
          {trendPositive ? (
            <TrendingUp size={11} />
          ) : trendNegative ? (
            <TrendingDown size={11} />
          ) : (
            <Minus size={11} />
          )}
          {trend === 0 ? 'No change' : `${Math.abs(trend).toFixed(1)}% vs prior period`}
        </div>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(7);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [priorOrders, setPriorOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);

  const periods: Period[] = [7, 14, 30];

  async function loadData(days: Period) {
    setLoading(true);
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(new Date(), days - 1));
    const priorStart = startOfDay(subDays(new Date(), days * 2 - 1));
    const priorEnd = startOfDay(subDays(new Date(), days));

    try {
      const [{ data: ordersData }, { data: priorData }, { data: itemsData }] = await Promise.all([
        supabase
          .from('orders')
          .select('total_amount, created_at, status')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .in('status', ACTIVE_STATUSES),
        supabase
          .from('orders')
          .select('total_amount, created_at, status')
          .gte('created_at', priorStart.toISOString())
          .lte('created_at', priorEnd.toISOString())
          .in('status', ACTIVE_STATUSES),
        supabase
          .from('order_items')
          .select('product_name, quantity, line_total, orders!inner(created_at, status)')
          .gte('orders.created_at', startDate.toISOString())
          .in('orders.status', ACTIVE_STATUSES),
      ]);

      setOrders((ordersData as OrderRow[]) || []);
      setPriorOrders((priorData as OrderRow[]) || []);
      setOrderItems((itemsData as unknown as OrderItemRow[]) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const { dailyData, totalRevenue, totalOrders, avgOrderValue, growth } = useMemo(() => {
    const startDate = startOfDay(subDays(new Date(), period - 1));
    const allDays = eachDayOfInterval({ start: startDate, end: new Date() });

    const dailyData: DailyData[] = allDays.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = orders.filter(
        (o) => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr
      );
      return {
        date: dayStr,
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      };
    });

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const priorRevenue = priorOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const growth =
      priorRevenue === 0
        ? totalRevenue > 0
          ? 100
          : 0
        : ((totalRevenue - priorRevenue) / priorRevenue) * 100;

    return { dailyData, totalRevenue, totalOrders, avgOrderValue, growth };
  }, [orders, priorOrders, period]);

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { units: number; revenue: number }>();
    for (const item of orderItems) {
      const existing = productMap.get(item.product_name) || { units: 0, revenue: 0 };
      productMap.set(item.product_name, {
        units: existing.units + (item.quantity || 0),
        revenue: existing.revenue + (item.line_total || 0),
      });
    }
    const totalItemRevenue = Array.from(productMap.values()).reduce((s, v) => s + v.revenue, 0);
    const products: TopProduct[] = Array.from(productMap.entries())
      .map(([name, v]) => ({
        product_name: name,
        units: v.units,
        revenue: v.revenue,
        pct: totalItemRevenue > 0 ? (v.revenue / totalItemRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    return products;
  }, [orderItems]);

  return (
    <div className="p-3 bg-background min-h-full">
      {/* Period selector */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex bg-card border border-border rounded-lg overflow-hidden">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                period === p
                  ? 'bg-primary text-white'
                  : 'text-foreground/80 hover:bg-muted'
              )}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
          trend={loading ? undefined : growth}
          sub={`last ${period} days`}
        />
        <KpiCard title="Total Orders" value={totalOrders} icon={ShoppingCart} sub={`last ${period} days`} />
        <KpiCard title="Avg Order Value" value={formatCurrency(avgOrderValue)} icon={BarChart2} sub="per order" />
        <KpiCard
          title="Growth"
          value={`${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`}
          icon={TrendingUp}
          sub="vs prior period"
        />
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-foreground mb-3">Revenue Trend</p>
        {loading ? (
          <div className="h-[200px] bg-secondary rounded animate-pulse" />
        ) : (
          <div className="h-[200px]">
            <LineChart data={dailyData} />
          </div>
        )}
      </div>

      {/* Two-column layout: Top Products + Daily Revenue */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Top Products</p>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse py-1">
                  <div className="h-3 bg-gray-200 rounded flex-1" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-muted-foreground">No order data for this period</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Product
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Units
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Revenue
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i} className="border-b border-muted hover:bg-secondary">
                    <td className="px-3 py-2 text-xs text-foreground font-medium">{p.product_name}</td>
                    <td className="px-3 py-2 text-xs text-foreground/80 text-right">{p.units}</td>
                    <td className="px-3 py-2 text-xs text-foreground font-medium text-right">
                      {formatCurrency(p.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 bg-background rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${Math.min(p.pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-foreground/80 w-8 text-right">
                          {p.pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Daily Revenue */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Daily Revenue</p>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse py-1">
                  <div className="h-3 bg-gray-200 rounded w-20" />
                  <div className="h-3 bg-gray-200 rounded flex-1" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Orders
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Revenue
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...dailyData].reverse().map((day, i, arr) => {
                    const prevRevenue = arr[i + 1]?.revenue ?? null;
                    const hasPrev = prevRevenue !== null;
                    const up = hasPrev && day.revenue > prevRevenue;
                    const down = hasPrev && day.revenue < prevRevenue;

                    return (
                      <tr key={day.date} className="border-b border-muted hover:bg-secondary">
                        <td className="px-3 py-2 text-xs text-foreground/80">
                          {format(new Date(day.date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-3 py-2 text-xs text-foreground/80 text-right">{day.orders}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-foreground text-right">
                          {formatCurrency(day.revenue)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {up ? (
                            <TrendingUp size={13} className="text-green-500 inline-block" />
                          ) : down ? (
                            <TrendingDown size={13} className="text-red-400 inline-block" />
                          ) : (
                            <Minus size={13} className="text-muted-foreground inline-block" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
