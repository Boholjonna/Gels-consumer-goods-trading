import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/lib/cart';
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
  const { addItem, updateQuantity, items, getItemCount } = useCart();
  const cartCount = getItemCount();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 3 : width >= 768 ? 2 : 1;

  // Quantity modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  function getCartQuantity(productId: string): number {
    const item = items.find((i) => i.product_id === productId);
    return item?.quantity || 0;
  }

  function openQuantityModal(product: Product) {
    if (product.stock_quantity <= 0) return;
    const currentInCart = getCartQuantity(product.id);
    setSelectedProduct(product);
    setQuantity(currentInCart > 0 ? currentInCart : 1);
  }

  function closeModal() {
    setSelectedProduct(null);
    setQuantity(1);
  }

  function handleAddToOrder() {
    if (!selectedProduct || quantity <= 0) return;
    const currentInCart = getCartQuantity(selectedProduct.id);
    if (currentInCart > 0) {
      // Update existing cart item quantity
      updateQuantity(selectedProduct.id, quantity);
    } else {
      // Add new item
      addItem(
        {
          id: selectedProduct.id,
          name: selectedProduct.name,
          price: selectedProduct.price,
          stock_quantity: selectedProduct.stock_quantity,
        },
        quantity
      );
    }
    closeModal();
  }

  const today = formatShortDate(new Date().toISOString());

  return (
    <View className="flex-1 bg-gray-50">
      {/* Custom Header */}
      <View
        className="bg-white border-b border-gray-200 px-4 pb-3"
        style={{ paddingTop: Platform.OS === 'ios' ? 54 : 40 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-bold text-gray-800" numberOfLines={1}>
              POS App
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">{today}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            {/* Order History button */}
            <TouchableOpacity
              onPress={() => router.push('/(collector)/orders')}
            >
              <Ionicons name="receipt-outline" size={22} color="#374151" />
            </TouchableOpacity>
            {/* Cart button */}
            <TouchableOpacity
              className="relative"
              onPress={() => router.push('/(collector)/cart')}
            >
              <Ionicons name="bag-outline" size={24} color="#374151" />
              {cartCount > 0 && (
                <View className="absolute -top-2 -right-2 bg-blue-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
                  <Text className="text-white text-[10px] font-bold">{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Profile button */}
            <TouchableOpacity onPress={() => router.push('/(collector)/settings')}>
              <Ionicons name="person-circle-outline" size={24} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sticky Search Bar */}
      <View className="bg-white px-4 pt-3 pb-2 border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2.5">
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-800"
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Product Feed */}
      {error ? (
        <View className="px-4 pt-6">
          <Text className="text-red-500 text-center">{error}</Text>
        </View>
      ) : loading && products.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="cube-outline" size={48} color="#d1d5db" />
          <Text className="text-gray-500 mt-3 text-center">No products found</Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Try adjusting your search
          </Text>
        </View>
      ) : (
        <FlatList
          key={`products-${numColumns}`}
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          ListFooterComponent={() =>
            totalPages > 1 ? (
              <View className="flex-row items-center justify-between bg-white mx-3 mb-4 px-4 py-3 rounded-xl border border-gray-100">
                <TouchableOpacity
                  onPress={prevPage}
                  disabled={page === 1}
                  className={page === 1 ? 'opacity-30' : 'opacity-100'}
                >
                  <Text className="text-sm font-medium text-blue-500">← Prev</Text>
                </TouchableOpacity>
                <View className="items-center">
                  <Text className="text-sm font-medium text-gray-700">
                    Page {page} of {totalPages}
                  </Text>
                  <Text className="text-xs text-gray-400">{total} products</Text>
                </View>
                <TouchableOpacity
                  onPress={nextPage}
                  disabled={page >= totalPages}
                  className={page >= totalPages ? 'opacity-30' : 'opacity-100'}
                >
                  <Text className="text-sm font-medium text-blue-500">Next →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isOutOfStock = item.stock_quantity <= 0;
            const isLowStock = item.stock_quantity > 0 && item.stock_quantity < 10;
            const inCart = getCartQuantity(item.id);

            return (
              <View style={numColumns > 1 ? { flex: 1 } : undefined}>
                <TouchableOpacity
                  className={`bg-white rounded-xl p-3 mb-2.5 border ${
                    isOutOfStock ? 'border-gray-200 opacity-50' : 'border-gray-100'
                  }`}
                  onPress={() => openQuantityModal(item)}
                  disabled={isOutOfStock}
                  activeOpacity={0.7}
                >
                  <View className="flex-row">
                    {/* Product Info */}
                    <View className="flex-1 justify-center">
                      <Text
                        className="text-base font-semibold text-gray-800"
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text className="text-lg font-bold text-blue-600 mt-0.5">
                        {formatCurrency(item.price)}
                      </Text>
                      <View className="flex-row items-center mt-0.5">
                        {isOutOfStock ? (
                          <Text className="text-xs text-red-500 font-medium">Out of stock</Text>
                        ) : isLowStock ? (
                          <Text className="text-xs text-orange-500 font-medium">
                            {item.stock_quantity} left
                          </Text>
                        ) : (
                          <Text className="text-xs text-green-600">
                            {item.stock_quantity} in stock
                          </Text>
                        )}
                        {inCart > 0 && (
                          <View className="ml-2 bg-blue-100 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-blue-600 font-bold">
                              {inCart} in cart
                            </Text>
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

      {/* Quantity Modal */}
      <Modal
        visible={!!selectedProduct}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          className="flex-1 bg-black/40 justify-end"
          activeOpacity={1}
          onPress={closeModal}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View className="bg-white rounded-t-2xl px-6 pt-6 pb-10">
              {selectedProduct && (
                <>
                  {/* Product info */}
                  <View className="flex-row items-center mb-6">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-800">
                        {selectedProduct.name}
                      </Text>
                      <Text className="text-xl font-bold text-blue-600 mt-1">
                        {formatCurrency(selectedProduct.price)}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {selectedProduct.stock_quantity} available
                      </Text>
                    </View>
                  </View>

                  {/* Quantity controls */}
                  <View className="flex-row items-center justify-center mb-6">
                    <TouchableOpacity
                      className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center"
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                      <Ionicons name="remove" size={28} color="#374151" />
                    </TouchableOpacity>

                    <TextInput
                      className="mx-6 text-3xl font-bold text-center text-gray-800"
                      style={{ minWidth: 80 }}
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
                      selectTextOnFocus
                    />

                    <TouchableOpacity
                      className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center"
                      onPress={() =>
                        setQuantity((q) => Math.min(q + 1, selectedProduct.stock_quantity))
                      }
                    >
                      <Ionicons name="add" size={28} color="#374151" />
                    </TouchableOpacity>
                  </View>

                  {/* Subtotal */}
                  <Text className="text-center text-gray-500 mb-4">
                    Subtotal:{' '}
                    <Text className="font-bold text-gray-800">
                      {formatCurrency(selectedProduct.price * quantity)}
                    </Text>
                  </Text>

                  {/* Add to Order button */}
                  <TouchableOpacity
                    className={`rounded-xl py-4 items-center ${
                      quantity > 0 ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    onPress={handleAddToOrder}
                    disabled={quantity <= 0}
                  >
                    <Text className="text-white font-bold text-base">Add to Order</Text>
                  </TouchableOpacity>

                  {/* Cancel */}
                  <TouchableOpacity className="mt-3 py-3 items-center" onPress={closeModal}>
                    <Text className="text-gray-500 font-medium">Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
