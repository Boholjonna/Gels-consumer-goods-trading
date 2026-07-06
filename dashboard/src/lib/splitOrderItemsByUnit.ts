import type { OrderItem } from '@/types';

export interface SplitOrderItem extends OrderItem {
  unit: 'ctn' | 'pcs';
  display_quantity: number;
  carton_size: number | null;
}

export function splitOrderItemsByUnit(items: OrderItem[], cartonSizeMap: Record<string, number | null>): SplitOrderItem[] {
  const splitItems: SplitOrderItem[] = [];

  for (const item of items) {
    const cartonSize = cartonSizeMap[item.product_id];

    if (!cartonSize || cartonSize <= 0) {
      // No carton size, just add as pcs
      splitItems.push({
        ...item,
        unit: 'pcs',
        display_quantity: item.quantity,
        carton_size: null,
      });
      continue;
    }

    // Calculate cartons and remaining pcs
    const cartons = Math.floor(item.quantity / cartonSize);
    const remainingPcs = item.quantity % cartonSize;

    // Add carton line if applicable
    if (cartons > 0) {
      const cartonLineTotal = cartons * cartonSize * item.unit_price;
      splitItems.push({
        ...item,
        unit: 'ctn',
        display_quantity: cartons,
        line_total: cartonLineTotal,
        carton_size: cartonSize,
      });
    }

    // Add pcs line if applicable
    if (remainingPcs > 0) {
      const pcsLineTotal = remainingPcs * item.unit_price;
      splitItems.push({
        ...item,
        unit: 'pcs',
        display_quantity: remainingPcs,
        line_total: pcsLineTotal,
        carton_size: null,
      });
    }
  }

  return splitItems;
}
