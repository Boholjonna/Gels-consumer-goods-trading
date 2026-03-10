import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Upload, Pencil, Trash2, Package } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { clsx } from 'clsx';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

function StockBadge({ qty }: { qty: number }) {
  const cls =
    qty <= 0
      ? 'bg-red-100 text-red-600'
      : qty <= 10
      ? 'bg-amber-100 text-amber-700'
      : 'bg-green-100 text-green-700';
  return (
    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>
      {qty}
    </span>
  );
}

function parseCSV(text: string): Partial<Product>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string | number | boolean | null> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? '';
    });
    return {
      name: obj.name as string,
      sku: (obj.sku as string) || null,
      description: (obj.description as string) || null,
      price: parseFloat(obj.price as string) || 0,
      stock_quantity: parseInt(obj.stock_quantity as string, 10) || 0,
      unit: (obj.unit as string) || 'unit',
      is_active: obj.is_active !== 'false',
    };
  });
}

export function ProductsPage() {
  const { products, categories, loading, error, deleteProduct, fetchProducts, createProduct } = useProducts();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSearch(value: string) {
    setSearch(value);
    fetchProducts(value || undefined, categoryFilter || undefined);
  }

  function handleCategoryFilter(value: string) {
    setCategoryFilter(value);
    fetchProducts(search || undefined, value || undefined);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      toast.success('Product deactivated');
    } catch {
      toast.error('Failed to delete product');
    }
    setDeleteTarget(null);
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error('No valid rows found in CSV');
        return;
      }
      let created = 0;
      let failed = 0;
      for (const row of rows) {
        if (!row.name) { failed++; continue; }
        try {
          await createProduct(row);
          created++;
        } catch {
          failed++;
        }
      }
      toast.success(`Imported ${created} products${failed > 0 ? `, ${failed} failed` : ''}`);
      await fetchProducts();
    } catch {
      toast.error('Failed to parse CSV file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category_id === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-4 bg-[#f0f4f8] min-h-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-sm font-semibold text-[#0d1f35]">Products</p>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8] flex items-center gap-1.5"
          >
            <Upload size={13} />
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <button
            onClick={() => navigate('/products/new')}
            className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] flex items-center gap-1.5"
          >
            <Plus size={13} />
            Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#e2ecf9] rounded-lg p-2 mb-3 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8aa0b8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-7 pr-3 border border-[#dce8f5] rounded-md py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => handleCategoryFilter(e.target.value)}
          className="border border-[#dce8f5] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db] bg-white text-[#4b5e73]"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-xs text-red-500 mb-2">{error}</p>
            <button onClick={() => fetchProducts()} className="text-xs text-[#1a56db] font-medium">Retry</button>
          </div>
        ) : loading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-1">
                <div className="h-3 bg-gray-200 rounded flex-1" />
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={24} className="text-[#8aa0b8] mx-auto mb-2" />
            <p className="text-xs text-[#8aa0b8]">No products found</p>
            <button
              onClick={() => navigate('/products/new')}
              className="mt-2 text-xs text-[#1a56db] hover:text-[#1447c0] font-medium"
            >
              Add your first product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Price</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Stock</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden md:table-cell">Unit</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-[#f0f4f8] hover:bg-[#f8fafd] transition-colors">
                    <td className="px-3 py-2 text-[10px] font-mono text-[#8aa0b8]">
                      {product.sku || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-[#f0f4f8] flex items-center justify-center flex-shrink-0">
                            <Package size={11} className="text-[#8aa0b8]" />
                          </div>
                        )}
                        <p className="text-xs text-[#0d1f35] font-medium">{product.name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] hidden sm:table-cell">
                      {product.categories?.name || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-[#0d1f35] text-right">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StockBadge qty={product.stock_quantity} />
                    </td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] text-center hidden md:table-cell">
                      {product.unit}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {product.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/products/${product.id}/edit`)}
                          className="text-[#8aa0b8] hover:text-[#1a56db] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(product)}
                          className="text-[#8aa0b8] hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Deactivate Product"
          message={`Are you sure you want to deactivate "${deleteTarget.name}"? This will mark it as inactive.`}
          confirmLabel="Deactivate"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
