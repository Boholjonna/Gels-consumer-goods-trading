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
import { useCart } from '@/lib/cart';
import { useOrderSubmit } from '@/hooks/useOrderSubmit';
import { useStores } from '@/hooks/useStores';
import { StoreSelector } from '@/components/StoreSelector';
import { formatCurrency, formatShortDate } from '@/lib/formatters';
import { createStore } from '@/services/stores.service';
import type { Store } from '@/types';

export default function CartScreen() {
  const {
    storeOrders,
    addStoreOrder,
    removeStoreOrder,
    isStoreAdded,
    getStoreItems,
    getStoreSubtotal,
    removeItemFromStore,
    updateQuantityInStore,
    submittedStores,
    submittedHistory,
    markStoreSubmitted,
    activeStoreId,
    setActiveStore,
  } = useCart();

  const { submitOrderForStore, isLoadingStore, getStoreError } = useOrderSubmit();
  const { stores, loading: storesLoading } = useStores();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [historyEditMode, setHistoryEditMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  function toggleHistorySelect(storeId: string) {
    setSelectedHistoryIds((prev) => {
      const n = new Set(prev);
      if (n.has(storeId)) n.delete(storeId); else n.add(storeId);
      return n;
    });
  }

  function exitHistoryEditMode() {
    setHistoryEditMode(false);
    setSelectedHistoryIds(new Set());
  }

  function deleteSelectedHistory() {
    selectedHistoryIds.forEach((id) => removeStoreOrder(id));
    exitHistoryEditMode();
  }

  async function handleAddCustomStore(name: string) {
    setCreatingStore(true);
    try {
      const store = await createStore(name);
      addStoreOrder(store.id, store.name);
      setShowStoreModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create store');
    } finally {
      setCreatingStore(false);
    }
  }

  async function handleSubmit(storeId: string, storeName: string) {
    const items = getStoreItems(storeId);
    const subtotal = getStoreSubtotal(storeId);
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);
    const result = await submitOrderForStore(storeId, items);
    if (result) {
      markStoreSubmitted(storeId, storeName, itemCount, subtotal, items);
      if (activeStoreId === storeId) setActiveStore(null);
    }
  }

  const availableStores = stores.filter((s) => s.is_active && !isStoreAdded(s.id));

  // Empty state
  if (storeOrders.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-4">
        <Ionicons name="storefront-outline" size={48} color="#d1d5db" />
        <Text className="text-gray-500 text-lg font-medium mt-4">No stores added yet</Text>
        <Text className="text-gray-400 text-sm mt-1 text-center">
          Tap "Add Store" to begin adding orders
        </Text>
        <TouchableOpacity
          className="mt-6 bg-blue-500 rounded-lg px-8 py-3"
          onPress={() => setShowStoreModal(true)}
        >
          <Text className="text-white font-semibold">Add Store</Text>
        </TouchableOpacity>

        <StorePickerModal
          visible={showStoreModal}
          onClose={() => setShowStoreModal(false)}
          stores={availableStores}
          loading={storesLoading}
          creatingCustom={creatingStore}
          onSelect={(store) => {
            addStoreOrder(store.id, store.name);
            setShowStoreModal(false);
          }}
          onAddCustom={handleAddCustomStore}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{
          padding: 12,
          paddingBottom: 40,
          ...(isTablet ? { maxWidth: 640, alignSelf: 'center' as const, width: '100%' } : {}),
        }}
      >
        {/* Top row: store count + Add Store button */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            {storeOrders.length} store{storeOrders.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            className="w-8 h-8 bg-blue-500 rounded-full items-center justify-center"
            onPress={() => setShowStoreModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Store cards */}
        {storeOrders.map((order) => {
          const isSubmitted = submittedStores.has(order.storeId);
          const historyRecord = isSubmitted
            ? submittedHistory.find((r) => r.storeId === order.storeId)
            : null;
          const items = isSubmitted
            ? (historyRecord?.items ?? [])
            : getStoreItems(order.storeId);
          const subtotal = isSubmitted
            ? (historyRecord?.subtotal ?? 0)
            : getStoreSubtotal(order.storeId);
          const isLoading = isLoadingStore(order.storeId);
          const storeError = getStoreError(order.storeId);

          return (
            <View
              key={order.storeId}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4"
            >
              {/* Card header */}
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                <View className="flex-row items-center flex-1 gap-2">
                  <View className={`w-1 h-5 rounded-full ${isSubmitted ? 'bg-gray-300' : 'bg-blue-500'}`} />
                  <Text className="text-sm font-bold text-gray-800" numberOfLines={1}>
                    {order.storeName}
                  </Text>
                  {isSubmitted ? (
                    <View className="bg-green-100 rounded-full px-2 py-0.5 flex-row items-center gap-1">
                      <Ionicons name="checkmark-circle" size={10} color="#16a34a" />
                      <Text className="text-[10px] text-green-700 font-bold">Submitted</Text>
                    </View>
                  ) : items.length > 0 ? (
                    <View className="bg-blue-100 rounded-full px-2 py-0.5">
                      <Text className="text-[10px] text-blue-600 font-bold">
                        {items.reduce((s, i) => s + i.quantity, 0)} items
                      </Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      'Remove Store',
                      `Remove "${order.storeName}" and all its items?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => removeStoreOrder(order.storeId),
                        },
                      ]
                    )
                  }
                >
                  <Ionicons name="close-circle-outline" size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              {/* Items */}
              {items.length === 0 ? (
                <View className="px-4 py-8 items-center">
                  <Text className="text-gray-400 text-sm">No products added yet</Text>
                </View>
              ) : (
                <>
                  {items.map((item, index) => (
                    <View
                      key={item.product_id}
                      className={`px-4 py-3 ${index < items.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-3">
                          <Text className="text-sm font-semibold text-gray-800">
                            {item.product_name}
                          </Text>
                          <Text className="text-xs text-gray-400 mt-0.5">
                            {formatCurrency(item.unit_price)} × {item.quantity}
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-gray-800">
                          {formatCurrency(item.line_total)}
                        </Text>
                      </View>

                      {/* Quantity controls */}
                      {!isSubmitted && (
                        <View className="flex-row items-center mt-2">
                          <TouchableOpacity
                            className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() => {
                              if (item.quantity <= 1) {
                                removeItemFromStore(order.storeId, item.product_id);
                              } else {
                                updateQuantityInStore(
                                  order.storeId,
                                  item.product_id,
                                  item.quantity - 1
                                );
                              }
                            }}
                          >
                            <Ionicons
                              name={item.quantity <= 1 ? 'trash-outline' : 'remove'}
                              size={14}
                              color={item.quantity <= 1 ? '#ef4444' : '#374151'}
                            />
                          </TouchableOpacity>
                          <Text className="mx-3 text-sm font-medium text-gray-700 min-w-[20px] text-center">
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
                            onPress={() =>
                              updateQuantityInStore(
                                order.storeId,
                                item.product_id,
                                item.quantity + 1
                              )
                            }
                            disabled={item.quantity >= item.stock_quantity}
                          >
                            <Ionicons
                            name="add"
                            size={14}
                            color={
                              item.quantity >= item.stock_quantity ? '#d1d5db' : '#374151'
                            }
                          />
                        </TouchableOpacity>
                      </View>
                      )}
                    </View>
                  ))}

                  {/* Subtotal */}
                  <View className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-row justify-between items-center">
                    <Text className="text-sm font-bold text-gray-700">Subtotal</Text>
                    <Text className="text-base font-bold text-blue-600">
                      {formatCurrency(subtotal)}
                    </Text>
                  </View>
                </>
              )}

              {/* Error */}
              {storeError ? (
                <View className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <Text className="text-red-600 text-xs text-center">{storeError}</Text>
                </View>
              ) : null}

              {/* Action row */}
              {!isSubmitted && (
                <View className="flex-row gap-2 px-4 pb-4">
                  <TouchableOpacity
                    className="flex-1 rounded-lg py-2.5 items-center bg-gray-100"
                    onPress={() =>
                      router.push({
                        pathname: '/(collector)/products',
                        params: { storeId: order.storeId },
                      })
                    }
                    disabled={isLoading}
                  >
                    <Text className="text-gray-700 text-sm font-medium">Browse Products</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-1 rounded-lg py-2.5 items-center ${
                      items.length === 0 || isLoading ? 'bg-green-300' : 'bg-green-500'
                    }`}
                    onPress={() => handleSubmit(order.storeId, order.storeName)}
                    disabled={items.length === 0 || isLoading}
                  >
                    {isLoading ? (
                      <View className="flex-row items-center gap-1.5">
                        <ActivityIndicator size="small" color="#fff" />
                        <Text className="text-white text-sm font-bold">Submitting...</Text>
                      </View>
                    ) : (
                      <Text className="text-white text-sm font-bold">Submit Order</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Submitted History */}
        {submittedHistory.length > 0 && (
          <View className="mt-2">
            {/* Section header */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Submitted Today
              </Text>
              {historyEditMode ? (
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedHistoryIds.size === submittedHistory.length) {
                        setSelectedHistoryIds(new Set());
                      } else {
                        setSelectedHistoryIds(new Set(submittedHistory.map((r) => r.storeId)));
                      }
                    }}
                  >
                    <Text className="text-xs text-blue-700 font-semibold">
                      {selectedHistoryIds.size === submittedHistory.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                  {selectedHistoryIds.size > 0 && (
                    <TouchableOpacity onPress={deleteSelectedHistory}>
                      <View className="bg-red-500 rounded-full px-3 py-1">
                        <Text className="text-white text-xs font-bold">
                          Delete ({selectedHistoryIds.size})
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={exitHistoryEditMode}>
                    <Text className="text-xs text-gray-700 font-medium">Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setHistoryEditMode(true)}>
                  <Ionicons name="create-outline" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {submittedHistory.map((record) => {
              const key = `${record.storeId}-${record.submittedAt.getTime()}`;
              const isExpanded = expandedRecords.has(key);
              const isSelected = selectedHistoryIds.has(record.storeId);
              return (
                <View
                  key={key}
                  className={`bg-white rounded-xl border mb-2 overflow-hidden ${
                    isSelected ? 'border-red-200' : 'border-green-100'
                  }`}
                >
                  {/* Header row */}
                  <TouchableOpacity
                    className="flex-row items-center px-4 py-3"
                    onPress={() => {
                      if (historyEditMode) {
                        toggleHistorySelect(record.storeId);
                      } else {
                        setExpandedRecords((prev) => {
                          const n = new Set(prev);
                          if (n.has(key)) n.delete(key); else n.add(key);
                          return n;
                        });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {historyEditMode ? (
                      <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                        isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    ) : (
                      <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center mr-3">
                        <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-gray-800" numberOfLines={1}>
                        {record.storeName}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {record.itemCount} item{record.itemCount !== 1 ? 's' : ''} · {formatShortDate(record.submittedAt.toISOString())}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-green-600 mr-3">
                      {formatCurrency(record.subtotal)}
                    </Text>
                    {!historyEditMode && (
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#9ca3af"
                      />
                    )}
                  </TouchableOpacity>

                  {/* Expandable details */}
                  {!historyEditMode && isExpanded && (
                    <View className="border-t border-gray-100">
                      {record.items.map((item, index) => (
                        <View
                          key={item.product_id}
                          className={`flex-row items-center px-4 py-2.5 ${
                            index < record.items.length - 1 ? 'border-b border-gray-50' : ''
                          }`}
                        >
                          <View className="flex-1 mr-3">
                            <Text className="text-sm text-gray-800" numberOfLines={1}>
                              {item.product_name}
                            </Text>
                            <Text className="text-xs text-gray-400 mt-0.5">
                              {formatCurrency(item.unit_price)} × {item.quantity}
                            </Text>
                          </View>
                          <Text className="text-sm font-semibold text-gray-700">
                            {formatCurrency(item.line_total)}
                          </Text>
                        </View>
                      ))}
                      <View className="flex-row justify-between items-center px-4 py-2.5 bg-green-50 border-t border-green-100">
                        <Text className="text-sm font-bold text-gray-700">Total</Text>
                        <Text className="text-sm font-bold text-green-600">
                          {formatCurrency(record.subtotal)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Store picker modal (non-empty state) */}
      <StorePickerModal
        visible={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        stores={availableStores}
        loading={storesLoading}
        creatingCustom={creatingStore}
        onSelect={(store) => {
          addStoreOrder(store.id, store.name);
          setShowStoreModal(false);
        }}
        onAddCustom={handleAddCustomStore}
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
  creatingCustom,
}: {
  visible: boolean;
  onClose: () => void;
  stores: Store[];
  loading: boolean;
  onSelect: (store: Store) => void;
  onAddCustom: (name: string) => void;
  creatingCustom?: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');

  const trimmedNew = newName.trim();
  const filtered = query.trim()
    ? stores.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : stores;

  function handleClose() {
    setNewName('');
    setQuery('');
    onClose();
  }

  function handleSelect(store: Store) {
    setNewName('');
    setQuery('');
    onSelect(store);
  }

  function handleAdd() {
    if (!trimmedNew) return;
    onAddCustom(trimmedNew);
    setNewName('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity
        className="flex-1 bg-black/40 justify-end"
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-2xl px-5 pt-5 pb-10">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-base font-bold text-gray-800">Add Store</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Inline: Store Name label + input + Add button */}
            <View className="flex-row items-center gap-2 mb-5">
              <Text className="text-sm font-semibold text-gray-600 shrink-0">Store Name</Text>
              <TextInput
                className="flex-1 bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-800"
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter store name"
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
              <TouchableOpacity
                className={`rounded-lg px-4 py-2.5 items-center justify-center ${
                  !trimmedNew || creatingCustom ? 'bg-blue-300' : 'bg-blue-500'
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
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-xs text-gray-400 font-medium">or select existing</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* Search existing */}
            {loading ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text className="text-gray-400 text-sm mt-2">Loading stores...</Text>
              </View>
            ) : (
              <>
                <TextInput
                  className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-800 mb-3"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search stores..."
                  placeholderTextColor="#9ca3af"
                  clearButtonMode="while-editing"
                />
                {filtered.length > 0 ? (
                  <StoreSelector stores={filtered} selectedId={null} onSelect={handleSelect} />
                ) : (
                  <View className="py-4 items-center">
                    <Text className="text-gray-400 text-sm">No stores found</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
