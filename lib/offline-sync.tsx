import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  getUnsyncedOrders,
  addUnsyncedOrder,
  removeUnsyncedOrder,
  syncAllOrders,
} from '@/lib/offline-queue';
import type { UnsyncedOrder, CartItem } from '@/types';

interface OfflineSyncContextType {
  unsyncedOrders: UnsyncedOrder[];
  unsyncedCount: number;
  isSyncing: boolean;
  queueOrder: (data: {
    storeId: string;
    storeName: string;
    items: CartItem[];
    notes?: string;
  }) => Promise<UnsyncedOrder>;
  syncNow: () => Promise<{ synced: number; failed: number }>;
  removeOrder: (id: string) => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  unsyncedOrders: [],
  unsyncedCount: 0,
  isSyncing: false,
  queueOrder: async () => {
    throw new Error('OfflineSyncProvider not mounted');
  },
  syncNow: async () => ({ synced: 0, failed: 0 }),
  removeOrder: async () => {},
});

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [unsyncedOrders, setUnsyncedOrders] = useState<UnsyncedOrder[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isConnected = useNetworkStatus();
  const prevConnected = useRef(isConnected);
  const syncLock = useRef(false);

  // Load unsynced orders on mount
  useEffect(() => {
    getUnsyncedOrders().then(setUnsyncedOrders);
  }, []);

  // Auto-sync when network transitions from offline → online
  useEffect(() => {
    if (isConnected && !prevConnected.current && unsyncedOrders.length > 0) {
      handleSync();
    }
    prevConnected.current = isConnected;
  }, [isConnected]);

  const queueOrder = useCallback(
    async (data: {
      storeId: string;
      storeName: string;
      items: CartItem[];
      notes?: string;
    }) => {
      const order = await addUnsyncedOrder(data);
      setUnsyncedOrders((prev) => [...prev, order]);
      return order;
    },
    [],
  );

  const handleSync = useCallback(async () => {
    if (syncLock.current) return { synced: 0, failed: 0 };
    syncLock.current = true;
    setIsSyncing(true);
    try {
      const result = await syncAllOrders((syncedOrder) => {
        setUnsyncedOrders((prev) => prev.filter((o) => o.id !== syncedOrder.id));
      });
      // Reload from storage to pick up error updates on failed orders
      const updated = await getUnsyncedOrders();
      setUnsyncedOrders(updated);
      return result;
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, []);

  const handleRemoveOrder = useCallback(async (id: string) => {
    const updated = await removeUnsyncedOrder(id);
    setUnsyncedOrders(updated);
  }, []);

  return (
    <OfflineSyncContext.Provider
      value={{
        unsyncedOrders,
        unsyncedCount: unsyncedOrders.length,
        isSyncing,
        queueOrder,
        syncNow: handleSync,
        removeOrder: handleRemoveOrder,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSync must be used within OfflineSyncProvider');
  }
  return context;
}
