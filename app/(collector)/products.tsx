import React, { useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Text, TextInput } from '@/components/ScaledText';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/lib/cart';
import { useNotifications } from '@/hooks/useNotifications';
import { formatCurrency, formatShortDate } from '@/lib/formatters';
import type { Product } from '@/types';

export default function ProductsScreen() {
  const {
    products,
    loading,
    error,
    search,
    setSearch,
    page,
    totalPages,
    total,
    nextPage,
    prevPage,
    refreshing,
    refresh,
  } = useProducts();
  const { addItem, updateQuantity, draftItems, getDraftItemCount, getDraftSubtotal, savedOrders } = useCart();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const draftCount = getDraftItemCount();
  const draftTotal = getDraftSubtotal();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 3 : width >= 768 ? 2 : 1;

  // Quantity modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartons, setCartons] = useState(0);

  function getCartQuantity(productId: string): number {
    const item = draftItems.find((i) => i.product_id === productId);
    return item?.quantity || 0;
  }

  function openQuantityModal(product: Product) {
    if (product.stock_quantity <= 0) return;
    const currentInCart = getCartQuantity(product.id);
    setSelectedProduct(product);
    setQuantity(currentInCart > 0 ? currentInCart : 1);
    setCartons(0);
  }

  function closeModal() {
    setSelectedProduct(null);
    setQuantity(1);
    setCartons(0);
  }

  function handleAddToOrder() {
    if (!selectedProduct) return;
    // Calculate total pieces: quantity (pieces) + cartons * carton_size
    const cartonPieces = cartons * (selectedProduct.carton_size || 0);
    const totalQuantity = quantity + cartonPieces;
    if (totalQuantity <= 0) return;

    const currentInCart = getCartQuantity(selectedProduct.id);
    if (currentInCart > 0) {
      updateQuantity(selectedProduct.id, totalQuantity);
    } else {
      addItem(
        {
          id: selectedProduct.id,
          name: selectedProduct.name,
          price: selectedProduct.price,
          stock_quantity: selectedProduct.stock_quantity,
        },
        totalQuantity
      );
    }
    closeModal();
  }

  const today = formatShortDate(new Date().toISOString());

  return (
    <View className="flex-1 bg-[#0D1F33]">
      {/* Custom Header */}
      <View
        className="bg-[#162F4D] border-b border-[#1E3F5E]/60 px-4 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3 flex-row items-center gap-2">
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 28, height: 28, borderRadius: 6 }}
              resizeMode="contain"
            />
            <Text className="text-base font-bold text-[#E8EDF2]" numberOfLines={1}>
              POS App
            </Text>
            <Text className="text-xs text-[#8FAABE]/50">{today}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              className="relative"
              onPress={() => router.push('/(collector)/cart')}
            >
              <Ionicons name="cart-outline" size={22} color="#E8EDF2" />
              {savedOrders.length > 0 && (
                <View className="absolute -top-2 -right-2 bg-[#5B9BD5] rounded-full min-w-[16px] h-[16px] items-center justify-center">
                  <Text className="text-white text-[9px] font-bold">
                    {savedOrders.length > 99 ? '99+' : savedOrders.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="relative"
              onPress={() => router.push('/(collector)/notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color="#E8EDF2" />
              {unreadCount > 0 && (
                <View className="absolute -top-2 -right-2 bg-[#E06C75] rounded-full min-w-[16px] h-[16px] items-center justify-center">
                  <Text className="text-white text-[9px] font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(collector)/orders')}>
              <Ionicons name="receipt-outline" size={22} color="#E8EDF2" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(collector)/settings')}>
              <Ionicons name="person-circle-outline" size={24} color="#8FAABE" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sticky Search Bar */}
      <View className="bg-[#162F4D] px-4 pt-3 pb-2 border-b border-[#1E3F5E]/30">
        <View className="flex-row items-center bg-[#1A3755] rounded-lg px-3 py-2.5">
          <Ionicons name="search-outline" size={18} color="#8FAABE" />
          <TextInput
            className="flex-1 ml-2 text-base text-[#E8EDF2]"
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
            placeholderTextColor="#8FAABE66"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#8FAABE" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Product Feed */}
      {error ? (
        <View className="px-4 pt-6">
          <Text className="text-[#E06C75] text-center">{error}</Text>
        </View>
      ) : loading && products.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[#8FAABE]/50">Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="cube-outline" size={48} color="#8FAABE33" />
          <Text className="text-[#8FAABE] mt-3 text-center">No products found</Text>
          <Text className="text-[#8FAABE]/50 text-sm mt-1 text-center">
            Try adjusting your search
          </Text>
        </View>
      ) : (
        <FlatList
          key={`products-${numColumns}`}
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + (draftCount > 0 ? 80 : 24) }}
          columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#5B9BD5" colors={['#5B9BD5']} />
          }
          ListFooterComponent={() =>
            totalPages > 1 ? (
              <View className="flex-row items-center justify-between bg-[#162F4D] mx-3 mb-4 px-4 py-3 rounded-xl border border-[#1E3F5E]/60">
                <TouchableOpacity
                  onPress={prevPage}
                  disabled={page === 1}
                  className={page === 1 ? 'opacity-30' : 'opacity-100'}
                >
                  <Text className="text-sm font-medium text-[#5B9BD5]">← Prev</Text>
                </TouchableOpacity>
                <View className="items-center">
                  <Text className="text-sm font-medium text-[#E8EDF2]">
                    Page {page} of {totalPages}
                  </Text>
                  <Text className="text-xs text-[#8FAABE]/50">{total} products</Text>
                </View>
                <TouchableOpacity
                  onPress={nextPage}
                  disabled={page >= totalPages}
                  className={page >= totalPages ? 'opacity-30' : 'opacity-100'}
                >
                  <Text className="text-sm font-medium text-[#5B9BD5]">Next →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isOutOfStock = item.stock_quantity <= 0;
            const isLowStock = item.stock_quantity > 0 && item.stock_quantity <= 30;
            const inCart = getCartQuantity(item.id);

            return (
              <View style={numColumns > 1 ? { flex: 1 } : undefined}>
                <TouchableOpacity
                  className={`bg-[#162F4D] rounded-xl mb-2.5 border overflow-hidden ${
                    isOutOfStock ? 'border-[#1E3F5E]/30 opacity-50' : inCart > 0 ? 'border-[#5B9BD5]/60' : 'border-[#1E3F5E]/60'
                  }`}
                  onPress={() => openQuantityModal(item)}
                  disabled={isOutOfStock}
                  activeOpacity={0.7}
                >
                  <View className="flex-row">
                    <View className={`w-1 ${inCart > 0 ? 'bg-[#5B9BD5]' : isOutOfStock ? 'bg-[#E06C75]' : isLowStock ? 'bg-[#E5C07B]' : 'bg-[#98C379]'}`} />
                    <View className="flex-1 px-3 py-3">
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 mr-2">
                          <Text className="text-sm font-bold text-[#E8EDF2]" numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text className="text-base font-extrabold text-[#5B9BD5] mt-1">
                            {formatCurrency(item.price)}
                          </Text>
                        </View>
                        <View className="items-end self-center">
                          {inCart > 0 ? (
                            <View className="bg-[#5B9BD5] rounded-full w-10 h-10 items-center justify-center">
                              <Text className="text-white text-sm font-bold">{inCart}</Text>
                            </View>
                          ) : (
                            <View className={`rounded-full w-10 h-10 items-center justify-center ${isOutOfStock ? 'bg-[#1A3755]' : 'bg-[#5B9BD5]/10'}`}>
                              <Ionicons name="add" size={22} color={isOutOfStock ? '#8FAABE' : '#5B9BD5'} />
                            </View>
                          )}
                        </View>
                      </View>
                      <View className="flex-row items-center mt-1.5 gap-2">
                        {isOutOfStock ? (
                          <View className="bg-[#E06C75]/10 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-[#E06C75] font-semibold">Out of stock</Text>
                          </View>
                        ) : isLowStock ? (
                          <View className="bg-[#E5C07B]/10 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-[#E5C07B] font-semibold">Only {item.stock_quantity} left</Text>
                          </View>
                        ) : (
                          <View className="bg-[#98C379]/10 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-[#98C379] font-semibold">{item.stock_quantity} in stock</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Floating Cart Button */}
      {draftCount > 0 && (
        <TouchableOpacity
          className="absolute left-4 right-4 bg-[#5B9BD5] rounded-2xl px-5 py-4 flex-row items-center justify-between shadow-lg"
          style={{ bottom: insets.bottom + 16, elevation: 10 }}
          onPress={() => router.push('/(collector)/cart')}
          activeOpacity={0.9}
        >
          <View className="flex-row items-center gap-3">
            <View className="bg-white/10 rounded-full w-8 h-8 items-center justify-center">
              <Ionicons name="bag-handle" size={18} color="#fff" />
            </View>
            <View>
              <Text className="text-white text-sm font-bold">
                {draftCount} item{draftCount !== 1 ? 's' : ''}
              </Text>
              <Text className="text-white/70 text-xs">Tap to checkout</Text>
            </View>
          </View>
          <Text className="text-white text-lg font-extrabold">
            {formatCurrency(draftTotal)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Quantity Modal - Full Viewport */}
      <Modal
        visible={!!selectedProduct}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View className="flex-1 bg-[#0D1F33]" style={{ paddingTop: insets.top }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#1E3F5E]/60">
            <TouchableOpacity onPress={closeModal} className="p-1">
              <Ionicons name="close" size={24} color="#E8EDF2" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-[#E8EDF2]">Add to Order</Text>
            <View style={{ width: 32 }} />
          </View>

          {selectedProduct && (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Product info */}
              <View className="mb-8">
                <Text className="text-xl font-bold text-[#E8EDF2] mb-1" numberOfLines={2}>
                  {selectedProduct.name}
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-2xl font-extrabold text-[#5B9BD5]">
                    {formatCurrency(selectedProduct.price)}
                  </Text>
                  <View className={`rounded-full px-3 py-1 ${
                    selectedProduct.stock_quantity <= 30 ? 'bg-[#E5C07B]/10' : 'bg-[#98C379]/10'
                  }`}>
                    <Text className={`text-xs font-semibold ${
                      selectedProduct.stock_quantity <= 30 ? 'text-[#E5C07B]' : 'text-[#98C379]'
                    }`}>
                      {selectedProduct.stock_quantity} available
                    </Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View className="h-px bg-[#1E3F5E]/30 mb-6" />

              {/* Quantity label + controls */}
              <Text className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider mb-3">
                Quantity
              </Text>
              <View className="flex-row items-center justify-between bg-[#1A3755] rounded-2xl px-4 py-3 mb-6">
                <TouchableOpacity
                  className="w-12 h-12 rounded-xl bg-[#162F4D] border border-[#1E3F5E]/60 items-center justify-center"
                  onPress={() => setQuantity((q) => Math.max(0, q - 1))}
                >
                  <Ionicons name="remove" size={22} color="#E8EDF2" />
                </TouchableOpacity>

                <TextInput
                  className="text-3xl font-bold text-center text-[#E8EDF2]"
                  style={{ minWidth: 72 }}
                  value={quantity.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 0) {
                      setQuantity(Math.min(num, selectedProduct.stock_quantity));
                    } else if (text === '') {
                      setQuantity(0);
                    }
                  }}
                  keyboardType="number-pad"
                  keyboardAppearance="dark"
                  selectTextOnFocus
                />

                <TouchableOpacity
                  className="w-12 h-12 rounded-xl bg-[#5B9BD5] items-center justify-center"
                  onPress={() =>
                    setQuantity((q) => Math.min(q + 1, selectedProduct.stock_quantity))
                  }
                  disabled={quantity >= selectedProduct.stock_quantity}
                  activeOpacity={1}
                >
                  <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Carton section - only show if product has carton_size */}
              {selectedProduct.carton_size && selectedProduct.carton_size > 0 && (
                <>
                  <Text className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider mb-3">
                    Carton
                  </Text>
                  <View className="flex-row items-center justify-between bg-[#1A3755] rounded-2xl px-4 py-3 mb-2">
                    <TouchableOpacity
                      className="w-12 h-12 rounded-xl bg-[#162F4D] border border-[#1E3F5E]/60 items-center justify-center"
                      onPress={() => setCartons((c) => Math.max(0, c - 1))}
                    >
                      <Ionicons name="remove" size={22} color="#E8EDF2" />
                    </TouchableOpacity>

                    <TextInput
                      className="text-3xl font-bold text-center text-[#E8EDF2]"
                      style={{ minWidth: 72 }}
                      value={cartons.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        if (!isNaN(num) && num >= 0) {
                          setCartons(num);
                        } else if (text === '') {
                          setCartons(0);
                        }
                      }}
                      keyboardType="number-pad"
                      keyboardAppearance="dark"
                      selectTextOnFocus
                    />

                    <TouchableOpacity
                      className="w-12 h-12 rounded-xl bg-[#5B9BD5] items-center justify-center"
                      onPress={() => setCartons((c) => c + 1)}
                      activeOpacity={1}
                    >
                      <Ionicons name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-xs text-[#8FAABE] mb-6">
                    1 carton = {selectedProduct.carton_size} pcs
                  </Text>
                </>
              )}

              {/* Subtotal row */}
              <View className="flex-row items-center justify-between bg-[#5B9BD5]/10 rounded-xl px-4 py-3 mb-6">
                <Text className="text-sm text-[#5B9BD5] font-medium">Subtotal</Text>
                <View className="items-end">
                  <Text className="text-lg font-extrabold text-[#5B9BD5]">
                    {formatCurrency(
                      selectedProduct.price * quantity +
                      selectedProduct.price * cartons * (selectedProduct.carton_size || 0)
                    )}
                  </Text>
                  {cartons > 0 && selectedProduct.carton_size && (
                    <Text className="text-xs text-[#8FAABE]">
                      {quantity} pcs + {cartons} ctn ({cartons * selectedProduct.carton_size} pcs)
                    </Text>
                  )}
                </View>
              </View>

              {/* Add to Order button */}
              <TouchableOpacity
                className={`rounded-xl py-4 flex-row items-center justify-center ${
                  (quantity > 0 || cartons > 0) ? 'bg-[#5B9BD5]' : 'bg-[#1A3755]'
                }`}
                onPress={handleAddToOrder}
                disabled={quantity <= 0 && cartons <= 0}
              >
                <Text className={`font-bold text-sm text-center ${(quantity > 0 || cartons > 0) ? 'text-white' : 'text-[#8FAABE]/50'}`}>
                  {getCartQuantity(selectedProduct.id) > 0 ? 'Update Order' : 'Add to Order'}
                </Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                className="mt-3 py-4 items-center bg-[#1A3755] rounded-xl"
                onPress={closeModal}
              >
                <Text className="text-[#8FAABE] font-medium text-sm">Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
