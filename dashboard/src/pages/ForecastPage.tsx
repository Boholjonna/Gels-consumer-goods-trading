import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart2,
  Target,
  HelpCircle,
  X,
} from 'lucide-react';

interface ForecastRow {
  product_id: string;
  product_name: string;
  sku: string | null;
  carton_size: number | null;
  price: number;
  avg_daily_sales: number;
  forecast_units: number;
  forecast_cases: number;
  forecast_remainder: number;
  duty_days_count: number;
  total_units_sold: number;
}

interface ActualSalesRow {
  product_id: string;
  actual_units: number;
  actual_duty_days: number;
}

interface ProductStock {
  id: string;
  stock_quantity: number;
}

interface MergedRow extends ForecastRow {
  actual_units: number;
  accuracy: number;
  variance: number;
  stock_quantity: number;
  stock_covers_days: number;
}

type SortKey = 'product_name' | 'avg_daily_sales' | 'forecast_units' | 'actual_units' | 'accuracy' | 'forecast_revenue' | 'stock_covers_days';

const HISTORY_OPTIONS = [4, 8, 12] as const;
const FORECAST_OPTIONS = [7, 14, 30] as const;
const PAGE_SIZE = 15;

export function ForecastPage() {
  const [loading, setLoading] = useState(true);
  const [forecasts, setForecasts] = useState<ForecastRow[]>([]);
  const [actuals, setActuals] = useState<Map<string, ActualSalesRow>>(new Map());
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('forecast_units');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [historyWeeks, setHistoryWeeks] = useState(12);
  const [forecastDays, setForecastDays] = useState(14);
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function loadData(weeks: number, days: number) {
    setLoading(true);
    try {
      const [{ data: forecastData, error: fErr }, { data: actualData, error: aErr }, { data: stockData }] =
        await Promise.all([
          supabase.rpc('get_product_forecasts', { p_history_weeks: weeks, p_forecast_days: days }),
          supabase.rpc('get_actual_sales', { p_days: days }),
          supabase.from('products').select('id, stock_quantity').eq('is_active', true),
        ]);

      if (fErr) console.error('Forecast error:', fErr);
      if (aErr) console.error('Actual sales error:', aErr);

      setForecasts((forecastData as ForecastRow[]) || []);

      const aMap = new Map<string, ActualSalesRow>();
      if (actualData) {
        for (const row of actualData as ActualSalesRow[]) aMap.set(row.product_id, row);
      }
      setActuals(aMap);

      const sMap = new Map<string, number>();
      if (stockData) {
        for (const row of stockData as ProductStock[]) sMap.set(row.id, row.stock_quantity);
      }
      setStockMap(sMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(historyWeeks, forecastDays);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyWeeks, forecastDays]);

  // Merge all data
  const rows = useMemo(() => {
    let data: MergedRow[] = forecasts.map((f) => {
      const actual = actuals.get(f.product_id)?.actual_units || 0;
      const accuracy = f.forecast_units > 0
        ? Math.max(0, 100 - Math.abs(((actual - f.forecast_units) / f.forecast_units) * 100))
        : actual === 0 ? 100 : 0;
      const variance = actual - f.forecast_units;
      const stock = stockMap.get(f.product_id) ?? 0;
      const stock_covers_days = f.avg_daily_sales > 0 ? stock / f.avg_daily_sales : stock > 0 ? 999 : 0;
      return { ...f, actual_units: actual, accuracy, variance, stock_quantity: stock, stock_covers_days };
    });

    if (search) {
      const q = search.toLowerCase();
      data = data.filter((d) => d.product_name.toLowerCase().includes(q) || (d.sku || '').toLowerCase().includes(q));
    }

    if (showOnlyAlerts) {
      data = data.filter((d) => d.stock_quantity < d.forecast_units);
    }

    data.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'product_name': cmp = a.product_name.localeCompare(b.product_name); break;
        case 'avg_daily_sales': cmp = a.avg_daily_sales - b.avg_daily_sales; break;
        case 'forecast_units': cmp = a.forecast_units - b.forecast_units; break;
        case 'actual_units': cmp = a.actual_units - b.actual_units; break;
        case 'accuracy': cmp = a.accuracy - b.accuracy; break;
        case 'forecast_revenue': cmp = (a.forecast_units * a.price) - (b.forecast_units * b.price); break;
        case 'stock_covers_days': cmp = a.stock_covers_days - b.stock_covers_days; break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [forecasts, actuals, stockMap, search, sortKey, sortAsc, showOnlyAlerts]);

  // Summary stats
  const summary = useMemo(() => {
    const withData = forecasts.filter((f) => f.total_units_sold > 0).length;
    const totalForecastUnits = forecasts.reduce((s, f) => s + f.forecast_units, 0);
    const totalCases = forecasts.reduce((s, f) => s + f.forecast_cases, 0);
    const totalForecastRevenue = forecasts.reduce((s, f) => s + f.forecast_units * f.price, 0);
    const totalActual = forecasts.reduce((s, f) => s + (actuals.get(f.product_id)?.actual_units || 0), 0);
    const avgAccuracy = totalForecastUnits > 0
      ? Math.max(0, 100 - Math.abs(((totalActual - totalForecastUnits) / totalForecastUnits) * 100))
      : 0;
    const reorderAlerts = forecasts.filter((f) => {
      const stock = stockMap.get(f.product_id) ?? 0;
      return stock < f.forecast_units;
    }).length;

    return { total: forecasts.length, withData, totalForecastUnits, totalCases, totalForecastRevenue, avgAccuracy, reorderAlerts };
  }, [forecasts, actuals, stockMap]);

  // Top demand products for visual bar
  const topDemand = useMemo(() => {
    return [...forecasts]
      .filter((f) => f.forecast_units > 0)
      .sort((a, b) => b.forecast_units - a.forecast_units)
      .slice(0, 8);
  }, [forecasts]);

  // Reorder alerts
  const reorderItems = useMemo(() => {
    return forecasts
      .map((f) => {
        const stock = stockMap.get(f.product_id) ?? 0;
        const deficit = f.forecast_units - stock;
        return { ...f, stock_quantity: stock, deficit };
      })
      .filter((f) => f.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 6);
  }, [forecasts, stockMap]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ChevronDown size={12} className="text-[#8FAABE]/30 ml-0.5 inline" />;
    return sortAsc ? <ChevronUp size={12} className="text-[#5B9BD5] ml-0.5 inline" /> : <ChevronDown size={12} className="text-[#5B9BD5] ml-0.5 inline" />;
  }

  function formatCases(cases: number, remainder: number, cartonSize: number | null) {
    if (!cartonSize || cartonSize <= 0) return '-';
    if (cases === 0 && remainder === 0) return '0';
    const parts: string[] = [];
    if (cases > 0) parts.push(`${cases}c`);
    parts.push(`${remainder}p`);
    return parts.join(' ');
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-sm font-bold text-[#E8EDF2]">Demand Forecast</h1>
          <p className="text-[10px] text-[#8FAABE]/50">Weighted moving average predictions for inventory planning</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium bg-[#162F4D] border border-[#1E3F5E]/60 text-[#8FAABE]/60 rounded-lg hover:text-[#E8EDF2] hover:bg-[#1A3755] transition-colors"
          >
            <HelpCircle size={13} />
            How it works
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#8FAABE]/50">History:</span>
            <div className="flex bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
              {HISTORY_OPTIONS.map((w) => (
                <button key={w} onClick={() => setHistoryWeeks(w)} className={cn('px-2 py-1 text-[10px] font-medium transition-colors', historyWeeks === w ? 'bg-[#5B9BD5] text-white' : 'text-[#E8EDF2]/80 hover:bg-[#1A3755]')}>
                  {w}w
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#8FAABE]/50">Forecast:</span>
            <div className="flex bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
              {FORECAST_OPTIONS.map((d) => (
                <button key={d} onClick={() => setForecastDays(d)} className={cn('px-2 py-1 text-[10px] font-medium transition-colors', forecastDays === d ? 'bg-[#5B9BD5] text-white' : 'text-[#E8EDF2]/80 hover:bg-[#1A3755]')}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0D1F33] flex items-center justify-center"><Package size={14} className="text-[#5B9BD5]" /></div>
            <div>
              <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide">Products</p>
              <p className="text-sm font-bold text-[#E8EDF2] tabular-nums">{summary.withData} <span className="text-[10px] font-normal text-[#8FAABE]/50">/ {summary.total}</span></p>
            </div>
          </div>
        </div>
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0D1F33] flex items-center justify-center"><TrendingUp size={14} className="text-[#5B9BD5]" /></div>
            <div>
              <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide">Forecast Demand</p>
              <p className="text-sm font-bold text-[#E8EDF2] tabular-nums">{summary.totalForecastUnits.toLocaleString()} <span className="text-[10px] font-normal text-[#8FAABE]/50">units ({summary.totalCases} cases)</span></p>
            </div>
          </div>
        </div>
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0D1F33] flex items-center justify-center"><BarChart2 size={14} className="text-[#5B9BD5]" /></div>
            <div>
              <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide">Forecast Revenue</p>
              <p className="text-sm font-bold text-[#E8EDF2] tabular-nums">{formatCurrency(summary.totalForecastRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0D1F33] flex items-center justify-center"><Target size={14} className="text-[#5B9BD5]" /></div>
            <div>
              <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wide">Model Accuracy</p>
              <p className={cn('text-sm font-bold tabular-nums', summary.avgAccuracy >= 80 ? 'text-[#98C379]' : summary.avgAccuracy >= 60 ? 'text-[#E5C07B]' : 'text-[#E06C75]')}>
                {summary.avgAccuracy.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row: Top Demand + Reorder Alerts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Top Demand Bar Visual */}
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <p className="text-xs font-semibold text-[#E8EDF2] mb-3">Top Demand ({forecastDays}-day forecast)</p>
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-5 bg-[#1A3755] rounded animate-pulse" />)}</div>
          ) : topDemand.length === 0 ? (
            <p className="text-xs text-[#8FAABE]/50 text-center py-4">No forecast data</p>
          ) : (
            <div className="space-y-2">
              {topDemand.map((f) => {
                const maxUnits = topDemand[0]?.forecast_units || 1;
                const pct = (f.forecast_units / maxUnits) * 100;
                return (
                  <div key={f.product_id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-[#E8EDF2] truncate flex-1 mr-2">{f.product_name}</span>
                      <span className="text-[10px] font-semibold text-[#E8EDF2] tabular-nums flex-shrink-0">{f.forecast_units} units</span>
                    </div>
                    <svg className="w-full h-1.5 block" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
                      <rect x="0" y="0" width="100" height="6" rx="3" fill="#0D1F33" />
                      <rect x="0" y="0" width={Math.max(0, Math.min(100, pct))} height="6" rx="3" fill="#5B9BD5" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reorder Alerts */}
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle size={13} className={summary.reorderAlerts > 0 ? 'text-[#E5C07B]' : 'text-[#8FAABE]/30'} />
            <p className="text-xs font-semibold text-[#E8EDF2]">Reorder Alerts</p>
            {summary.reorderAlerts > 0 && (
              <span className="text-[9px] bg-[#E5C07B]/15 text-[#E5C07B] px-1.5 py-0.5 rounded font-medium tabular-nums">{summary.reorderAlerts}</span>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-5 bg-[#1A3755] rounded animate-pulse" />)}</div>
          ) : reorderItems.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-[#98C379] font-medium">All products sufficiently stocked</p>
              <p className="text-[10px] text-[#8FAABE]/40 mt-1">Current stock covers {forecastDays}-day forecast demand</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {reorderItems.map((f) => {
                const severity = f.stock_quantity === 0 ? 'out' : f.stock_quantity < f.forecast_units * 0.3 ? 'critical' : 'low';
                const dotColor = severity === 'out' ? 'bg-[#E06C75]' : severity === 'critical' ? 'bg-[#D19A66]' : 'bg-[#E5C07B]';
                const label = severity === 'out' ? 'Out of stock' : `${f.stock_quantity} in stock`;
                return (
                  <div key={f.product_id} className="flex items-center gap-2 py-1 px-2 -mx-2 rounded hover:bg-[#1A3755]/40 transition-colors">
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
                    <span className="text-[11px] text-[#E8EDF2] flex-1 truncate">{f.product_name}</span>
                    <span className="text-[9px] text-[#8FAABE]/50 tabular-nums">{label}</span>
                    <span className="text-[10px] font-semibold text-[#E06C75] tabular-nums whitespace-nowrap">need +{f.deficit}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FAABE]/40" />
          <input
            type="text"
            placeholder="Search products or SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#1E3F5E]/60 rounded-lg bg-[#162F4D] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]"
          />
        </div>
        <button
          onClick={() => { setShowOnlyAlerts((v) => !v); setPage(1); }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
            showOnlyAlerts
              ? 'bg-[#E5C07B]/15 border-[#E5C07B]/30 text-[#E5C07B]'
              : 'bg-[#162F4D] border-[#1E3F5E]/60 text-[#8FAABE]/60 hover:text-[#8FAABE]'
          )}
        >
          <AlertTriangle size={12} />
          Reorder only
        </button>
        <p className="text-[10px] text-[#8FAABE]/40 ml-auto tabular-nums">{rows.length} products</p>
      </div>

      {/* Forecast Table */}
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(10)].map((_, i) => <div key={i} className="flex gap-3 animate-pulse py-2"><div className="h-3 bg-[#1A3755] rounded flex-1" /><div className="h-3 bg-[#1A3755] rounded w-12" /><div className="h-3 bg-[#1A3755] rounded w-12" /><div className="h-3 bg-[#1A3755] rounded w-16" /><div className="h-3 bg-[#1A3755] rounded w-12" /></div>)}</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={32} className="mx-auto text-[#8FAABE]/30 mb-2" />
            <p className="text-xs text-[#8FAABE]/50">{search ? 'No products match your search' : showOnlyAlerts ? 'No reorder alerts' : 'No forecast data available'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E3F5E]/60 bg-[#1A3755]/50">
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('product_name')}>
                    Product <SortIcon column="product_name" />
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('avg_daily_sales')}>
                    Avg/Day <SortIcon column="avg_daily_sales" />
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('forecast_units')}>
                    Forecast ({forecastDays}d) <SortIcon column="forecast_units" />
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide whitespace-nowrap">Cases</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('forecast_revenue')}>
                    Est. Rev. <SortIcon column="forecast_revenue" />
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('actual_units')}>
                    Actual ({forecastDays}d) <SortIcon column="actual_units" />
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('accuracy')}>
                    Accuracy <SortIcon column="accuracy" />
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('stock_covers_days')}>
                    Stock <SortIcon column="stock_covers_days" />
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide whitespace-nowrap">Trend</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  const forecastRevenue = row.forecast_units * row.price;
                  const up = row.variance > 0;
                  const down = row.variance < 0;
                  const variancePct = row.forecast_units > 0 ? (row.variance / row.forecast_units) * 100 : 0;
                  const stockDanger = row.stock_quantity < row.forecast_units;
                  const stockOut = row.stock_quantity === 0;

                  return (
                    <tr key={row.product_id} className="border-b border-[#1E3F5E]/30 hover:bg-[#1A3755]/40 transition-colors">
                      <td className="px-3 py-2">
                        <p className="text-xs font-medium text-[#E8EDF2] truncate max-w-[200px]" title={row.product_name}>{row.product_name}</p>
                        {row.sku && <p className="text-[9px] text-[#8FAABE]/40 font-mono">{row.sku}</p>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-[#E8EDF2]/80 tabular-nums">{row.avg_daily_sales.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-[#E8EDF2] tabular-nums">{row.forecast_units}</td>
                      <td className="px-3 py-2 text-right text-xs text-[#E8EDF2]/80 tabular-nums whitespace-nowrap">{formatCases(row.forecast_cases, row.forecast_remainder, row.carton_size)}</td>
                      <td className="px-3 py-2 text-right text-xs text-[#E8EDF2]/80 tabular-nums">{formatCurrency(forecastRevenue)}</td>
                      <td className="px-3 py-2 text-right text-xs text-[#E8EDF2]/80 tabular-nums">{row.actual_units}</td>
                      <td className="px-3 py-2 text-right">
                        {row.forecast_units === 0 && row.actual_units === 0 ? (
                          <span className="text-[10px] text-[#8FAABE]/30">-</span>
                        ) : (
                          <span className={cn('text-[10px] font-semibold tabular-nums', row.accuracy >= 80 ? 'text-[#98C379]' : row.accuracy >= 60 ? 'text-[#E5C07B]' : 'text-[#E06C75]')}>
                            {row.accuracy.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {stockOut ? (
                            <span className="text-[10px] font-semibold text-[#E06C75]">Out</span>
                          ) : stockDanger ? (
                            <span className="text-[10px] font-semibold text-[#E5C07B] tabular-nums" title={`${row.stock_quantity} in stock, need ${row.forecast_units}`}>{row.stock_quantity}</span>
                          ) : (
                            <span className="text-[10px] text-[#E8EDF2]/70 tabular-nums">{row.stock_quantity}</span>
                          )}
                          {stockDanger && <AlertTriangle size={10} className="text-[#E5C07B] flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.forecast_units === 0 && row.actual_units === 0 ? (
                          <Minus size={12} className="text-[#8FAABE]/30 inline-block" />
                        ) : up ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#98C379]"><TrendingUp size={11} /> +{variancePct.toFixed(0)}%</span>
                        ) : down ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#E06C75]"><TrendingDown size={11} /> {variancePct.toFixed(0)}%</span>
                        ) : (
                          <Minus size={12} className="text-[#8FAABE]/50 inline-block" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="px-3 py-2 border-t border-[#1E3F5E]/60 bg-[#1A3755]/50 flex justify-between items-center">
            <p className="text-[10px] text-[#8FAABE]/50 tabular-nums">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, rows.length)} of {rows.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={safePage === 1} onClick={() => setPage((p) => p - 1)} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                <span className="text-[10px] text-[#8FAABE]/50 tabular-nums px-1">Page {safePage} of {totalPages}</span>
                <button disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* How it works modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-[#162F4D] rounded-lg max-w-lg w-full shadow-xl border border-[#1E3F5E]/60 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3F5E]/60 sticky top-0 bg-[#162F4D] z-10">
              <h3 className="text-sm font-bold text-[#E8EDF2]">How Demand Forecast Works</h3>
              <button onClick={() => setShowHelp(false)} className="p-1 text-[#8FAABE]/50 hover:text-[#E8EDF2] rounded transition-colors" aria-label="Close help" title="Close help"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-4 text-xs text-[#E8EDF2]/80 leading-relaxed">

              <div>
                <h4 className="text-[11px] font-semibold text-[#5B9BD5] uppercase tracking-wide mb-1">Forecast Model</h4>
                <p>Uses a <strong className="text-[#E8EDF2]">weighted moving average</strong> based on historical duty-day sales. Recent weeks are given higher weight so the model adapts to trends. Configure the history window (4/8/12 weeks) and forecast horizon (7/14/30 days) at the top.</p>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold text-[#5B9BD5] uppercase tracking-wide mb-1">KPI Cards</h4>
                <ul className="space-y-1 ml-3 list-disc marker:text-[#5B9BD5]/40">
                  <li><strong className="text-[#E8EDF2]">Products</strong> — How many active products have sale history vs total active products.</li>
                  <li><strong className="text-[#E8EDF2]">Forecast Demand</strong> — Total units predicted to sell in the forecast period, with case equivalent.</li>
                  <li><strong className="text-[#E8EDF2]">Forecast Revenue</strong> — Estimated revenue if all forecasted units are sold at current prices.</li>
                  <li><strong className="text-[#E8EDF2]">Model Accuracy</strong> — How close recent actual sales matched the forecast. Green (&ge;80%), yellow (&ge;60%), red (&lt;60%).</li>
                </ul>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold text-[#5B9BD5] uppercase tracking-wide mb-1">Top Demand</h4>
                <p>A quick visual ranking of which products are expected to sell the most units. Use this to prioritize restocking.</p>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold text-[#5B9BD5] uppercase tracking-wide mb-1">Reorder Alerts</h4>
                <p>Products where <strong className="text-[#E8EDF2]">current stock is less than forecasted demand</strong>. Color-coded by severity:</p>
                <ul className="space-y-0.5 ml-3 list-disc marker:text-[#5B9BD5]/40 mt-1">
                  <li><span className="text-[#E06C75] font-medium">Red</span> — Out of stock (0 units)</li>
                  <li><span className="text-[#D19A66] font-medium">Orange</span> — Critical (stock &lt; 30% of forecast)</li>
                  <li><span className="text-[#E5C07B] font-medium">Yellow</span> — Low (stock below forecast but above 30%)</li>
                </ul>
                <p className="mt-1">The <strong className="text-[#E8EDF2]">"need +N"</strong> value shows how many additional units you should order.</p>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold text-[#5B9BD5] uppercase tracking-wide mb-1">Forecast Table</h4>
                <ul className="space-y-1 ml-3 list-disc marker:text-[#5B9BD5]/40">
                  <li><strong className="text-[#E8EDF2]">Avg/Day</strong> — Weighted average daily unit sales based on historical data.</li>
                  <li><strong className="text-[#E8EDF2]">Forecast</strong> — Predicted total units for the forecast period (Avg/Day x days).</li>
                  <li><strong className="text-[#E8EDF2]">Cases</strong> — Forecast in carton units (e.g. "3c 2p" = 3 cases + 2 pieces).</li>
                  <li><strong className="text-[#E8EDF2]">Est. Rev.</strong> — Forecast units multiplied by current unit price.</li>
                  <li><strong className="text-[#E8EDF2]">Actual</strong> — Real units sold in the most recent period of equal length.</li>
                  <li><strong className="text-[#E8EDF2]">Accuracy</strong> — How close actual matched forecast. 100% = perfect prediction.</li>
                  <li><strong className="text-[#E8EDF2]">Stock</strong> — Current inventory level. Warning icon appears if stock can't cover forecast.</li>
                  <li><strong className="text-[#E8EDF2]">Trend</strong> — Whether actual sales exceeded (+%) or fell short (-%) of forecast.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold text-[#5B9BD5] uppercase tracking-wide mb-1">Reorder Only Filter</h4>
                <p>Toggle this to show only products that need restocking — hides everything where stock already covers the forecast period.</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
