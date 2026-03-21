import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Package, ChevronUp, ChevronDown, ChevronRight, CheckSquare, Square, MinusSquare, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

type StatusTab = 'all' | 'active' | 'inactive';
type StockFilter = 'all' | 'in_stock' | 'low' | 'out';
type SortField = 'name' | 'price' | 'stock_quantity' | 'created_at';
type SortDir = 'asc' | 'desc';

const statusTabs: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const stockOptions: { key: StockFilter; label: string }[] = [
  { key: 'all', label: 'All stock' },
  { key: 'in_stock', label: 'In stock' },
  { key: 'low', label: 'Low (1-30)' },
  { key: 'out', label: 'Out of stock' },
];

function StockBadge({ qty }: { qty: number }) {
  const cls =
    qty <= 0
      ? 'bg-[#E06C75]/10 text-[#E06C75]'
      : qty <= 30
      ? 'bg-[#E5C07B]/10 text-[#E5C07B]'
      : 'bg-[#98C379]/10 text-[#98C379]';
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums', cls)}>
      {qty}
    </span>
  );
}

function CartonBadge({ qty, cartonSize }: { qty: number; cartonSize?: number | null }) {
  if (!cartonSize || cartonSize <= 0) {
    return <span className="text-[10px] text-[#8FAABE]/40">—</span>;
  }
  const cartons = Math.floor(qty / cartonSize);
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums bg-[#5B9BD5]/10 text-[#5B9BD5]">
      {cartons}
    </span>
  );
}

export function ProductsPage() {
  const {
    products,
    total,
    totalPages,
    loading,
    error,
    deleteProduct,
    deleteProducts,
    fetchProducts,
  } = useProducts();

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchProducts({
      page,
      search: search || undefined,
      isActive: statusTab === 'all' ? undefined : statusTab === 'active',
      sortField,
      sortDir,
      stockFilter,
    });
  }, [page, search, statusTab, stockFilter, sortField, sortDir, fetchProducts]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusTab(tab: StatusTab) {
    setStatusTab(tab);
    setPage(1);
  }

  function handleStockFilter(filter: StockFilter) {
    setStockFilter(filter);
    setPage(1);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  }

  function SortIcon({ column }: { column: SortField }) {
    if (sortField !== column) return <ChevronDown size={12} className="text-[#8FAABE]/30 ml-0.5 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-[#5B9BD5] ml-0.5 inline" />
      : <ChevronDown size={12} className="text-[#5B9BD5] ml-0.5 inline" />;
  }

  function goToPage(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      toast.success('Product deleted');
    } catch {
      toast.error('Failed to delete product');
    }
    setDeleteTarget(null);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    try {
      await deleteProducts(Array.from(selectedIds));
      toast.success(`${selectedIds.size} product${selectedIds.size !== 1 ? 's' : ''} deleted`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to delete products');
    }
    setShowBulkDeleteConfirm(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (products.every((p) => selectedIds.has(p.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const someSelected = products.some((p) => selectedIds.has(p.id)) && !allSelected;

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      {/* Top bar: search + stock filter + add button OR bulk action bar */}
      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-2 mb-3 bg-[#5B9BD5]/10 border border-[#5B9BD5]/30 rounded-lg px-3 py-2">
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[#8FAABE]/60 hover:text-[#E8EDF2] transition-colors"
            title="Clear selection"
          >
            <X size={14} />
          </button>
          <span className="text-xs font-medium text-[#E8EDF2]">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#E06C75] text-white rounded-lg hover:bg-[#D15B65] transition-colors"
          >
            <Trash2 size={12} />
            Delete Selected
          </button>
        </div>
      ) : (
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FAABE]/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#1E3F5E]/60 rounded-lg bg-[#162F4D] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]"
          />
        </div>

        <select
          value={stockFilter}
          onChange={(e) => handleStockFilter(e.target.value as StockFilter)}
          className="text-xs bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg px-2 py-2 text-[#E8EDF2] focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] cursor-pointer"
          aria-label="Filter by stock level"
        >
          {stockOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={() => navigate('/products/new')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#5B9BD5] text-white rounded-lg hover:bg-[#4A8BC4] transition-colors"
        >
          <Plus size={13} />
          Add Product
        </button>
      </div>
      )}

      {/* Status tabs */}
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-2 mb-3 flex gap-1.5">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleStatusTab(tab.key)}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              statusTab === tab.key
                ? 'bg-[#5B9BD5] text-white'
                : 'text-[#E8EDF2]/80 hover:bg-[#1A3755]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Products table */}
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-xs text-[#E06C75] mb-2">{error}</p>
            <button onClick={() => fetchProducts({ page, search: search || undefined })} className="text-xs text-[#5B9BD5] hover:text-[#7EB8E0] font-medium">Retry</button>
          </div>
        ) : loading ? (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-1">
                <div className="h-3 bg-[#1A3755] rounded w-16" />
                <div className="h-3 bg-[#1A3755] rounded flex-1" />
                <div className="h-3 bg-[#1A3755] rounded w-20" />
                <div className="h-3 bg-[#1A3755] rounded w-12" />
                <div className="h-3 bg-[#1A3755] rounded w-16" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={24} className="text-[#8FAABE]/30 mx-auto mb-2" />
            <p className="text-xs text-[#8FAABE]/50">
              {search ? 'No products match your search' : stockFilter !== 'all' ? 'No products with this stock level' : 'No products found'}
            </p>
            {!search && stockFilter === 'all' && statusTab === 'all' && (
              <button onClick={() => navigate('/products/new')} className="mt-2 text-xs text-[#5B9BD5] hover:text-[#7EB8E0] font-medium">Add your first product</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#1E3F5E]/60 bg-[#1A3755]/50">
                    <th className="px-2 py-2.5 w-8">
                      <button onClick={toggleSelectAll} className="text-[#8FAABE]/50 hover:text-[#5B9BD5] transition-colors">
                        {allSelected ? <CheckSquare size={14} /> : someSelected ? <MinusSquare size={14} /> : <Square size={14} />}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider">SKU</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('name')}>
                      Name <SortIcon column="name" />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider hidden md:table-cell">Category</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('price')}>
                      Price <SortIcon column="price" />
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('stock_quantity')}>
                      Qty <SortIcon column="stock_quantity" />
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider whitespace-nowrap">
                      Cartons
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      tabIndex={0}
                      className={cn(
                        "border-b border-[#1E3F5E]/30 transition-colors hover:bg-[#1A3755]/40 cursor-pointer focus:outline-none focus-visible:bg-[#1A3755]/60",
                        selectedIds.has(product.id) && "bg-[#5B9BD5]/5"
                      )}
                      onClick={() => navigate(`/products/${product.id}/edit`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/products/${product.id}/edit`); }}
                    >
                      <td className="px-2 py-2 w-8" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleSelect(product.id)} className="text-[#8FAABE]/40 hover:text-[#5B9BD5] transition-colors">
                          {selectedIds.has(product.id) ? <CheckSquare size={14} className="text-[#5B9BD5]" /> : <Square size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-[10px] font-mono text-[#8FAABE]/50">{product.sku || '—'}</td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-[#E8EDF2] font-medium">{product.name}</p>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className="text-[10px] text-[#8FAABE]/50">{product.categories?.name || '—'}</span>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-[#E8EDF2] text-right font-mono tabular-nums">{formatCurrency(product.price)}</td>
                      <td className="px-3 py-2 text-center"><StockBadge qty={product.stock_quantity} /></td>
                      <td className="px-3 py-2 text-center"><CartonBadge qty={product.stock_quantity} cartonSize={product.carton_size} /></td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', product.is_active ? 'bg-[#98C379]/10 text-[#98C379]' : 'bg-[#8FAABE]/10 text-[#8FAABE]/50')}>
                          {product.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => navigate(`/products/${product.id}/edit`)} className="text-[#8FAABE]/40 hover:text-[#5B9BD5] transition-colors" title="Edit product"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteTarget(product)} className="text-[#8FAABE]/40 hover:text-[#E06C75] transition-colors" title="Delete product"><Trash2 size={13} /></button>
                          <ChevronRight size={14} className="text-[#8FAABE]/20" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-[#1E3F5E]/60 bg-[#1A3755]/50">
              <span className="text-[10px] text-[#8FAABE]/50 tabular-nums">{total} product{total !== 1 ? 's' : ''}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(page - 1)} disabled={page === 1} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                  <span className="text-[10px] text-[#8FAABE]/50 tabular-nums px-1">Page {page} of {totalPages}</span>
                  <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Product"
          message={`Are you sure you want to permanently delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title="Delete Selected Products"
          message={`Are you sure you want to permanently delete ${selectedIds.size} product${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel="Delete All"
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
