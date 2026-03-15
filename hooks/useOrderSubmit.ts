import { useState, useRef } from 'react';
import { createOrder } from '@/services/orders.service';
import type { CartItem, CreateOrderResponse } from '@/types';

export function useOrderSubmit() {
  const [loadingStores, setLoadingStores] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef<Set<string>>(new Set());

  async function submitOrderForStore(
    storeId: string,
    items: CartItem[],
    notes?: string
  ): Promise<CreateOrderResponse | null> {
    if (items.length === 0) {
      setErrors((prev) => ({ ...prev, [storeId]: 'No items in this store order' }));
      return null;
    }
    if (submittingRef.current.has(storeId)) return null;

    submittingRef.current.add(storeId);
    setLoadingStores((prev) => new Set(prev).add(storeId));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[storeId];
      return next;
    });

    try {
      const result = await createOrder({
        store_id: storeId,
        notes,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      return result;
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [storeId]: err.message || 'Failed to submit order' }));
      return null;
    } finally {
      submittingRef.current.delete(storeId);
      setLoadingStores((prev) => {
        const next = new Set(prev);
        next.delete(storeId);
        return next;
      });
    }
  }

  return {
    submitOrderForStore,
    isLoadingStore: (id: string) => loadingStores.has(id),
    getStoreError: (id: string) => errors[id] ?? null,
  };
}
