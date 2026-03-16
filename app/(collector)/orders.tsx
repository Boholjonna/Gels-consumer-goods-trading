import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOrders } from '@/services/orders.service';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Order, OrderFilters } from '@/types';

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-[#E5C07B]/10', text: 'text-[#E5C07B]' },
  confirmed: { bg: 'bg-[#5B9BD5]/10', text: 'text-[#5B9BD5]' },
  processing: { bg: 'bg-[#C678DD]/10', text: 'text-[#C678DD]' },
  completed: { bg: 'bg-[#98C379]/10', text: 'text-[#98C379]' },
  cancelled: { bg: 'bg-[#E06C75]/10', text: 'text-[#E06C75]' },
};

const statusFilterGroups = [
  { label: null, items: [{ key: 'all', label: 'All Orders' }] },
  {
    label: 'Active',
    items: [
      { key: 'pending', label: 'Pending' },
      { key: 'confirmed', label: 'Confirmed' },
      { key: 'processing', label: 'Processing' },
    ],
  },
  {
    label: 'Resolved',
    items: [
      { key: 'completed', label: 'Completed' },
      { key: 'cancelled', label: 'Cancelled' },
    ],
  },
];

const sortOptions: { value: OrderFilters['sort_by']; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
];

const PAGE_SIZE = 20;

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filters & pagination
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<OrderFilters['sort_by']>('newest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchOrders = useCallback(async (silent = false, overrides?: Partial<{ p: number; status: string; sort: OrderFilters['sort_by'] }>) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const currentPage = overrides?.p ?? page;
      const currentStatus = overrides?.status ?? statusFilter;
      const currentSort = overrides?.sort ?? sortBy;
      const filters: OrderFilters = {
        page: currentPage,
        page_size: PAGE_SIZE,
        sort_by: currentSort,
      };
      if (currentStatus !== 'all') filters.status = currentStatus;
      const result = await getOrders(filters);
      setOrders(result.data);
      setTotal(result.total);
    } catch {
      setError('Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, statusFilter, sortBy]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchOrders(true);
    setRefreshing(false);
  }

  function changeStatus(status: string) {
    setStatusFilter(status);
    setShowStatusDropdown(false);
    setPage(1);
    fetchOrders(false, { p: 1, status });
  }

  function changeSort(sort: OrderFilters['sort_by']) {
    setSortBy(sort);
    setShowSortMenu(false);
    setPage(1);
    fetchOrders(false, { p: 1, sort });
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    fetchOrders(false, { p });
  }

  function getStatusStyle(status: string) {
    return statusColors[status] || { bg: 'bg-[#1A3755]', text: 'text-[#8FAABE]' };
  }

  function getStatusLabel(status: string): string {
    if (status === 'all') return 'All Orders';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Client-side search filtering
  const displayOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.stores?.name || '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  if (loading && orders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0D1F33]">
        <ActivityIndicator size="large" color="#5B9BD5" />
      </View>
    );
  }

  if (error && orders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0D1F33] px-4">
        <Ionicons name="cloud-offline-outline" size={48} color="#8FAABE33" />
        <Text className="text-[#8FAABE] mt-3 text-center">{error}</Text>
        <TouchableOpacity
          className="mt-4 bg-[#5B9BD5] rounded-xl px-6 py-3"
          onPress={() => fetchOrders()}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0D1F33]">
      {/* Search bar */}
      <View className="bg-[#162F4D] px-3 pt-3 pb-2 border-b border-[#1E3F5E]/30">
        <View className="flex-row items-center bg-[#1A3755] rounded-lg px-3 py-2.5">
          <Ionicons name="search-outline" size={16} color="#8FAABE" />
          <TextInput
            className="flex-1 ml-2 text-sm text-[#E8EDF2]"
            value={search}
            onChangeText={setSearch}
            placeholder="Search orders..."
            placeholderTextColor="#8FAABE66"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#8FAABE" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status filter dropdown + Sort */}
      <View className="flex-row items-center justify-between px-3 py-2.5 bg-[#162F4D] border-b border-[#1E3F5E]/30">
        {/* Status dropdown trigger */}
        <View className="relative">
          <TouchableOpacity
            className="flex-row items-center gap-1.5 px-3 py-2 bg-[#1A3755] rounded-lg"
            onPress={() => { setShowStatusDropdown(!showStatusDropdown); setShowSortMenu(false); }}
          >
            {statusFilter !== 'all' && (
              <View className={`w-2 h-2 rounded-full ${getStatusStyle(statusFilter).bg.replace('/10', '')}`} />
            )}
            <Text className="text-xs font-medium text-[#E8EDF2]">
              {getStatusLabel(statusFilter)}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#8FAABE" />
          </TouchableOpacity>

          {showStatusDropdown && (
            <View
              className="absolute left-0 top-10 bg-[#162F4D] rounded-xl border border-[#1E3F5E]/60 shadow-lg z-50 w-44 overflow-hidden"
              style={{ elevation: 8 }}
            >
              {statusFilterGroups.map((group, gi) => (
                <View key={gi}>
                  {group.label && (
                    <View className="px-3 pt-2.5 pb-1">
                      <Text className="text-[9px] font-bold text-[#8FAABE]/40 uppercase tracking-wider">
                        {group.label}
                      </Text>
                    </View>
                  )}
                  {group.items.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      className={`px-3 py-2.5 flex-row items-center justify-between ${
                        statusFilter === item.key ? 'bg-[#5B9BD5]/10' : ''
                      }`}
                      onPress={() => changeStatus(item.key)}
                    >
                      <View className="flex-row items-center gap-2">
                        {item.key !== 'all' && (
                          <View className={`w-2 h-2 rounded-full ${(statusColors[item.key]?.bg || 'bg-[#1A3755]').replace('/10', '')}`} />
                        )}
                        <Text className={`text-xs ${statusFilter === item.key ? 'text-[#5B9BD5] font-semibold' : 'text-[#E8EDF2]'}`}>
                          {item.label}
                        </Text>
                      </View>
                      {statusFilter === item.key && (
                        <Ionicons name="checkmark" size={14} color="#5B9BD5" />
                      )}
                    </TouchableOpacity>
                  ))}
                  {gi < statusFilterGroups.length - 1 && (
                    <View className="h-px bg-[#1E3F5E]/30 mx-2" />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Sort + count */}
        <View className="flex-row items-center gap-3">
          <Text className="text-[10px] text-[#8FAABE]/50">
            {total} order{total !== 1 ? 's' : ''}
          </Text>
          <View className="relative">
            <TouchableOpacity
              className="flex-row items-center gap-1 px-2.5 py-2 bg-[#1A3755] rounded-lg"
              onPress={() => { setShowSortMenu(!showSortMenu); setShowStatusDropdown(false); }}
            >
              <Ionicons name="swap-vertical-outline" size={14} color="#8FAABE" />
              <Text className="text-xs font-medium text-[#E8EDF2]">
                {sortOptions.find((s) => s.value === sortBy)?.label}
              </Text>
            </TouchableOpacity>
            {showSortMenu && (
              <View
                className="absolute right-0 top-10 bg-[#162F4D] rounded-xl border border-[#1E3F5E]/60 shadow-lg z-50 w-36 overflow-hidden"
                style={{ elevation: 8 }}
              >
                {sortOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    className={`px-4 py-2.5 border-b border-[#1E3F5E]/30 ${
                      sortBy === opt.value ? 'bg-[#5B9BD5]/10' : ''
                    }`}
                    onPress={() => changeSort(opt.value)}
                  >
                    <Text
                      className={`text-sm ${
                        sortBy === opt.value ? 'text-[#5B9BD5] font-semibold' : 'text-[#E8EDF2]'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Order list */}
      {displayOrders.length === 0 && !loading ? (
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="receipt-outline" size={48} color="#8FAABE33" />
          <Text className="text-[#8FAABE] mt-3 text-center">
            {search ? 'No orders match your search' : 'No orders found'}
          </Text>
          <Text className="text-[#8FAABE]/50 text-sm mt-1 text-center">
            {search ? 'Try adjusting your search' : 'Your order history will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5B9BD5" colors={['#5B9BD5']} />
          }
          ListFooterComponent={() =>
            totalPages > 1 ? (
              <View className="flex-row items-center justify-between bg-[#162F4D] mx-0 mt-2 px-4 py-3 rounded-xl border border-[#1E3F5E]/60">
                <TouchableOpacity
                  onPress={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className={page === 1 ? 'opacity-30' : 'opacity-100'}
                >
                  <Text className="text-sm font-medium text-[#5B9BD5]">← Prev</Text>
                </TouchableOpacity>
                <View className="items-center">
                  <Text className="text-sm font-medium text-[#E8EDF2]">
                    Page {page} of {totalPages}
                  </Text>
                  <Text className="text-xs text-[#8FAABE]/50">{total} total</Text>
                </View>
                <TouchableOpacity
                  onPress={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className={page >= totalPages ? 'opacity-30' : 'opacity-100'}
                >
                  <Text className="text-sm font-medium text-[#5B9BD5]">Next →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const style = getStatusStyle(item.status);
            const itemCount = item.order_items?.length || 0;

            return (
              <TouchableOpacity
                className="bg-[#162F4D] rounded-xl p-4 mb-2.5 border border-[#1E3F5E]/60"
                onPress={() => setSelectedOrder(item)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-bold text-[#E8EDF2]">
                    {item.order_number}
                  </Text>
                  <View className={`px-2.5 py-1 rounded-full ${style.bg}`}>
                    <Text className={`text-xs font-medium capitalize ${style.text}`}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                {item.stores?.name && (
                  <View className="flex-row items-center gap-1.5 mb-1.5">
                    <Ionicons name="storefront-outline" size={12} color="#8FAABE" />
                    <Text className="text-xs text-[#8FAABE]">{item.stores.name}</Text>
                  </View>
                )}
                {/* Items preview */}
                {item.order_items && item.order_items.length > 0 && (
                  <View className="mb-2">
                    {item.order_items.slice(0, 2).map((oi) => (
                      <Text key={oi.id} className="text-xs text-[#8FAABE]/50" numberOfLines={1}>
                        {oi.quantity}x {oi.product_name}
                      </Text>
                    ))}
                    {item.order_items.length > 2 && (
                      <Text className="text-xs text-[#8FAABE]/50">
                        +{item.order_items.length - 2} more
                      </Text>
                    )}
                  </View>
                )}
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs text-[#8FAABE]/50">
                      {formatDate(item.created_at)}
                    </Text>
                    <Text className="text-xs text-[#8FAABE]/50 mt-0.5">
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text className="text-base font-bold text-[#5B9BD5]">
                    {formatCurrency(item.total_amount)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Loading overlay for page changes */}
      {loading && orders.length > 0 && (
        <View className="absolute inset-0 bg-[#0D1F33]/60 items-center justify-center">
          <ActivityIndicator size="large" color="#5B9BD5" />
        </View>
      )}

      {/* Order Detail Modal - Full Viewport */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View className="flex-1 bg-[#0D1F33]" style={{ paddingTop: insets.top }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#1E3F5E]/60">
            <TouchableOpacity onPress={() => setSelectedOrder(null)} className="p-1">
              <Ionicons name="close" size={24} color="#E8EDF2" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-[#E8EDF2]">
              {selectedOrder?.order_number || 'Order Details'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {selectedOrder && (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Status badge */}
              <View className="items-center mb-6">
                <View className={`px-4 py-1.5 rounded-full ${getStatusStyle(selectedOrder.status).bg}`}>
                  <Text className={`text-sm font-semibold capitalize ${getStatusStyle(selectedOrder.status).text}`}>
                    {selectedOrder.status}
                  </Text>
                </View>
              </View>

              {/* Meta */}
              <View className="bg-[#162F4D] rounded-xl p-4 mb-4 border border-[#1E3F5E]/60">
                <View className="flex-row items-center gap-2 mb-2">
                  <Ionicons name="calendar-outline" size={14} color="#8FAABE" />
                  <Text className="text-sm text-[#8FAABE]">
                    {formatDate(selectedOrder.created_at)}
                  </Text>
                </View>
                {selectedOrder.stores?.name && (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="storefront-outline" size={14} color="#8FAABE" />
                    <Text className="text-sm text-[#8FAABE]">
                      {selectedOrder.stores.name}
                    </Text>
                  </View>
                )}
              </View>

              {/* Items */}
              <View className="mb-4">
                <Text className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider mb-3">
                  Items ({selectedOrder.order_items?.length || 0})
                </Text>
                <View className="bg-[#162F4D] rounded-xl border border-[#1E3F5E]/60 overflow-hidden">
                  {selectedOrder.order_items?.map((item, index) => (
                    <View
                      key={item.id}
                      className={`flex-row items-center justify-between px-4 py-3 ${
                        index < (selectedOrder.order_items?.length || 0) - 1 ? 'border-b border-[#1E3F5E]/30' : ''
                      }`}
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-sm text-[#E8EDF2]">{item.product_name}</Text>
                        <Text className="text-xs text-[#8FAABE]/50">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </Text>
                      </View>
                      <Text className="text-sm font-semibold text-[#E8EDF2]">
                        {formatCurrency(item.line_total)}
                      </Text>
                    </View>
                  ))}
                  {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && (
                    <Text className="text-xs text-[#8FAABE]/50 py-4 text-center">No items recorded</Text>
                  )}
                </View>
              </View>

              {/* Summary */}
              <View className="bg-[#5B9BD5]/10 rounded-xl p-4 mb-4 border border-[#5B9BD5]/20">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-sm text-[#8FAABE]">Subtotal</Text>
                  <Text className="text-sm text-[#E8EDF2]">
                    {formatCurrency(selectedOrder.subtotal)}
                  </Text>
                </View>
                {selectedOrder.tax_amount > 0 && (
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-sm text-[#8FAABE]">Tax</Text>
                    <Text className="text-sm text-[#E8EDF2]">
                      {formatCurrency(selectedOrder.tax_amount)}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center justify-between pt-2 border-t border-[#5B9BD5]/20">
                  <Text className="text-base font-bold text-[#E8EDF2]">Total</Text>
                  <Text className="text-lg font-bold text-[#5B9BD5]">
                    {formatCurrency(selectedOrder.total_amount)}
                  </Text>
                </View>
              </View>

              {selectedOrder.notes && (
                <View className="mb-4 bg-[#162F4D] rounded-xl p-4 border border-[#1E3F5E]/60">
                  <Text className="text-[10px] font-bold text-[#8FAABE]/50 uppercase tracking-wider mb-2">Notes</Text>
                  <Text className="text-sm text-[#8FAABE]">{selectedOrder.notes}</Text>
                </View>
              )}

              {/* Close button */}
              <TouchableOpacity
                className="bg-[#1A3755] rounded-xl py-4 items-center"
                onPress={() => setSelectedOrder(null)}
              >
                <Text className="text-[#8FAABE] font-semibold">Close</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
