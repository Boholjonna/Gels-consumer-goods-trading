import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  Box,
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

interface MergedRow extends ForecastRow {
  actual_units: number;
}

type SortKey = 'product_name' | 'avg_daily_sales' | 'forecast_units' | 'actual_units';

const HISTORY_WEEKS = 12;
const FORECAST_DAYS = 14;
const PAGE_SIZE = 20;

export function ForecastPage() {
  const [loading, setLoading] = useState(true);
  const [forecasts, setForecasts] = useState<ForecastRow[]>([]);
  const [actuals, setActuals] = useState<Map<string, ActualSalesRow>>(new Map());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('forecast_units');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: forecastData, error: fErr }, { data: actualData, error: aErr }] =
        await Promise.all([
          supabase.rpc('get_product_forecasts', {
            p_history_weeks: HISTORY_WEEKS,
            p_forecast_days: FORECAST_DAYS,
          }),
          supabase.rpc('get_actual_sales', {
            p_days: FORECAST_DAYS,
          }),
        ]);

      if (fErr) console.error('Forecast error:', fErr);
      if (aErr) console.error('Actual sales error:', aErr);

      setForecasts((forecastData as ForecastRow[]) || []);

      const map = new Map<string, ActualSalesRow>();
      if (actualData) {
        for (const row of actualData as ActualSalesRow[]) {
          map.set(row.product_id, row);
        }
      }
      setActuals(map);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    let data: MergedRow[] = forecasts.map((f) => ({
      ...f,
      actual_units: actuals.get(f.product_id)?.actual_units || 0,
    }));

    if (search) {
      const q = search.toLowerCase();
      data = data.filter((d) => d.product_name.toLowerCase().includes(q));
    }

    data.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'product_name':
          cmp = a.product_name.localeCompare(b.product_name);
          break;
        case 'avg_daily_sales':
          cmp = a.avg_daily_sales - b.avg_daily_sales;
          break;
        case 'forecast_units':
          cmp = a.forecast_units - b.forecast_units;
          break;
        case 'actual_units':
          cmp = a.actual_units - b.actual_units;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [forecasts, actuals, search, sortKey, sortAsc]);

  const summary = useMemo(() => {
    const withData = forecasts.filter((f) => f.total_units_sold > 0).length;
    const totalUnits = forecasts.reduce((s, f) => s + f.forecast_units, 0);
    const totalCases = forecasts.reduce((s, f) => s + f.forecast_cases, 0);
    return { total: forecasts.length, withData, totalUnits, totalCases };
  }, [forecasts]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(1);
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column)
      return <ChevronDown size={12} className="text-[#ccd9e8] ml-0.5 inline" />;
    return sortAsc ? (
      <ChevronUp size={12} className="text-[#1a56db] ml-0.5 inline" />
    ) : (
      <ChevronDown size={12} className="text-[#1a56db] ml-0.5 inline" />
    );
  }

  function formatCases(cases: number, remainder: number, cartonSize: number | null) {
    if (!cartonSize || cartonSize <= 0) return '-';
    if (cases === 0 && remainder === 0) return '0';
    const parts: string[] = [];
    if (cases > 0) parts.push(`${cases}c`);
    parts.push(`${remainder}p`);
    return parts.join(' ');
  }

  return (
    <div className="p-3 bg-[#f0f4f8] min-h-full">
      {/* Search + info */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0b8]"
          />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#e2ecf9] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a56db] focus:border-[#1a56db]"
          />
        </div>
        <p className="text-[10px] text-[#8aa0b8]">
          {FORECAST_DAYS}-day forecast &middot; {HISTORY_WEEKS}-week weighted avg
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#dce8f5] flex items-center justify-center">
              <Package size={14} className="text-[#1a56db]" />
            </div>
            <div>
              <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide">Products</p>
              <p className="text-sm font-bold text-[#0d1f35]">
                {summary.withData}{' '}
                <span className="text-[10px] font-normal text-[#8aa0b8]">
                  / {summary.total}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#dce8f5] flex items-center justify-center">
              <TrendingUp size={14} className="text-[#1a56db]" />
            </div>
            <div>
              <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide">Total Forecast</p>
              <p className="text-sm font-bold text-[#0d1f35]">
                {summary.totalUnits.toLocaleString()}{' '}
                <span className="text-[10px] font-normal text-[#8aa0b8]">units</span>
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#dce8f5] flex items-center justify-center">
              <Box size={14} className="text-[#1a56db]" />
            </div>
            <div>
              <p className="text-[10px] text-[#8aa0b8] uppercase tracking-wide">Total Cases</p>
              <p className="text-sm font-bold text-[#0d1f35]">
                {summary.totalCases.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Table */}
      <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-2">
                <div className="h-3 bg-gray-200 rounded flex-1" />
                <div className="h-3 bg-gray-200 rounded w-12" />
                <div className="h-3 bg-gray-200 rounded w-12" />
                <div className="h-3 bg-gray-200 rounded w-16" />
                <div className="h-3 bg-gray-200 rounded w-12" />
                <div className="h-3 bg-gray-200 rounded w-12" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={32} className="mx-auto text-[#ccd9e8] mb-2" />
            <p className="text-xs text-[#8aa0b8]">
              {search ? 'No products match your search' : 'No forecast data available'}
            </p>
            {!search && (
              <p className="text-[10px] text-[#a8bdd4] mt-1">
                Run the import script to load historical sales data
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                  <th
                    className="px-3 py-2 text-left text-[10px] font-medium text-[#8aa0b8] uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('product_name')}
                  >
                    Product <SortIcon column="product_name" />
                  </th>
                  <th
                    className="px-3 py-2 text-right text-[10px] font-medium text-[#8aa0b8] uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('avg_daily_sales')}
                  >
                    Avg/Day <SortIcon column="avg_daily_sales" />
                  </th>
                  <th
                    className="px-3 py-2 text-right text-[10px] font-medium text-[#8aa0b8] uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('forecast_units')}
                  >
                    Forecast ({FORECAST_DAYS}d) <SortIcon column="forecast_units" />
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8aa0b8] uppercase tracking-wide whitespace-nowrap">
                    Cases
                  </th>
                  <th
                    className="px-3 py-2 text-right text-[10px] font-medium text-[#8aa0b8] uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('actual_units')}
                  >
                    Last {FORECAST_DAYS}d <SortIcon column="actual_units" />
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-[#8aa0b8] uppercase tracking-wide whitespace-nowrap">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
                  const safePage = Math.min(page, totalPages);
                  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                  return pagedRows.map((row) => {
                  const diff = row.actual_units - row.forecast_units;
                  const pct =
                    row.forecast_units > 0
                      ? (diff / row.forecast_units) * 100
                      : 0;
                  const up = diff > 0;
                  const down = diff < 0;

                  return (
                    <tr
                      key={row.product_id}
                      className="border-b border-[#f0f4f8] hover:bg-[#f8fafd]"
                    >
                      <td className="px-3 py-2">
                        <p
                          className="text-xs font-medium text-[#0d1f35] truncate max-w-[220px]"
                          title={row.product_name}
                        >
                          {row.product_name}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-[#4b5e73] tabular-nums">
                        {row.avg_daily_sales.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-[#0d1f35] tabular-nums">
                        {row.forecast_units}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-[#4b5e73] tabular-nums whitespace-nowrap">
                        {formatCases(
                          row.forecast_cases,
                          row.forecast_remainder,
                          row.carton_size
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-[#4b5e73] tabular-nums">
                        {row.actual_units}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.forecast_units === 0 && row.actual_units === 0 ? (
                          <Minus size={12} className="text-[#ccd9e8] inline-block" />
                        ) : up ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600">
                            <TrendingUp size={11} />
                            +{pct.toFixed(0)}%
                          </span>
                        ) : down ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500">
                            <TrendingDown size={11} />
                            {pct.toFixed(0)}%
                          </span>
                        ) : (
                          <Minus size={12} className="text-[#8aa0b8] inline-block" />
                        )}
                      </td>
                    </tr>
                  );
                });
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && rows.length > 0 && (() => {
          const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
          const safePage = Math.min(page, totalPages);
          const startIdx = (safePage - 1) * PAGE_SIZE;
          return (
            <div className="px-3 py-2 border-t border-[#e2ecf9] bg-[#f8fafd] flex justify-between items-center">
              <p className="text-[10px] text-[#8aa0b8]">
                Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, rows.length)} of {rows.length} products
              </p>
              <div className="flex items-center gap-2">
                {totalPages > 1 && (
                  <>
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
                  </>
                )}
                <p className="text-[10px] text-[#8aa0b8] ml-2">
                  {HISTORY_WEEKS}-week weighted avg
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
