import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PrintableReceipt } from '@/components/PrintableReceipt';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { format, addDays, subDays, isToday, startOfDay, endOfDay } from 'date-fns';
import {
  ChevronRight,
  ChevronLeft,
  Trash2,
  Search,
  Plus,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  MoreVertical,
  Printer,
  XCircle,
  RefreshCw,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { statusBadge } from '@/lib/constants';
import type { Order } from '@/types';

const statusFilters = ['all', 'pending', 'confirmed', 'processing', 'completed', 'cancelled'] as const;
const CARD_PAGE_SIZE = 12;
const TABLE_PAGE_SIZE = 20;

type ViewMode = 'table' | 'card';

export function OrdersPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [filterOpen, setFilterOpen] = useState(false);
  const [collectorFilter, setCollectorFilter] = useState<string>('all');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const statusBarRef = useRef<HTMLDivElement>(null);

  const { orders, loading, error, refetch } = useRealtimeOrders();

  // Close popovers on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Trigger print when printOrder is set
  useEffect(() => {
    if (printOrder) {
      const timer = setTimeout(() => {
        window.print();
        setPrintOrder(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [printOrder]);

  // --- Derived data ---
  const collectors = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      const name = o.profiles?.nickname || o.profiles?.full_name;
      if (name && o.collector_id) map.set(o.collector_id, name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Date filter
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    result = result.filter((o) => {
      const d = new Date(o.created_at);
      return d >= dayStart && d <= dayEnd;
    });

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter);
    }

    // Collector filter
    if (collectorFilter !== 'all') {
      result = result.filter((o) => o.collector_id === collectorFilter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.stores?.name || '').toLowerCase().includes(q) ||
          (o.profiles?.nickname || o.profiles?.full_name || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, statusFilter, search, selectedDate, collectorFilter]);

  // Counts per status (within current date)
  const statusCounts = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const dayOrders = orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= dayStart && d <= dayEnd;
    });
    const counts: Record<string, number> = { all: dayOrders.length };
    for (const s of statusFilters) {
      if (s !== 'all') counts[s] = dayOrders.filter((o) => o.status === s).length;
    }
    return counts;
  }, [orders, selectedDate]);

  const pageSize = viewMode === 'card' ? CARD_PAGE_SIZE : TABLE_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);
  const startIdx = (safePage - 1) * pageSize;

  function handleStatusChange(status: string) {
    setStatusFilter(status);
    setPage(1);
  }
  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }
  function stepDate(dir: number) {
    setSelectedDate((d) => (dir > 0 ? addDays(d, 1) : subDays(d, 1)));
    setPage(1);
  }
  function goToToday() {
    setSelectedDate(new Date());
    setPage(1);
  }

  async function handleDeleteOrder() {
    if (!deleteTarget) return;
    try {
      const { error: err } = await supabase
        .from('orders')
        .delete()
        .eq('id', deleteTarget.id);
      if (err) throw err;
      toast.success('Order removed');
      refetch();
    } catch {
      toast.error('Failed to remove order');
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleQuickStatusUpdate(order: Order, newStatus: string) {
    setUpdatingStatus(order.id);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (error) throw error;
      toast.success(`Order marked as ${newStatus}`);
      refetch();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(null);
      setActionMenuId(null);
    }
  }

  // Keyboard navigation for status filters
  const handleStatusKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const bar = statusBarRef.current;
      if (!bar) return;
      const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const idx = buttons.indexOf(e.target as HTMLButtonElement);
      if (idx === -1) return;

      let next = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        next = (idx + 1) % buttons.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        next = (idx - 1 + buttons.length) % buttons.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        next = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        next = buttons.length - 1;
      }
      if (next !== idx) {
        buttons[next].focus();
        buttons[next].click();
      }
    },
    []
  );

  // --- Date display ---
  const dateLabel = isToday(selectedDate)
    ? `Today, ${format(selectedDate, 'd MMM yyyy')}`
    : format(selectedDate, 'EEEE, d MMM yyyy');

  const isFuture = startOfDay(addDays(new Date(), 1)) <= startOfDay(selectedDate);
  const activeFilterCount = (collectorFilter !== 'all' ? 1 : 0);

  // Get item summary for card tooltip
  function itemsSummary(order: Order): string {
    if (!order.order_items?.length) return 'No items';
    return order.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ');
  }

  const statusFlow = ['pending', 'confirmed', 'processing', 'completed'];

  function getNextStatus(order: Order): string | null {
    const idx = statusFlow.indexOf(order.status);
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  }

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      {/* Top bar: search + filters + view toggle + new order */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Search with filter icon */}
        <div className="relative flex-1 min-w-[200px] max-w-sm" ref={filterRef}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FAABE]/40" />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-10 py-2 text-xs border border-[#1E3F5E]/60 rounded-lg bg-[#162F4D] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]"
          />
          <button
            onClick={() => setFilterOpen((p) => !p)}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors',
              filterOpen || activeFilterCount > 0
                ? 'text-[#5B9BD5]'
                : 'text-[#8FAABE]/40 hover:text-[#8FAABE]/70'
            )}
            title="Advanced filters"
          >
            <SlidersHorizontal size={14} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#5B9BD5] rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Filter dropdown */}
          {filterOpen && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide mb-2">
                Collector / Cashier
              </p>
              <select
                value={collectorFilter}
                onChange={(e) => {
                  setCollectorFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs bg-[#0D1F33] border border-[#1E3F5E]/60 rounded px-2 py-1.5 text-[#E8EDF2] focus:outline-none focus:ring-1 focus:ring-[#5B9BD5]"
              >
                <option value="all">All collectors</option>
                {collectors.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setCollectorFilter('all');
                    setPage(1);
                  }}
                  className="mt-2 text-[10px] text-[#E06C75] hover:text-[#E06C75]/80 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
          <button
            onClick={() => { setViewMode('table'); setPage(1); }}
            className={cn(
              'p-2 transition-colors',
              viewMode === 'table' ? 'bg-[#5B9BD5] text-white' : 'text-[#8FAABE]/50 hover:text-[#8FAABE]'
            )}
            title="Table view"
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => { setViewMode('card'); setPage(1); }}
            className={cn(
              'p-2 transition-colors',
              viewMode === 'card' ? 'bg-[#5B9BD5] text-white' : 'text-[#8FAABE]/50 hover:text-[#8FAABE]'
            )}
            title="Card view"
          >
            <LayoutGrid size={14} />
          </button>
        </div>

        <button
          onClick={() => navigate('/orders/new')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#5B9BD5] text-white rounded-lg hover:bg-[#4A8BC4] transition-colors"
        >
          <Plus size={13} />
          New Order
        </button>
      </div>

      {/* Date stepper */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => stepDate(-1)}
            className="p-1.5 rounded-md text-[#8FAABE]/60 hover:text-[#E8EDF2] hover:bg-[#1A3755] transition-colors"
            title="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToToday}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              isToday(selectedDate)
                ? 'text-[#E8EDF2] bg-[#162F4D] border border-[#1E3F5E]/60'
                : 'text-[#5B9BD5] bg-[#5B9BD5]/10 border border-[#5B9BD5]/30 hover:bg-[#5B9BD5]/20'
            )}
          >
            {dateLabel}
          </button>
          <button
            onClick={() => stepDate(1)}
            disabled={isFuture}
            className="p-1.5 rounded-md text-[#8FAABE]/60 hover:text-[#E8EDF2] hover:bg-[#1A3755] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <p className="text-[10px] text-[#8FAABE]/50">
          {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Status filter tabs */}
      <div
        ref={statusBarRef}
        role="tablist"
        aria-label="Order status filter"
        className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-2 mb-3 flex gap-1.5 overflow-x-auto flex-wrap"
        onKeyDown={handleStatusKeyDown}
      >
        {statusFilters.map((status) => (
          <button
            key={status}
            role="tab"
            tabIndex={statusFilter === status ? 0 : -1}
            aria-selected={statusFilter === status}
            onClick={() => handleStatusChange(status)}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9BD5]',
              statusFilter === status
                ? 'bg-[#5B9BD5] text-white'
                : 'text-[#E8EDF2]/80 hover:bg-[#1A3755]'
            )}
          >
            <span className="capitalize">{status === 'all' ? 'All' : status}</span>
            <span className={cn('text-[10px] px-1 rounded', statusFilter === status ? 'bg-white/20' : 'bg-[#0D1F33]')}>
              {statusCounts[status] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-xs text-[#E06C75] mb-2">{error}</p>
            <button onClick={refetch} className="text-xs text-[#5B9BD5] hover:text-[#7EB8E0] font-medium">Retry</button>
          </div>
        ) : loading ? (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-1">
                <div className="h-3 bg-[#1A3755] rounded w-24" />
                <div className="h-3 bg-[#1A3755] rounded flex-1" />
                <div className="h-3 bg-[#1A3755] rounded w-16" />
                <div className="h-3 bg-[#1A3755] rounded w-16" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-[#8FAABE]/50">
              {search ? 'No orders match your search' : 'No orders for this date and filter'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* ───── TABLE VIEW ───── */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E3F5E]/60 bg-[#1A3755]/50">
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Order</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide hidden sm:table-cell">Time</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide hidden md:table-cell">Store</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide hidden lg:table-cell">Collector</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide hidden md:table-cell">Items</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-[#8FAABE]/60 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    tabIndex={0}
                    className="border-b border-[#1E3F5E]/30 hover:bg-[#1A3755]/40 cursor-pointer transition-colors focus:outline-none focus-visible:bg-[#1A3755]/60"
                    onClick={() => navigate(`/orders/${order.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/orders/${order.id}`); }}
                  >
                    <td className="px-3 py-2 text-xs text-[#8FAABE]/50 tabular-nums">{startIdx + idx + 1}</td>
                    <td className="px-3 py-2">
                      <p className="text-xs font-mono font-semibold text-[#E8EDF2]">{order.order_number}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#8FAABE]/70 hidden sm:table-cell tabular-nums">
                      {format(new Date(order.created_at), 'HH:mm')}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#8FAABE]/70 hidden md:table-cell">{order.stores?.name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-[#8FAABE]/70 hidden lg:table-cell">
                      {order.profiles?.nickname || order.profiles?.full_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#8FAABE]/70 hidden md:table-cell" title={itemsSummary(order)}>
                      {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium capitalize', statusBadge[order.status])}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-[#E8EDF2] text-right tabular-nums">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(order); }}
                          className="p-1 text-[#8FAABE]/40 hover:text-[#E06C75] transition-colors"
                          title="Delete order"
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="text-[#8FAABE]/30" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ───── CARD VIEW ───── */
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pagedOrders.map((order) => (
              <div
                key={order.id}
                tabIndex={0}
                className="bg-[#0D1F33] border border-[#1E3F5E]/40 rounded-lg p-3 hover:border-[#5B9BD5]/40 transition-colors cursor-pointer relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9BD5]"
                onClick={() => navigate(`/orders/${order.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/orders/${order.id}`); }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-mono font-semibold text-[#E8EDF2]">{order.order_number}</p>
                    <p className="text-[10px] text-[#8FAABE]/50 tabular-nums mt-0.5">
                      {format(new Date(order.created_at), 'HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium capitalize', statusBadge[order.status])}>
                      {order.status}
                    </span>
                    {/* Quick action menu */}
                    <div className="relative" ref={actionMenuId === order.id ? actionMenuRef : undefined}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuId(actionMenuId === order.id ? null : order.id);
                        }}
                        className="p-1 rounded text-[#8FAABE]/40 hover:text-[#E8EDF2] hover:bg-[#1A3755] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Quick actions"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {actionMenuId === order.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-[#1A3755] border border-[#1E3F5E]/60 rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintOrder(order);
                              setActionMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E8EDF2] hover:bg-[#162F4D] transition-colors"
                          >
                            <Printer size={12} />
                            Print Receipt
                          </button>
                          {getNextStatus(order) && order.status !== 'cancelled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusUpdate(order, getNextStatus(order)!);
                              }}
                              disabled={updatingStatus === order.id}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E8EDF2] hover:bg-[#162F4D] transition-colors disabled:opacity-50"
                            >
                              <RefreshCw size={12} className={updatingStatus === order.id ? 'animate-spin' : ''} />
                              Mark {getNextStatus(order)}
                            </button>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'completed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusUpdate(order, 'cancelled');
                              }}
                              disabled={updatingStatus === order.id}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E06C75] hover:bg-[#162F4D] transition-colors disabled:opacity-50"
                            >
                              <XCircle size={12} />
                              Cancel Order
                            </button>
                          )}
                          <div className="border-t border-[#1E3F5E]/40 my-1" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(order);
                              setActionMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E06C75] hover:bg-[#162F4D] transition-colors"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#8FAABE]/60">
                    <span className="truncate">{order.stores?.name || 'No store'}</span>
                    <span>·</span>
                    <span className="truncate">{order.profiles?.nickname || order.profiles?.full_name || 'Unknown'}</span>
                  </div>

                  {/* Items preview */}
                  <div className="flex items-center gap-1.5" title={itemsSummary(order)}>
                    <Package size={11} className="text-[#8FAABE]/40 flex-shrink-0" />
                    <p className="text-[10px] text-[#8FAABE]/50 truncate">
                      {order.order_items?.length
                        ? order.order_items.length <= 3
                          ? order.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')
                          : `${order.order_items.slice(0, 2).map((i) => `${i.quantity}x ${i.product_name}`).join(', ')} +${order.order_items.length - 2} more`
                        : 'No items'}
                    </p>
                  </div>
                </div>

                {/* Card footer */}
                <div className="mt-2 pt-2 border-t border-[#1E3F5E]/30 flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#E8EDF2] tabular-nums">
                    {formatCurrency(order.total_amount)}
                  </p>
                  <ChevronRight size={14} className="text-[#8FAABE]/30" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="px-3 py-2 border-t border-[#1E3F5E]/60 bg-[#1A3755]/50 flex justify-between items-center">
            <p className="text-[10px] text-[#8FAABE]/50 tabular-nums">
              Showing {startIdx + 1}–{Math.min(startIdx + pageSize, filteredOrders.length)} of {filteredOrders.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                {/* Page buttons */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1]) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === 'ellipsis' ? (
                      <span key={`e${i}`} className="text-[10px] text-[#8FAABE]/40 px-1">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={cn(
                          'text-[10px] w-6 h-6 rounded transition-colors',
                          safePage === item
                            ? 'bg-[#5B9BD5] text-white font-medium'
                            : 'text-[#8FAABE]/70 hover:bg-[#162F4D]'
                        )}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  disabled={safePage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Remove Order"
          message={`Remove order ${deleteTarget.order_number} from history? This cannot be undone.`}
          confirmLabel="Remove"
          onConfirm={handleDeleteOrder}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Hidden print receipt */}
      {printOrder && (
        <div className="print-receipt-container hidden">
          <PrintableReceipt order={printOrder} />
        </div>
      )}
    </div>
  );
}
