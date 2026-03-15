import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Upload, Pencil, Trash2, Package, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

interface PreviewRow {
  _id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

type ImportState =
  | null
  | { phase: 'preview'; rows: PreviewRow[] }
  | { phase: 'importing' };

/** Derive a SKU prefix from the product name + 4-digit suffix. e.g. "Baking Powder" → BAK-4729 */
function generateSku(name: string): string {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

function StockBadge({ qty }: { qty: number }) {
  const cls =
    qty <= 0
      ? 'bg-red-100 text-red-600'
      : qty <= 10
      ? 'bg-amber-100 text-amber-700'
      : 'bg-green-100 text-green-700';
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cls)}>
      {qty}
    </span>
  );
}

function parseCSV(text: string): PreviewRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
  return lines
    .slice(1)
    .map((line): PreviewRow | null => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? '';
      });
      if (!obj.name) return null;
      return {
        _id: crypto.randomUUID(),
        name: obj.name,
        sku: obj.sku || generateSku(obj.name),
        price: parseFloat(obj.price) || 0,
        stock_quantity: parseInt(obj.stock_quantity, 10) || 0,
      };
    })
    .filter((r): r is PreviewRow => r !== null);
}

export function ProductsPage() {
  const {
    products,
    total,
    totalPages,
    loading,
    error,
    deleteProduct,
    fetchProducts,
    batchCreateProducts,
    clearAllProducts,
  } = useProducts();

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [importState, setImportState] = useState<ImportState>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts({ page, search: search || undefined });
  }, [page, search, fetchProducts]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    file
      .text()
      .then((text) => {
        const rows = parseCSV(text);
        if (rows.length === 0) {
          toast.error('No valid rows found in CSV');
          return;
        }
        setImportState({ phase: 'preview', rows });
      })
      .catch(() => {
        toast.error('Failed to read CSV file');
      });
  }

  async function handleImportConfirm() {
    if (importState?.phase !== 'preview') return;
    const rows = importState.rows;
    setImportState({ phase: 'importing' });
    try {
      if (replaceExisting) {
        await clearAllProducts();
      }
      const mappedRows: Partial<Product>[] = rows.map(({ name, sku, price, stock_quantity }) => ({
        name,
        sku: sku || generateSku(name),
        price,
        stock_quantity,
        is_active: true,
      }));
      await batchCreateProducts(mappedRows);
      toast.success(`Imported ${rows.length} products`);
      setImportState(null);
      setReplaceExisting(false);
      setPage(1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to import products');
      setImportState(null);
    }
  }

  function updatePreviewRow(id: string, field: keyof Omit<PreviewRow, '_id'>, value: string) {
    setImportState((prev) => {
      if (prev?.phase !== 'preview') return prev;
      return {
        phase: 'preview',
        rows: prev.rows.map((r) => {
          if (r._id !== id) return r;
          if (field === 'name') return { ...r, name: value };
          if (field === 'sku') return { ...r, sku: value };
          if (field === 'price') return { ...r, price: parseFloat(value) || 0 };
          if (field === 'stock_quantity') return { ...r, stock_quantity: parseInt(value, 10) || 0 };
          return r;
        }),
      };
    });
  }

  function removePreviewRow(id: string) {
    setImportState((prev) => {
      if (prev?.phase !== 'preview') return prev;
      return { phase: 'preview', rows: prev.rows.filter((r) => r._id !== id) };
    });
  }

  const previewRows = importState?.phase === 'preview' ? importState.rows : [];
  const isImporting = importState?.phase === 'importing';

  return (
    <div className="p-3 bg-background min-h-full">
      {/* Header row */}
      <div className="flex items-center justify-end mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload CSV file"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-card border border-input text-foreground/80 text-xs px-3 py-1.5 rounded-md hover:bg-muted flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Upload size={13} />
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <button
            onClick={() => navigate('/products/new')}
            className="bg-primary text-white text-xs px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} />
            Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-2 mb-3 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-7 pr-3 border border-input rounded-md py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-xs text-red-500 mb-2">{error}</p>
            <button
              onClick={() => fetchProducts({ page, search: search || undefined })}
              className="text-xs text-primary font-medium"
            >
              Retry
            </button>
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
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={24} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No products found</p>
            <button
              onClick={() => navigate('/products/new')}
              className="mt-2 text-xs text-primary hover:text-primary/80 font-medium"
            >
              Add your first product
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      SKU
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Price
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Stock
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-muted hover:bg-secondary transition-colors"
                    >
                      <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">
                        {product.sku || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-foreground font-medium">{product.name}</p>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-foreground text-right">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StockBadge qty={product.stock_quantity} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-medium',
                            product.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500',
                          )}
                        >
                          {product.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => navigate(`/products/${product.id}/edit`)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Edit product"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                            title="Delete product"
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

            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground">
              <span>{total} products</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="px-2 py-1 rounded border border-input hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-2 py-1 rounded border border-input hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CSV Import Preview Modal */}
      {importState !== null && (
        <div className="fixed inset-0 bg-card/90 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl">
            {importState.phase === 'importing' ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-foreground">Importing products...</p>
                <p className="text-xs text-muted-foreground mt-1">Please wait</p>
              </div>
            ) : (
              <>
                {/* Modal header */}
                <div className="px-5 pt-5 pb-3 border-b border-border">
                  <h2 className="text-sm font-bold text-foreground">Import Preview</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {previewRows.length} products ready to import
                  </p>
                </div>

                {/* Replace toggle */}
                <div className="px-5 py-3 border-b border-border">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground/80">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="rounded border-input"
                    />
                    Replace existing products
                  </label>
                </div>

                {/* Scrollable preview table */}
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0">
                      <tr className="bg-secondary border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          SKU
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Price
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Stock
                        </th>
                        <th className="px-3 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row._id} className="border-b border-muted">
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => updatePreviewRow(row._id, 'name', e.target.value)}
                              className="w-full border border-input rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              aria-label="Product name"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={row.sku}
                              onChange={(e) => updatePreviewRow(row._id, 'sku', e.target.value)}
                              className="w-28 border border-input rounded px-2 py-1 text-xs font-mono text-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring"
                              aria-label="Product SKU"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              value={row.price}
                              onChange={(e) => updatePreviewRow(row._id, 'price', e.target.value)}
                              className="w-full border border-input rounded px-2 py-1 text-xs text-foreground text-right focus:outline-none focus:ring-1 focus:ring-ring"
                              min="0"
                              step="0.01"
                              aria-label="Product price"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              value={row.stock_quantity}
                              onChange={(e) =>
                                updatePreviewRow(row._id, 'stock_quantity', e.target.value)
                              }
                              className="w-full border border-input rounded px-2 py-1 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring"
                              min="0"
                              aria-label="Stock quantity"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <button
                              onClick={() => removePreviewRow(row._id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                              title="Remove row"
                            >
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Modal action bar */}
                <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setImportState(null);
                      setReplaceExisting(false);
                    }}
                    className="bg-card border border-input text-foreground/80 text-xs px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={previewRows.length === 0}
                    className="bg-primary text-white text-xs px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Import {previewRows.length} Products
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete single product confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Product"
          message={`Are you sure you want to permanently delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
