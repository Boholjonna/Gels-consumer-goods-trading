import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOrder } from '@/services/orders.service';
import { createStore } from '@/services/stores.service';
import type { UnsyncedOrder, CartItem } from '@/types';

const UNSYNCED_ORDERS_KEY = 'offline_unsynced_orders';
const TEMP_ORDER_COUNTER_KEY = 'offline_order_counter';
const STORE_ID_MAP_KEY = 'offline_store_id_map';
const MAX_SYNC_ATTEMPTS = 5;

// ─── Storage CRUD ───────────────────────────────────────────────

export async function getUnsyncedOrders(): Promise<UnsyncedOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(UNSYNCED_ORDERS_KEY);
    if (raw) return JSON.parse(raw) as UnsyncedOrder[];
  } catch {}
  return [];
}

async function saveUnsyncedOrders(orders: UnsyncedOrder[]): Promise<void> {
  await AsyncStorage.setItem(UNSYNCED_ORDERS_KEY, JSON.stringify(orders));
}

async function getNextTempOrderNumber(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(TEMP_ORDER_COUNTER_KEY);
    const counter = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(TEMP_ORDER_COUNTER_KEY, String(counter));
    return `LOCAL-${String(counter).padStart(3, '0')}`;
  } catch {
    return `LOCAL-${Date.now()}`;
  }
}

export async function addUnsyncedOrder(data: {
  storeId: string;
  storeName: string;
  items: CartItem[];
  notes?: string;
}): Promise<UnsyncedOrder> {
  const orders = await getUnsyncedOrders();
  const id = `unsynced_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempOrderNumber = await getNextTempOrderNumber();

  const order: UnsyncedOrder = {
    id,
    tempOrderNumber,
    storeId: data.storeId,
    storeName: data.storeName,
    items: data.items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      stock_quantity: i.stock_quantity,
      line_total: i.line_total,
    })),
    notes: data.notes,
    subtotal: data.items.reduce((sum, i) => sum + i.line_total, 0),
    itemCount: data.items.reduce((sum, i) => sum + i.quantity, 0),
    createdAt: new Date().toISOString(),
    status: 'unsynced',
    syncAttempts: 0,
  };

  orders.push(order);
  await saveUnsyncedOrders(orders);
  return order;
}

export async function removeUnsyncedOrder(id: string): Promise<UnsyncedOrder[]> {
  const orders = await getUnsyncedOrders();
  const updated = orders.filter((o) => o.id !== id);
  await saveUnsyncedOrders(updated);
  return updated;
}

async function updateUnsyncedOrder(
  id: string,
  updates: Partial<Pick<UnsyncedOrder, 'syncError' | 'syncAttempts'>>,
): Promise<UnsyncedOrder[]> {
  const orders = await getUnsyncedOrders();
  const updated = orders.map((o) => (o.id === id ? { ...o, ...updates } : o));
  await saveUnsyncedOrders(updated);
  return updated;
}

// ─── Store ID Resolution (local → server) ───────────────────────

async function getStoreIdMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(STORE_ID_MAP_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {}
  return {};
}

async function saveStoreIdMapping(localId: string, serverId: string): Promise<void> {
  const map = await getStoreIdMap();
  map[localId] = serverId;
  await AsyncStorage.setItem(STORE_ID_MAP_KEY, JSON.stringify(map));
}

async function resolveStoreId(storeId: string, storeName: string): Promise<string> {
  if (!storeId.startsWith('local_')) return storeId;

  const map = await getStoreIdMap();
  if (map[storeId]) return map[storeId];

  const serverStore = await createStore(storeName);
  await saveStoreIdMapping(storeId, serverStore.id);
  return serverStore.id;
}

// ─── Sync Logic ─────────────────────────────────────────────────

async function syncSingleOrder(
  order: UnsyncedOrder,
): Promise<{ success: boolean; error?: string }> {
  if (order.syncAttempts >= MAX_SYNC_ATTEMPTS) {
    return { success: false, error: 'Max sync attempts reached. Please remove and re-submit.' };
  }

  try {
    const serverStoreId = await resolveStoreId(order.storeId, order.storeName);
    await createOrder({
      store_id: serverStoreId,
      notes: order.notes,
      items: order.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Sync failed' };
  }
}

export async function syncAllOrders(
  onOrderSynced?: (order: UnsyncedOrder) => void,
): Promise<{ synced: number; failed: number }> {
  const orders = await getUnsyncedOrders();
  // Process oldest first (FIFO)
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  let synced = 0;
  let failed = 0;

  for (const order of sorted) {
    const result = await syncSingleOrder(order);
    if (result.success) {
      await removeUnsyncedOrder(order.id);
      onOrderSynced?.(order);
      synced++;
    } else {
      await updateUnsyncedOrder(order.id, {
        syncError: result.error,
        syncAttempts: order.syncAttempts + 1,
      });
      failed++;
    }
  }

  return { synced, failed };
}
