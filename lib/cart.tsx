import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem } from '@/types';

const SAVED_ORDERS_KEY = 'offline_store_orders';
const LOCAL_STORES_KEY = 'local_stores';

type StoreOrder = {
  storeId: string;
  storeName: string;
  items: CartItem[];
  notes?: string;
  savedAt: string;
};

export type LocalStore = {
  id: string;
  name: string;
  createdAt: string;
};

export type SubmittedRecord = {
  storeId: string;
  storeName: string;
  itemCount: number;
  subtotal: number;
  submittedAt: Date;
  items: CartItem[];
};

interface CartContextType {
  // Draft cart (current ordering session, no store assigned yet)
  draftItems: CartItem[];
  addDraftItem: (product: { id: string; name: string; price: number; stock_quantity: number }, quantity?: number) => void;
  removeDraftItem: (productId: string) => void;
  updateDraftQuantity: (productId: string, quantity: number) => void;
  getDraftSubtotal: () => number;
  getDraftItemCount: () => number;
  clearDraft: () => void;

  // Saved store orders (offline, persisted to AsyncStorage)
  savedOrders: StoreOrder[];
  saveOrderForStore: (storeId: string, storeName: string, items: CartItem[], notes?: string) => void;
  removeSavedOrder: (storeId: string) => void;
  getSavedOrderSubtotal: (storeId: string) => number;
  getSavedOrderItemCount: (storeId: string) => number;
  updateSavedOrderNotes: (storeId: string, notes: string) => void;
  removeSavedOrderItem: (storeId: string, productId: string) => void;
  updateSavedOrderItemQty: (storeId: string, productId: string, quantity: number) => void;

  // Local stores (offline, persisted to AsyncStorage)
  localStores: LocalStore[];
  addLocalStore: (name: string) => LocalStore;
  removeLocalStore: (id: string) => void;
  isLocalStore: (id: string) => boolean;

  // Legacy compatibility aliases
  storeOrders: StoreOrder[];
  activeStoreId: string | null;
  setActiveStore: (id: string | null) => void;
  addStoreOrder: (id: string, name: string) => void;
  removeStoreOrder: (id: string) => void;
  renameStoreOrder: (id: string, newName: string) => void;
  isStoreAdded: (id: string) => boolean;
  items: CartItem[];
  addItem: (product: { id: string; name: string; price: number; stock_quantity: number }, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItemFromStore: (storeId: string, productId: string) => void;
  updateQuantityInStore: (storeId: string, productId: string, quantity: number) => void;
  getStoreItems: (storeId: string) => CartItem[];
  getStoreSubtotal: (storeId: string) => number;
  getItemCount: () => number;
  clearAll: () => void;
  submittedStores: Set<string>;
  submittedHistory: SubmittedRecord[];
  markStoreSubmitted: (storeId: string, storeName: string, itemCount: number, subtotal: number, items: CartItem[]) => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [submittedStores, setSubmittedStores] = useState<Set<string>>(new Set());
  const [submittedHistory, setSubmittedHistory] = useState<SubmittedRecord[]>([]);
  const [draftItems, setDraftItems] = useState<CartItem[]>([]);
  const [savedOrders, setSavedOrders] = useState<StoreOrder[]>([]);
  const [localStores, setLocalStores] = useState<LocalStore[]>([]);

  // Load saved orders and local stores from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(SAVED_ORDERS_KEY).then((raw) => {
      if (raw) {
        try {
          setSavedOrders(JSON.parse(raw));
        } catch {}
      }
    });
    AsyncStorage.getItem(LOCAL_STORES_KEY).then((raw) => {
      if (raw) {
        try {
          setLocalStores(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  // Persist saved orders to AsyncStorage whenever they change
  const persistSavedOrders = useCallback((orders: StoreOrder[]) => {
    setSavedOrders(orders);
    AsyncStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(orders));
  }, []);

  // ─── Draft cart operations ───────────────────────────────────────────

  const addDraftItem = useCallback(
    (product: { id: string; name: string; price: number; stock_quantity: number }, quantity = 1) => {
      if (product.price < 0 || product.stock_quantity < 0 || quantity <= 0) return;
      setDraftItems((prev) => {
        const existing = prev.find((i) => i.product_id === product.id);
        if (existing) {
          const newQty = existing.quantity + quantity;
          if (newQty > product.stock_quantity) return prev;
          return prev.map((i) =>
            i.product_id === product.id
              ? { ...i, quantity: newQty, line_total: newQty * i.unit_price }
              : i
          );
        }
        if (quantity > product.stock_quantity) return prev;
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            unit_price: product.price,
            quantity,
            stock_quantity: product.stock_quantity,
            line_total: quantity * product.price,
          },
        ];
      });
    },
    []
  );

  const removeDraftItem = useCallback((productId: string) => {
    setDraftItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const updateDraftQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setDraftItems((prev) => prev.filter((i) => i.product_id !== productId));
      return;
    }
    setDraftItems((prev) =>
      prev.map((i) =>
        i.product_id === productId
          ? {
              ...i,
              quantity: Math.min(quantity, i.stock_quantity),
              line_total: Math.min(quantity, i.stock_quantity) * i.unit_price,
            }
          : i
      )
    );
  }, []);

  const getDraftSubtotal = useCallback(
    () => draftItems.reduce((sum, i) => sum + i.line_total, 0),
    [draftItems]
  );

  const getDraftItemCount = useCallback(
    () => draftItems.reduce((sum, i) => sum + i.quantity, 0),
    [draftItems]
  );

  const clearDraft = useCallback(() => {
    setDraftItems([]);
  }, []);

  // ─── Saved store orders (offline) ────────────────────────────────────

  const saveOrderForStore = useCallback(
    (storeId: string, storeName: string, items: CartItem[], notes?: string) => {
      setSavedOrders((prev) => {
        const existing = prev.find((o) => o.storeId === storeId);
        let updated: StoreOrder[];
        if (existing) {
          // Merge items: add new items, update quantities of existing ones
          const mergedItems = [...existing.items];
          for (const newItem of items) {
            const idx = mergedItems.findIndex((i) => i.product_id === newItem.product_id);
            if (idx >= 0) {
              const merged = {
                ...mergedItems[idx],
                quantity: mergedItems[idx].quantity + newItem.quantity,
                line_total: 0,
              };
              merged.line_total = merged.quantity * merged.unit_price;
              mergedItems[idx] = merged;
            } else {
              mergedItems.push(newItem);
            }
          }
          updated = prev.map((o) =>
            o.storeId === storeId
              ? { ...o, items: mergedItems, notes: notes ?? o.notes, savedAt: new Date().toISOString() }
              : o
          );
        } else {
          updated = [...prev, { storeId, storeName, items, notes, savedAt: new Date().toISOString() }];
        }
        AsyncStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const removeSavedOrder = useCallback(
    (storeId: string) => {
      setSavedOrders((prev) => {
        const updated = prev.filter((o) => o.storeId !== storeId);
        AsyncStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const getSavedOrderSubtotal = useCallback(
    (storeId: string) => {
      const order = savedOrders.find((o) => o.storeId === storeId);
      return order ? order.items.reduce((sum, i) => sum + i.line_total, 0) : 0;
    },
    [savedOrders]
  );

  const getSavedOrderItemCount = useCallback(
    (storeId: string) => {
      const order = savedOrders.find((o) => o.storeId === storeId);
      return order ? order.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
    },
    [savedOrders]
  );

  const updateSavedOrderNotes = useCallback(
    (storeId: string, notes: string) => {
      setSavedOrders((prev) => {
        const updated = prev.map((o) => o.storeId === storeId ? { ...o, notes } : o);
        AsyncStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const removeSavedOrderItem = useCallback(
    (storeId: string, productId: string) => {
      setSavedOrders((prev) => {
        const updated = prev.map((o) => {
          if (o.storeId !== storeId) return o;
          const items = o.items.filter((i) => i.product_id !== productId);
          return { ...o, items };
        }).filter((o) => o.items.length > 0);
        AsyncStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const updateSavedOrderItemQty = useCallback(
    (storeId: string, productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeSavedOrderItem(storeId, productId);
        return;
      }
      setSavedOrders((prev) => {
        const updated = prev.map((o) => {
          if (o.storeId !== storeId) return o;
          return {
            ...o,
            items: o.items.map((i) =>
              i.product_id === productId
                ? { ...i, quantity: Math.min(quantity, i.stock_quantity), line_total: Math.min(quantity, i.stock_quantity) * i.unit_price }
                : i
            ),
          };
        });
        AsyncStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [removeSavedOrderItem]
  );

  // ─── Local stores (offline) ──────────────────────────────────────────

  const addLocalStore = useCallback(
    (name: string): LocalStore => {
      const store: LocalStore = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        createdAt: new Date().toISOString(),
      };
      setLocalStores((prev) => {
        const updated = [...prev, store];
        AsyncStorage.setItem(LOCAL_STORES_KEY, JSON.stringify(updated));
        return updated;
      });
      return store;
    },
    []
  );

  const removeLocalStore = useCallback(
    (id: string) => {
      setLocalStores((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        AsyncStorage.setItem(LOCAL_STORES_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const isLocalStore = useCallback(
    (id: string) => localStores.some((s) => s.id === id) || id.startsWith('local_'),
    [localStores]
  );

  // ─── Store-based cart operations (legacy) ───────────────────────────

  const setActiveStore = useCallback((id: string | null) => {
    setActiveStoreId(id);
  }, []);

  const addStoreOrder = useCallback((id: string, name: string) => {
    setStoreOrders((prev) => {
      if (prev.some((o) => o.storeId === id)) return prev;
      return [...prev, { storeId: id, storeName: name, items: [], savedAt: new Date().toISOString() }];
    });
  }, []);

  const removeStoreOrder = useCallback((id: string) => {
    setStoreOrders((prev) => prev.filter((o) => o.storeId !== id));
    setActiveStoreId((prev) => (prev === id ? null : prev));
    setSubmittedStores((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setSubmittedHistory((prev) => prev.filter((r) => r.storeId !== id));
  }, []);

  const renameStoreOrder = useCallback((id: string, newName: string) => {
    setStoreOrders((prev) =>
      prev.map((o) => o.storeId === id ? { ...o, storeName: newName } : o)
    );
    setSubmittedHistory((prev) =>
      prev.map((r) => r.storeId === id ? { ...r, storeName: newName } : r)
    );
  }, []);

  const isStoreAdded = useCallback(
    (id: string) => storeOrders.some((o) => o.storeId === id),
    [storeOrders]
  );

  const addItem = useCallback(
    (product: { id: string; name: string; price: number; stock_quantity: number }, quantity = 1) => {
      addDraftItem(product, quantity);
    },
    [addDraftItem]
  );

  const removeItem = useCallback(
    (productId: string) => {
      removeDraftItem(productId);
    },
    [removeDraftItem]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      updateDraftQuantity(productId, quantity);
    },
    [updateDraftQuantity]
  );

  const getStoreItems = useCallback(
    (storeId: string): CartItem[] =>
      storeOrders.find((o) => o.storeId === storeId)?.items ?? [],
    [storeOrders]
  );

  const removeItemFromStore = useCallback((storeId: string, productId: string) => {
    setStoreOrders((prev) =>
      prev.map((order) =>
        order.storeId !== storeId
          ? order
          : { ...order, items: order.items.filter((i) => i.product_id !== productId) }
      )
    );
  }, []);

  const updateQuantityInStore = useCallback((storeId: string, productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItemFromStore(storeId, productId);
      return;
    }
    setStoreOrders((prev) =>
      prev.map((order) => {
        if (order.storeId !== storeId) return order;
        return {
          ...order,
          items: order.items.map((i) =>
            i.product_id === productId
              ? {
                  ...i,
                  quantity: Math.min(quantity, i.stock_quantity),
                  line_total: Math.min(quantity, i.stock_quantity) * i.unit_price,
                }
              : i
          ),
        };
      })
    );
  }, [removeItemFromStore]);

  const getStoreSubtotal = useCallback(
    (storeId: string): number =>
      (storeOrders.find((o) => o.storeId === storeId)?.items ?? []).reduce(
        (sum, i) => sum + i.line_total,
        0
      ),
    [storeOrders]
  );

  const getItemCount = useCallback(
    () => {
      const storeCount = storeOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
      const draftCount = draftItems.reduce((sum, i) => sum + i.quantity, 0);
      return storeCount + draftCount;
    },
    [storeOrders, draftItems]
  );

  const markStoreSubmitted = useCallback((storeId: string, storeName: string, itemCount: number, subtotal: number, items: CartItem[]) => {
    setSubmittedStores((prev) => new Set(prev).add(storeId));
    setSubmittedHistory((prev) => [
      { storeId, storeName, itemCount, subtotal, submittedAt: new Date(), items },
      ...prev,
    ]);
    setStoreOrders((prev) =>
      prev.map((o) => o.storeId === storeId ? { ...o, items: [] } : o)
    );
    // Also remove from saved orders after successful submit
    setSavedOrders((prev) => {
      const updated = prev.filter((o) => o.storeId !== storeId);
      AsyncStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(updated));
      return updated;
    });
    // Also remove local store entry if it was a local store
    setLocalStores((prev) => {
      if (!prev.some((s) => s.id === storeId)) return prev;
      const updated = prev.filter((s) => s.id !== storeId);
      AsyncStorage.setItem(LOCAL_STORES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setStoreOrders([]);
    setActiveStoreId(null);
    setSubmittedStores(new Set());
    setSubmittedHistory([]);
    setDraftItems([]);
  }, []);

  // items now reflects draftItems for the products screen
  const items = useMemo(() => draftItems, [draftItems]);

  return (
    <CartContext.Provider
      value={{
        draftItems,
        addDraftItem,
        removeDraftItem,
        updateDraftQuantity,
        getDraftSubtotal,
        getDraftItemCount,
        clearDraft,
        savedOrders,
        saveOrderForStore,
        removeSavedOrder,
        getSavedOrderSubtotal,
        getSavedOrderItemCount,
        updateSavedOrderNotes,
        removeSavedOrderItem,
        updateSavedOrderItemQty,
        localStores,
        addLocalStore,
        removeLocalStore,
        isLocalStore,
        storeOrders,
        activeStoreId,
        setActiveStore,
        addStoreOrder,
        removeStoreOrder,
        renameStoreOrder,
        isStoreAdded,
        items,
        addItem,
        removeItem,
        updateQuantity,
        removeItemFromStore,
        updateQuantityInStore,
        getStoreItems,
        getStoreSubtotal,
        getItemCount,
        clearAll,
        submittedStores,
        submittedHistory,
        markStoreSubmitted,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
