import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Text, TextInput } from '@/components/ScaledText';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/lib/cart';
import type { LocalStore } from '@/lib/cart';
import { useStores } from '@/hooks/useStores';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineSync } from '@/lib/offline-sync';
import { formatCurrency } from '@/lib/formatters';
import { createOrder } from '@/services/orders.service';
import { createStore, updateStore, deleteStore, getTopStores } from '@/services/stores.service';
import type { Store } from '@/types';

export default function CartScreen() {
  const {
    draftItems,
    removeDraftItem,
    updateDraftQuantity,
    getDraftSubtotal,
    getDraftItemCount,
    clearDraft,
    savedOrders,
    saveOrderForStore,
    removeSavedOrder,
    removeSavedOrderItem,
    updateSavedOrderItemQty,
    updateSavedOrderNotes,
    markStoreSubmitted,
    localStores,
    addLocalStore,
    isLocalStore,
  } = useCart();

  const { stores, loading: storesLoading, refetch: refetchStores } = useStores();
  const isConnected = useNetworkStatus();
  const { queueOrder } = useOfflineSync();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [submittingStores, setSubmittingStores] = useState<Set<string>>(new Set());

  const draftCount = getDraftItemCount();
  const draftSubtotal = getDraftSubtotal();

  function handleAddCustomStore(details: { name: string; address?: string | null; contact_phone?: string | null }) {
    // Save store locally only - will sync to server on submit
    const store = addLocalStore(details.name, {
      address: details.address,
      contact_phone: details.contact_phone,
    });
    if (draftItems.length > 0) {
      saveOrderForStore(store.id, store.name, draftItems, notes || undefined, {
        address: store.address,
        contact_phone: store.contact_phone,
      });
      clearDraft();
      setNotes('');
    }
    setShowStoreModal(false);
  }

  function handleSaveToStore(store: Store) {
    if (draftItems.length === 0) {
      Alert.alert('No Products', 'Please add at least one product before saving.');
      return;
    }
    saveOrderForStore(store.id, store.name, draftItems, notes || undefined, {
      address: store.address,
      contact_phone: store.contact_phone,
    });
    clearDraft();
    setNotes('');
    setShowStoreModal(false);
  }

  async function handleSubmitSavedOrder(storeId: string, storeName: string) {
    const order = savedOrders.find((o) => o.storeId === storeId);
    if (!order || order.items.length === 0) return;
    if (submittingStores.has(storeId)) return;

    const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = order.items.reduce((sum, i) => sum + i.line_total, 0);

    // Helper: save to local queue and navigate to offline confirmation
    async function queueAsOffline() {
      try {
        const unsyncedOrder = await queueOrder({
          storeId,
          storeName,
          storeAddress: order!.storeAddress,
          storeContactPhone: order!.storeContactPhone,
          items: order!.items,
          notes: order!.notes || undefined,
        });
        markStoreSubmitted(storeId, storeName, itemCount, subtotal, order!.items);
        router.replace({
          pathname: '/(collector)/confirmation',
          params: { orderNumber: unsyncedOrder.tempOrderNumber, isOffline: 'true' },
        });
      } catch {
        Alert.alert('Error', 'Could not save order to device storage.');
      }
    }

    // If we know we're offline, skip straight to local queue
    if (!isConnected) {
      await queueAsOffline();
      return;
    }

    // Online path — wrapped in try/catch so any network failure falls back to offline queue
    setSubmittingStores((prev) => new Set([...prev, storeId]));
    try {
      let serverStoreId = storeId;
      if (isLocalStore(storeId)) {
        const serverStore = await createStore(storeName, {
          address: order.storeAddress,
          contact_phone: order.storeContactPhone,
        });
        serverStoreId = serverStore.id;
      }

      const result = await createOrder({
        store_id: serverStoreId,
        notes: order.notes,
        items: order.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });

      markStoreSubmitted(storeId, storeName, itemCount, subtotal, order.items);
      refetchStores();
      router.replace({ pathname: '/(collector)/confirmation', params: { orderNumber: result.order_number } });
    } catch (err: any) {
      const msg = (err?.message ?? '').toLowerCase();
      const isNetworkErr =
        msg.includes('network request failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('network error') ||
        msg.includes('fetch');
      if (isNetworkErr) {
        // Silently fall back to offline queue — user still gets success confirmation
        await queueAsOffline();
      } else {
        Alert.alert('Error', err.message || 'Failed to submit order. Please try again.');
      }
    } finally {
      setSubmittingStores((prev) => {
        const next = new Set(prev);
        next.delete(storeId);
        return next;
      });
    }
  }

  function handleRemoveSavedOrder(storeId: string, storeName: string) {
    Alert.alert(
      'Remove Order',
      `Remove saved order for "${storeName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeSavedOrder(storeId) },
      ]
    );
  }

  async function handleRenameStore(storeId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await updateStore(storeId, { name: trimmed });
      refetchStores();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not rename store');
    }
  }

  function handleDeleteStore(storeId: string, storeName: string) {
    Alert.alert(
      'Delete Store',
      `Delete "${storeName}" permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStore(storeId);
              refetchStores();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete store. It may have associated orders.');
            }
          },
        },
      ]
    );
  }

  const hasDraft = draftItems.length > 0;
  const hasSavedOrders = savedOrders.length > 0;

  // Empty state: no draft and no saved orders
  if (!hasDraft && !hasSavedOrders) {
    return (
      <View className="flex-1 bg-[#0D1F33]">
        <View className="bg-[#152D4A] flex-row items-center px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
            <Ionicons name="arrow-back" size={22} color="#E8EDF2" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-[#E8EDF2]">Checkout</Text>
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="bag-outline" size={48} color="#8FAABE33" />
          <Text className="text-[#8FAABE] text-lg font-medium mt-4">Your cart is empty</Text>
          <Text className="text-[#8FAABE]/50 text-sm mt-1 text-center">
            Browse products and add items to start your order
          </Text>
          <TouchableOpacity
            className="mt-6 bg-[#5B9BD5] rounded-lg px-8 py-3"
            onPress={() => router.back()}
          >
            <Text className="text-white font-semibold">Browse Products</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0D1F33]">
      {/* Header */}
      <View className="bg-[#152D4A] flex-row items-center px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <Ionicons name="arrow-back" size={22} color="#E8EDF2" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-bold text-[#E8EDF2]">Checkout</Text>
        </View>
        {!isConnected && (
          <View className="flex-row items-center gap-1 bg-[#E06C75]/10 px-2.5 py-1 rounded-full">
            <Ionicons name="cloud-offline-outline" size={14} color="#E06C75" />
            <Text className="text-[10px] text-[#E06C75] font-semibold">Offline</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 12,
          paddingBottom: hasDraft ? 140 + insets.bottom : 24 + insets.bottom,
          ...(isTablet ? { maxWidth: 640, alignSelf: 'center' as const, width: '100%' } : {}),
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Current Draft ─── */}
        {hasDraft && (
          <>
            <Text className="text-[10px] text-[#8FAABE]/50 font-bold uppercase tracking-wider mb-2">
              Current Draft ({draftCount})
            </Text>
            <View className="bg-[#162F4D] rounded-xl border border-[#1E3F5E]/60 overflow-hidden mb-4">
              {draftItems.map((item, index) => (
                <View
                  key={item.product_id}
                  className={`px-4 py-3 ${index < draftItems.length - 1 ? 'border-b border-[#1E3F5E]/30' : ''}`}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-semibold text-[#E8EDF2]">
                        {item.product_name}
                      </Text>
                      <Text className="text-xs text-[#8FAABE]/50 mt-0.5">
                        {formatCurrency(item.unit_price)} x {item.quantity}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-[#E8EDF2]">
                      {formatCurrency(item.line_total)}
                    </Text>
                  </View>

                  {/* Quantity controls */}
                  <View className="flex-row items-center mt-2">
                    <TouchableOpacity
                      className="w-7 h-7 rounded-full bg-[#1A3755] items-center justify-center"
                      onPress={() => {
                        if (item.quantity <= 1) {
                          removeDraftItem(item.product_id);
                        } else {
                          updateDraftQuantity(item.product_id, item.quantity - 1);
                        }
                      }}
                    >
                      <Ionicons
                        name={item.quantity <= 1 ? 'trash-outline' : 'remove'}
                        size={14}
                        color={item.quantity <= 1 ? '#E06C75' : '#E8EDF2'}
                      />
                    </TouchableOpacity>
                    <Text className="mx-3 text-sm font-medium text-[#E8EDF2] min-w-[20px] text-center">
                      {item.quantity}
                    </Text>
                    <TouchableOpacity
                      className="w-7 h-7 rounded-full bg-[#1A3755] items-center justify-center"
                      onPress={() => updateDraftQuantity(item.product_id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock_quantity}
                    >
                      <Ionicons
                        name="add"
                        size={14}
                        color={item.quantity >= item.stock_quantity ? '#1E3F5E' : '#E8EDF2'}
                      />
                    </TouchableOpacity>
                    <View className="flex-1" />
                    <TouchableOpacity onPress={() => removeDraftItem(item.product_id)}>
                      <Ionicons name="close-circle-outline" size={18} color="#8FAABE" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Subtotal */}
              <View className="px-4 py-3 border-t border-[#1E3F5E]/60 bg-[#1A3755] flex-row justify-between items-center">
                <Text className="text-sm font-bold text-[#E8EDF2]">Subtotal</Text>
                <Text className="text-base font-bold text-[#5B9BD5]">
                  {formatCurrency(draftSubtotal)}
                </Text>
              </View>
            </View>

            {/* Add more products */}
            <TouchableOpacity
              className="flex-row items-center justify-center gap-1.5 py-2.5 mb-4"
              onPress={() => router.back()}
            >
              <Ionicons name="add-circle-outline" size={16} color="#5B9BD5" />
              <Text className="text-sm font-medium text-[#5B9BD5]">Add more products</Text>
            </TouchableOpacity>

            {/* Notes for draft */}
            <Text className="text-[10px] text-[#8FAABE]/50 font-bold uppercase tracking-wider mb-2">
              Notes (optional)
            </Text>
            <TextInput
              className="bg-[#162F4D] rounded-xl border border-[#1E3F5E]/60 px-4 py-3 text-sm text-[#E8EDF2] mb-4"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes for this order..."
              placeholderTextColor="#8FAABE66"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              keyboardAppearance="dark"
              style={{ minHeight: 72 }}
            />
          </>
        )}

        {/* ─── Saved Store Orders ─── */}
        {hasSavedOrders && (
          <>
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="save-outline" size={16} color="#8FAABE" />
              <Text className="text-[10px] text-[#8FAABE]/50 font-bold uppercase tracking-wider">
                Saved Orders ({savedOrders.length})
              </Text>
            </View>

            {[...savedOrders].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).map((order) => {
              const orderSubtotal = order.items.reduce((sum, i) => sum + i.line_total, 0);
              const orderItemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
              const isSubmitting = submittingStores.has(order.storeId);

              return (
                <View
                  key={order.storeId}
                  className="bg-[#162F4D] rounded-xl border border-[#1E3F5E]/60 overflow-hidden mb-4"
                >
                  {/* Store header */}
                  <View className="flex-row items-center justify-between px-4 py-3 bg-[#1A3755] border-b border-[#1E3F5E]/30">
                    <View className="flex-row items-center gap-2.5 flex-1">
                      <View className="w-8 h-8 bg-[#5B9BD5]/10 rounded-full items-center justify-center">
                        <Ionicons name="storefront" size={16} color="#5B9BD5" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-[#E8EDF2]" numberOfLines={1}>
                          {order.storeName}
                        </Text>
                        <Text className="text-[10px] text-[#8FAABE]/50">
                          {orderItemCount} item{orderItemCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveSavedOrder(order.storeId, order.storeName)}
                      className="p-1.5"
                    >
                      <Ionicons name="trash-outline" size={18} color="#E06C75" />
                    </TouchableOpacity>
                  </View>

                  {/* Items */}
                  {order.items.map((item, index) => (
                    <View
                      key={item.product_id}
                      className={`px-4 py-2.5 ${index < order.items.length - 1 ? 'border-b border-[#1E3F5E]/20' : ''}`}
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-3">
                          <Text className="text-xs font-semibold text-[#E8EDF2]" numberOfLines={1}>
                            {item.product_name}
                          </Text>
                          <Text className="text-[10px] text-[#8FAABE]/50">
                            {formatCurrency(item.unit_price)} x {item.quantity}
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-[#E8EDF2]">
                          {formatCurrency(item.line_total)}
                        </Text>
                      </View>
                      {/* Quantity controls for saved items */}
                      <View className="flex-row items-center mt-1.5">
                        <TouchableOpacity
                          className="w-6 h-6 rounded-full bg-[#0D1F33] items-center justify-center"
                          onPress={() => {
                            if (item.quantity <= 1) {
                              removeSavedOrderItem(order.storeId, item.product_id);
                            } else {
                              updateSavedOrderItemQty(order.storeId, item.product_id, item.quantity - 1);
                            }
                          }}
                        >
                          <Ionicons
                            name={item.quantity <= 1 ? 'trash-outline' : 'remove'}
                            size={12}
                            color={item.quantity <= 1 ? '#E06C75' : '#E8EDF2'}
                          />
                        </TouchableOpacity>
                        <Text className="mx-2 text-xs font-medium text-[#E8EDF2] min-w-[16px] text-center">
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          className="w-6 h-6 rounded-full bg-[#0D1F33] items-center justify-center"
                          onPress={() => updateSavedOrderItemQty(order.storeId, item.product_id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock_quantity}
                        >
                          <Ionicons
                            name="add"
                            size={12}
                            color={item.quantity >= item.stock_quantity ? '#1E3F5E' : '#E8EDF2'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  {/* Notes for this order */}
                  {order.notes ? (
                    <View className="px-4 py-2 border-t border-[#1E3F5E]/20">
                      <Text className="text-[10px] text-[#8FAABE]/50">Note: {order.notes}</Text>
                    </View>
                  ) : null}

                  {/* Subtotal + Submit */}
                  <View className="px-4 py-3 border-t border-[#1E3F5E]/60 bg-[#1A3755]">
                    <View className="flex-row justify-between items-center mb-2.5">
                      <Text className="text-sm font-bold text-[#E8EDF2]">Subtotal</Text>
                      <Text className="text-base font-bold text-[#5B9BD5]">
                        {formatCurrency(orderSubtotal)}
                      </Text>
                    </View>

                    {!isConnected ? (
                      <TouchableOpacity
                        className="rounded-xl py-3 items-center bg-[#E5C07B] flex-row justify-center gap-2"
                        onPress={() => handleSubmitSavedOrder(order.storeId, order.storeName)}
                      >
                        <Ionicons name="cloud-upload-outline" size={16} color="#0D1F33" />
                        <Text className="text-[#0D1F33] text-xs font-bold">Submit Offline</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        className={`rounded-xl py-3 items-center ${
                          isSubmitting ? 'bg-[#98C379]/70' : 'bg-[#98C379]'
                        }`}
                        onPress={() => handleSubmitSavedOrder(order.storeId, order.storeName)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <View className="flex-row items-center gap-2">
                            <ActivityIndicator size="small" color="#fff" />
                            <Text className="text-white text-xs font-bold">Submitting...</Text>
                          </View>
                        ) : (
                          <Text className="text-white text-xs font-bold">Submit Order</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Fixed bottom: Save to store button (only for draft) */}
      {hasDraft && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-[#162F4D] border-t border-[#1E3F5E]/60 px-4 py-4"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-[#8FAABE]">Draft Total</Text>
            <Text className="text-xl font-extrabold text-[#5B9BD5]">
              {formatCurrency(draftSubtotal)}
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-xl py-4 items-center bg-[#5B9BD5] flex-row justify-center gap-2"
            onPress={() => setShowStoreModal(true)}
          >
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text className="text-white text-sm font-bold">Save Order to Store</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Store Picker Modal - Full Viewport */}
      <StorePickerModal
        visible={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        stores={stores.filter((s) => s.is_active)}
        localStores={localStores}
        loading={storesLoading}
        onSelect={handleSaveToStore}
        onAddCustom={handleAddCustomStore}
        onRename={handleRenameStore}
        onDelete={handleDeleteStore}
        insets={insets}
      />
    </View>
  );
}

function StorePickerModal({
  visible,
  onClose,
  stores,
  localStores,
  loading,
  onSelect,
  onAddCustom,
  onRename,
  onDelete,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  stores: Store[];
  localStores: LocalStore[];
  loading: boolean;
  onSelect: (store: Store) => void;
  onAddCustom: (details: { name: string; address?: string | null; contact_phone?: string | null }) => void;
  onRename: (storeId: string, newName: string) => Promise<void>;
  onDelete: (storeId: string, storeName: string) => void;
  insets: { top: number; bottom: number };
}) {
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [query, setQuery] = useState('');
  const [topStores, setTopStores] = useState<{ store_id: string; store_name: string; order_count: number }[]>([]);
  const [topLoading, setTopLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Fetch top stores when modal opens
  React.useEffect(() => {
    if (!visible) return;
    setTopLoading(true);
    getTopStores(3)
      .then(setTopStores)
      .catch(() => setTopStores([]))
      .finally(() => setTopLoading(false));
  }, [visible]);

  const trimmedNew = newName.trim();
  const filtered = query.trim()
    ? stores.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : stores;

  function handleClose() {
    setNewName('');
    setNewAddress('');
    setNewContactPhone('');
    setQuery('');
    setMenuOpenId(null);
    onClose();
  }

  function handleSelect(store: Store) {
    setNewName('');
    setNewAddress('');
    setNewContactPhone('');
    setQuery('');
    setMenuOpenId(null);
    onSelect(store);
  }

  function handleTopStoreSelect(storeId: string, storeName: string) {
    const store = stores.find((s) => s.id === storeId);
    if (store) {
      handleSelect(store);
    } else {
      onSelect({ id: storeId, name: storeName, address: null, contact_phone: null } as Store);
      setNewName('');
      setNewAddress('');
      setNewContactPhone('');
      setQuery('');
    }
  }

  function handleAdd() {
    if (!trimmedNew) return;
    onAddCustom({
      name: trimmedNew,
      address: newAddress.trim() || null,
      contact_phone: newContactPhone.trim() || null,
    });
    setNewName('');
    setNewAddress('');
    setNewContactPhone('');
  }

  function openRenameModal(store: Store) {
    setMenuOpenId(null);
    setRenameValue(store.name);
    setRenameModal({ id: store.id, name: store.name });
  }

  async function confirmRename() {
    if (!renameModal) return;
    await onRename(renameModal.id, renameValue);
    setRenameModal(null);
    setRenameValue('');
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 bg-[#0D1F33]" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#1E3F5E]/60">
          <TouchableOpacity onPress={handleClose} className="p-1">
            <Ionicons name="close" size={24} color="#E8EDF2" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-[#E8EDF2]">Save to Store</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Stores */}
          {!topLoading && topStores.length > 0 && !query.trim() && (
            <View className="mb-5">
              <Text className="text-[10px] text-[#8FAABE]/50 font-bold uppercase tracking-wider mb-2">
                Top Stores
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {topStores.map((ts) => (
                  <TouchableOpacity
                    key={ts.store_id}
                    className="bg-[#5B9BD5]/10 border border-[#5B9BD5]/30 rounded-xl px-3 py-2 flex-row items-center gap-1.5"
                    onPress={() => handleTopStoreSelect(ts.store_id, ts.store_name)}
                  >
                    <Ionicons name="star" size={12} color="#5B9BD5" />
                    <Text className="text-xs font-semibold text-[#5B9BD5]" numberOfLines={1}>
                      {ts.store_name}
                    </Text>
                    <Text className="text-[10px] text-[#5B9BD5]/60">
                      ({ts.order_count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Create new store */}
          <View className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-3.5 mb-5">
            <Text className="text-sm font-semibold text-[#8FAABE] mb-3">New Store</Text>
            <TextInput
              className="bg-[#1A3755] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF2] mb-2"
              value={newName}
              onChangeText={setNewName}
              placeholder="Store name"
              placeholderTextColor="#8FAABE66"
              returnKeyType="next"
              keyboardAppearance="dark"
            />
            <TextInput
              className="bg-[#1A3755] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF2] mb-2"
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="Store address"
              placeholderTextColor="#8FAABE66"
              returnKeyType="next"
              keyboardAppearance="dark"
            />
            <TextInput
              className="bg-[#1A3755] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF2] mb-3"
              value={newContactPhone}
              onChangeText={setNewContactPhone}
              placeholder="Contact number"
              placeholderTextColor="#8FAABE66"
              keyboardType="phone-pad"
              returnKeyType="done"
              keyboardAppearance="dark"
              onSubmitEditing={handleAdd}
            />
            <TouchableOpacity
              className={`rounded-lg px-4 py-2.5 items-center justify-center ${
                !trimmedNew ? 'bg-[#5B9BD5]/50' : 'bg-[#5B9BD5]'
              }`}
              onPress={handleAdd}
              disabled={!trimmedNew}
            >
              <Text className="text-white text-sm font-bold">Add Store & Save Order</Text>
            </TouchableOpacity>
          </View>

          {/* Local / Saved Stores */}
          {localStores.length > 0 && !query.trim() && (
            <View className="mb-5">
              <Text className="text-[10px] text-[#8FAABE]/50 font-bold uppercase tracking-wider mb-2">
                Saved Stores (Offline)
              </Text>
              {localStores.map((ls) => (
                <TouchableOpacity
                  key={ls.id}
                  className="flex-row items-center bg-[#162F4D] border border-[#E5C07B]/30 rounded-xl p-3.5 mb-2"
                  onPress={() => {
                    onSelect({
                      id: ls.id,
                      name: ls.name,
                      address: ls.address || null,
                      contact_phone: ls.contact_phone || null,
                    } as Store);
                    setNewName('');
                    setNewAddress('');
                    setNewContactPhone('');
                    setQuery('');
                  }}
                >
                  <View className="w-8 h-8 bg-[#E5C07B]/10 rounded-full items-center justify-center mr-2.5">
                    <Ionicons name="phone-portrait-outline" size={14} color="#E5C07B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-[#E8EDF2]" numberOfLines={1}>
                      {ls.name}
                    </Text>
                    {ls.address ? (
                      <Text className="text-[10px] text-[#8FAABE]/50" numberOfLines={1}>{ls.address}</Text>
                    ) : null}
                    {ls.contact_phone ? (
                      <Text className="text-[10px] text-[#8FAABE]/50" numberOfLines={1}>{ls.contact_phone}</Text>
                    ) : null}
                    <Text className="text-[10px] text-[#E5C07B]/60">Saved locally</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Divider */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="flex-1 h-px bg-[#1E3F5E]/30" />
            <Text className="text-xs text-[#8FAABE]/50 font-medium">or select existing</Text>
            <View className="flex-1 h-px bg-[#1E3F5E]/30" />
          </View>

          {/* Search existing */}
          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#5B9BD5" />
              <Text className="text-[#8FAABE]/50 text-sm mt-2">Loading stores...</Text>
            </View>
          ) : (
            <>
              <TextInput
                className="bg-[#1A3755] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF2] mb-3"
                value={query}
                onChangeText={setQuery}
                placeholder="Search stores..."
                placeholderTextColor="#8FAABE66"
                keyboardAppearance="dark"
              />
              {filtered.length > 0 ? (
                <View>
                  {filtered.map((store) => (
                    <View
                      key={store.id}
                      className="flex-row items-center bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl p-3.5 mb-2"
                    >
                      <TouchableOpacity
                        className="flex-1 flex-row items-center gap-2.5"
                        onPress={() => handleSelect(store)}
                      >
                        <View className="w-8 h-8 bg-[#5B9BD5]/10 rounded-full items-center justify-center">
                          <Ionicons name="storefront" size={14} color="#5B9BD5" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-[#E8EDF2]" numberOfLines={1}>
                            {store.name}
                          </Text>
                          {store.address ? (
                            <Text className="text-[10px] text-[#8FAABE]/50" numberOfLines={1}>{store.address}</Text>
                          ) : null}
                          {store.contact_phone ? (
                            <Text className="text-[10px] text-[#8FAABE]/50" numberOfLines={1}>{store.contact_phone}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>

                      {/* Three-dot menu */}
                      <View className="relative">
                        <TouchableOpacity
                          onPress={() => setMenuOpenId(menuOpenId === store.id ? null : store.id)}
                          className="p-2"
                        >
                          <Ionicons name="ellipsis-vertical" size={18} color="#8FAABE" />
                        </TouchableOpacity>
                        {menuOpenId === store.id && (
                          <View
                            className="absolute right-0 top-10 bg-[#1A3755] rounded-xl border border-[#1E3F5E]/60 w-40 overflow-hidden"
                            style={{ elevation: 8, zIndex: 50 }}
                          >
                            <TouchableOpacity
                              className="flex-row items-center gap-2.5 px-4 py-3 border-b border-[#1E3F5E]/30"
                              onPress={() => openRenameModal(store)}
                            >
                              <Ionicons name="pencil-outline" size={16} color="#E8EDF2" />
                              <Text className="text-sm text-[#E8EDF2]">Rename</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              className="flex-row items-center gap-2.5 px-4 py-3"
                              onPress={() => {
                                setMenuOpenId(null);
                                onDelete(store.id, store.name);
                              }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#E06C75" />
                              <Text className="text-sm text-[#E06C75]">Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="py-4 items-center">
                  <Text className="text-[#8FAABE]/50 text-sm">No stores found</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* Rename Sub-Modal */}
      <Modal
        visible={!!renameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModal(null)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-[#162F4D] rounded-2xl p-6 w-full border border-[#1E3F5E]/60" style={{ maxWidth: 340 }}>
            <Text className="text-lg font-bold text-[#E8EDF2] mb-4">Rename Store</Text>
            <TextInput
              className="bg-[#1A3755] border border-[#1E3F5E]/60 rounded-lg px-4 py-3 text-[#E8EDF2] mb-4"
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholderTextColor="#8FAABE66"
              keyboardAppearance="dark"
              returnKeyType="done"
              onSubmitEditing={confirmRename}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-[#1A3755] rounded-lg py-3 items-center"
                onPress={() => setRenameValue(renameModal?.name || '')}
              >
                <Text className="text-[#8FAABE] font-semibold">Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-[#5B9BD5] rounded-lg py-3 items-center"
                onPress={confirmRename}
              >
                <Text className="text-white font-semibold">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
