import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/lib/cart';
import { useOrderSubmit } from '@/hooks/useOrderSubmit';
import { useStores } from '@/hooks/useStores';
import { formatCurrency } from '@/lib/formatters';
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
    markStoreSubmitted,
  } = useCart();

  const { submitOrderForStore, isLoadingStore, getStoreError } = useOrderSubmit();
  const { stores, loading: storesLoading, refetch: refetchStores } = useStores();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [selectedStore, setSelectedStore] = useState<{ id: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');

  const draftCount = getDraftItemCount();
  const draftSubtotal = getDraftSubtotal();
  const isSubmitting = selectedStore ? isLoadingStore(selectedStore.id) : false;
  const submitError = selectedStore ? getStoreError(selectedStore.id) : null;

  async function handleAddCustomStore(name: string) {
    setCreatingStore(true);
    try {
      const store = await createStore(name);
      setSelectedStore({ id: store.id, name: store.name });
      setShowStoreModal(false);
      refetchStores();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create store');
    } finally {
      setCreatingStore(false);
    }
  }

  async function handleSubmit() {
    if (draftItems.length === 0) {
      Alert.alert('No Products', 'Please add at least one product to your order before submitting.');
      return;
    }
    if (!selectedStore) {
      Alert.alert('Store Required', 'Please select a store before submitting your order.');
      return;
    }

    const result = await submitOrderForStore(selectedStore.id, draftItems, notes || undefined);
    if (result) {
      markStoreSubmitted(selectedStore.id, selectedStore.name, draftCount, draftSubtotal, draftItems);
      clearDraft();
      setSelectedStore(null);
      setNotes('');
      router.replace({ pathname: '/(collector)/confirmation', params: { orderNumber: result.order_number } });
    }
  }

  async function handleRenameStore(storeId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await updateStore(storeId, { name: trimmed });
      if (selectedStore?.id === storeId) {
        setSelectedStore({ id: storeId, name: trimmed });
      }
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
              if (selectedStore?.id === storeId) setSelectedStore(null);
              refetchStores();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete store. It may have associated orders.');
            }
          },
        },
      ]
    );
  }

  // Empty state
  if (draftItems.length === 0) {
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
        <Text className="text-base font-bold text-[#E8EDF2]">Checkout</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 12,
          paddingBottom: 140 + insets.bottom,
          ...(isTablet ? { maxWidth: 640, alignSelf: 'center' as const, width: '100%' } : {}),
        }}
      >
        {/* Section: Order Items */}
        <Text className="text-[10px] text-[#8FAABE]/50 font-bold uppercase tracking-wider mb-2">
          Order Items ({draftCount})
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
                    {formatCurrency(item.unit_price)} × {item.quantity}
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

        {/* Section: Select Store */}
        <Text className="text-[10px] text-[#8FAABE]/50 font-bold uppercase tracking-wider mb-2">
          Store <Text className="text-[#E06C75]">*</Text>
        </Text>
        {selectedStore ? (
          <View className="bg-[#162F4D] rounded-xl border border-[#5B9BD5]/60 overflow-hidden mb-4">
            <View className="flex-row items-center justify-between px-4 py-3">
              <View className="flex-row items-center gap-2.5 flex-1">
                <View className="w-8 h-8 bg-[#5B9BD5]/10 rounded-full items-center justify-center">
                  <Ionicons name="storefront" size={16} color="#5B9BD5" />
                </View>
                <Text className="text-sm font-bold text-[#E8EDF2] flex-1" numberOfLines={1}>
                  {selectedStore.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedStore(null)}
                className="p-1.5"
              >
                <Ionicons name="close-circle" size={20} color="#8FAABE" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            className="bg-[#162F4D] rounded-xl border border-dashed border-[#1E3F5E]/60 px-4 py-4 flex-row items-center justify-center gap-2 mb-4"
            onPress={() => setShowStoreModal(true)}
          >
            <Ionicons name="storefront-outline" size={18} color="#8FAABE" />
            <Text className="text-sm text-[#8FAABE] font-medium">Select a store</Text>
          </TouchableOpacity>
        )}

        {/* Notes */}
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

        {/* Error */}
        {submitError && (
          <View className="bg-[#E06C75]/10 border border-[#E06C75]/30 rounded-lg p-3 mb-4">
            <Text className="text-[#E06C75] text-xs text-center">{submitError}</Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom: Submit button */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-[#162F4D] border-t border-[#1E3F5E]/60 px-4 py-4"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm text-[#8FAABE]">Total</Text>
          <Text className="text-xl font-extrabold text-[#5B9BD5]">
            {formatCurrency(draftSubtotal)}
          </Text>
        </View>
        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${
            isSubmitting ? 'bg-[#98C379]/70' : !selectedStore ? 'bg-[#1A3755]' : 'bg-[#98C379]'
          }`}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-white text-sm font-bold">Submitting...</Text>
            </View>
          ) : (
            <Text className={`text-sm font-bold ${!selectedStore ? 'text-[#8FAABE]/50' : 'text-white'}`}>
              {!selectedStore ? 'Select a store to submit' : 'Submit Order'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Store Picker Modal - Full Viewport */}
      <StorePickerModal
        visible={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        stores={stores.filter((s) => s.is_active)}
        loading={storesLoading}
        creatingCustom={creatingStore}
        onSelect={(store) => {
          setSelectedStore({ id: store.id, name: store.name });
          setShowStoreModal(false);
        }}
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
  loading,
  onSelect,
  onAddCustom,
  onRename,
  onDelete,
  creatingCustom,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  stores: Store[];
  loading: boolean;
  onSelect: (store: Store) => void;
  onAddCustom: (name: string) => void;
  onRename: (storeId: string, newName: string) => Promise<void>;
  onDelete: (storeId: string, storeName: string) => void;
  creatingCustom?: boolean;
  insets: { top: number; bottom: number };
}) {
  const [newName, setNewName] = useState('');
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
    setQuery('');
    setMenuOpenId(null);
    onClose();
  }

  function handleSelect(store: Store) {
    setNewName('');
    setQuery('');
    setMenuOpenId(null);
    onSelect(store);
  }

  function handleTopStoreSelect(storeId: string, storeName: string) {
    const store = stores.find((s) => s.id === storeId);
    if (store) {
      handleSelect(store);
    } else {
      onSelect({ id: storeId, name: storeName } as Store);
      setNewName('');
      setQuery('');
    }
  }

  function handleAdd() {
    if (!trimmedNew) return;
    onAddCustom(trimmedNew);
    setNewName('');
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
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-[#0D1F33]" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#1E3F5E]/60">
          <TouchableOpacity onPress={handleClose} className="p-1">
            <Ionicons name="close" size={24} color="#E8EDF2" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-[#E8EDF2]">Select Store</Text>
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
          <View className="flex-row items-center gap-2 mb-5">
            <Text className="text-sm font-semibold text-[#8FAABE] shrink-0">New Store</Text>
            <TextInput
              className="flex-1 bg-[#1A3755] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF2]"
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter store name"
              placeholderTextColor="#8FAABE66"
              returnKeyType="done"
              keyboardAppearance="dark"
              onSubmitEditing={handleAdd}
            />
            <TouchableOpacity
              className={`rounded-lg px-4 py-2.5 items-center justify-center ${
                !trimmedNew || creatingCustom ? 'bg-[#5B9BD5]/50' : 'bg-[#5B9BD5]'
              }`}
              onPress={handleAdd}
              disabled={!trimmedNew || creatingCustom}
            >
              {creatingCustom ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-sm font-bold">Add</Text>
              )}
            </TouchableOpacity>
          </View>

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
