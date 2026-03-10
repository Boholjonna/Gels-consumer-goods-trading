import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Category } from '@/types';
import toast from 'react-hot-toast';

const inputCls = 'border border-[#dce8f5] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db] w-full';
const labelCls = 'block text-xs font-medium text-[#4b5e73] mb-1';

export function CategoriesPage() {
  const { categories, createCategory, updateCategory, deleteCategory } = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  function openAdd() {
    setEditTarget(null);
    setName('');
    setDescription('');
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditTarget(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (editTarget) {
        await updateCategory(editTarget.id, { name: name.trim(), description: description.trim() || undefined });
        toast.success('Category updated');
      } else {
        await createCategory({ name: name.trim(), description: description.trim() || undefined });
        toast.success('Category created');
      }
      setShowForm(false);
    } catch {
      toast.error('Failed to save category');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget.id);
      toast.success('Category deleted');
    } catch {
      toast.error('Failed to delete category');
    }
    setDeleteTarget(null);
  }

  return (
    <div className="p-4 bg-[#f0f4f8] min-h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#0d1f35]">Categories</p>
        <button
          onClick={openAdd}
          className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] flex items-center gap-1.5"
        >
          <Plus size={13} />
          Add Category
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-4 mb-3">
          <p className="text-xs font-semibold text-[#0d1f35] mb-3">
            {editTarget ? 'Edit Category' : 'New Category'}
          </p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] disabled:opacity-60"
            >
              {loading ? 'Saving...' : editTarget ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-[#8aa0b8]">No categories yet</p>
            <button
              onClick={openAdd}
              className="mt-2 text-xs text-[#1a56db] hover:text-[#1447c0] font-medium"
            >
              Create your first category
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden sm:table-cell">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-[#f0f4f8] hover:bg-[#f8fafd] transition-colors">
                  <td className="px-3 py-2 text-xs font-medium text-[#0d1f35]">{cat.name}</td>
                  <td className="px-3 py-2 text-xs text-[#4b5e73] hidden sm:table-cell">
                    {cat.description || <span className="text-[#8aa0b8]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(cat)}
                        className="text-[#8aa0b8] hover:text-[#1a56db] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
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
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Category"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This will mark it as inactive.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
