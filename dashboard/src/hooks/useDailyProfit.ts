import { useMemo } from 'react';
import type { Order } from '@/types';
import type { PriceListMap } from '@/lib/parsePricelist';

export interface DailyProfitData {
  totalProfit: number;
  productBreakdown: Array<{
    product_name: string;
    quantity: number;
    profit_per_unit: number;
    total_profit: number;
  }>;
}

export function useDailyProfit(orders: Order[], pricelistMap: PriceListMap): DailyProfitData {
  return useMemo(() => {
    const productMap = new Map<string, { quantity: number; totalProfit: number; pricePerUnit: number }>();
    let totalProfit = 0;

    for (const order of orders) {
      for (const item of order.order_items || []) {
        const priceData = pricelistMap[item.product_name];

        if (!priceData) {
          // If product not in pricelist, skip it (no profit data available)
          continue;
        }

        const profitPerUnit = priceData.retail_price - priceData.withdrawal_price;
        const itemProfit = profitPerUnit * item.quantity;
        totalProfit += itemProfit;

        const existing = productMap.get(item.product_name);
        if (existing) {
          productMap.set(item.product_name, {
            quantity: existing.quantity + item.quantity,
            totalProfit: existing.totalProfit + itemProfit,
            pricePerUnit: profitPerUnit,
          });
        } else {
          productMap.set(item.product_name, {
            quantity: item.quantity,
            totalProfit: itemProfit,
            pricePerUnit: profitPerUnit,
          });
        }
      }
    }

    const productBreakdown = Array.from(productMap.entries()).map(([name, data]) => ({
      product_name: name,
      quantity: data.quantity,
      profit_per_unit: data.pricePerUnit,
      total_profit: data.totalProfit,
    }));

    return {
      totalProfit,
      productBreakdown: productBreakdown.sort((a, b) => b.total_profit - a.total_profit),
    };
  }, [orders, pricelistMap]);
}
