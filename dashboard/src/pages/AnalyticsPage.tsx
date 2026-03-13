import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { startOfDay, subDays, endOfDay } from 'date-fns';
import { clsx } from 'clsx';

type Period = 7 | 14 | 30;

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

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(7);
  const [loading, setLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);

  const periods: Period[] = [7, 14, 30];

  async function loadData(days: Period) {
    setLoading(true);
    const startDate = startOfDay(subDays(new Date(), days - 1));

    try {
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('product_name, quantity, line_total, orders!inner(created_at, status)')
        .gte('orders.created_at', startDate.toISOString())
        .in('orders.status', ACTIVE_STATUSES);

      setOrderItems((itemsData as unknown as OrderItemRow[]) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

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
    <div className="p-3 bg-[#f0f4f8] min-h-full">
      {/* Period selector */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                period === p
                  ? 'bg-[#1a56db] text-white'
                  : 'text-[#4b5e73] hover:bg-[#f0f4f8]'
              )}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2ecf9]">
          <p className="text-xs font-semibold text-[#0d1f35]">Top Products</p>
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
            <p className="text-xs text-[#8aa0b8]">No product data</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Product</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Units</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Revenue</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">%</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} className="border-b border-[#f0f4f8] hover:bg-[#f8fafd]">
                  <td className="px-3 py-2 text-xs text-[#0d1f35] font-medium">{p.product_name}</td>
                  <td className="px-3 py-2 text-xs text-[#4b5e73] text-right">{p.units}</td>
                  <td className="px-3 py-2 text-xs text-[#0d1f35] font-medium text-right">{formatCurrency(p.revenue)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 bg-[#f0f4f8] rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-[#1a56db]"
                          style={{ width: `${Math.min(p.pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#4b5e73] w-8 text-right">
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
    </div>
  );
}
