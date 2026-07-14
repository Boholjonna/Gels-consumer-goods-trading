import { useMemo } from 'react';
import type { Order } from '@/types';
import type { PriceListMap } from '@/lib/parsePricelist';

export interface DailyRevenueData {
  totalRevenue: number;
  productBreakdown: Array<{
    product_name: string;
    quantity: number;
    revenue: number;
  }>;
}

export function useDailyRevenue(orders: Order[], pricelistMap?: PriceListMap): DailyRevenueData {
  return useMemo(() => {
    const productMap = new Map<string, { quantity: number; revenue: number }>();
    let totalRevenue = 0;

    for (const order of orders) {
      for (const item of order.order_items || []) {
        // If pricelist is provided, only include products that exist in it (for consistency with profit)
        if (pricelistMap && !pricelistMap[item.product_name]) {
          continue;
        }
        
        totalRevenue += item.line_total;

        const existing = productMap.get(item.product_name);
        if (existing) {
          productMap.set(item.product_name, {
            quantity: existing.quantity + item.quantity,
            revenue: existing.revenue + item.line_total,
          });
        } else {
          productMap.set(item.product_name, {
            quantity: item.quantity,
            revenue: item.line_total,
          });
        }
      }
    }

    const productBreakdown = Array.from(productMap.entries()).map(([name, data]) => ({
      product_name: name,
      quantity: data.quantity,
      revenue: data.revenue,
    }));

    return {
      totalRevenue,
      productBreakdown: productBreakdown.sort((a, b) => b.quantity - a.quantity),
    };
  }, [orders, pricelistMap]);
}
