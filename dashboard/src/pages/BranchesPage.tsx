import { useState, useEffect } from 'react';
import { Plus, MapPin, Users, ChevronDown, ChevronUp, Wifi, WifiOff, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clsx } from 'clsx';
import type { Branch, Profile } from '@/types';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const inputCls = 'border border-[#dce8f5] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db] w-full';
const labelCls = 'block text-xs font-medium text-[#4b5e73] mb-1';

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [branchCollectors, setBranchCollectors] = useState<Record<string, Profile[]>>({});
  const [loadingCollectors, setLoadingCollectors] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  async function fetchBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (error) throw error;
      setBranches((data as Branch[]) || []);
    } catch {
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBranches();
  }, []);

  function resetForm() {
    setName('');
    setLocation('');
    setFormError('');
    setEditingId(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setFormError('Branch name is required');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      if (editingId) {
        const { error } = await supabase
          .from('branches')
          .update({ name: name.trim(), location: location.trim() || null })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Branch updated');
      } else {
        const { error } = await supabase
          .from('branches')
          .insert({ name: name.trim(), location: location.trim() || null });
        if (error) throw error;
        toast.success('Branch created');
      }
      setShowForm(false);
      resetForm();
      await fetchBranches();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save branch');
    } finally {
      setFormLoading(false);
    }
  }

  function handleEdit(branch: Branch) {
    setName(branch.name);
    setLocation(branch.location || '');
    setEditingId(branch.id);
    setShowForm(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteConfirmName !== deleteTarget.name) {
      toast.error('Name does not match');
      return;
    }
    try {
      const { error } = await supabase.from('branches').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Branch deleted');
      await fetchBranches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete branch');
    }
    setDeleteTarget(null);
    setDeleteConfirmName('');
  }

  async function toggleBranchExpand(branchId: string) {
    if (expandedBranch === branchId) {
      setExpandedBranch(null);
      return;
    }

    setExpandedBranch(branchId);

    if (!branchCollectors[branchId]) {
      setLoadingCollectors(branchId);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('branch_id', branchId)
          .order('created_at');
        if (error) throw error;
        const collectors = (data as Profile[]) || [];
        setBranchCollectors((prev) => ({ ...prev, [branchId]: collectors }));
        // update collector_count in local branches state
        setBranches((prev) =>
          prev.map((b) => b.id === branchId ? { ...b, collector_count: collectors.length } : b)
        );
      } catch {
        toast.error('Failed to load collectors');
      } finally {
        setLoadingCollectors(null);
      }
    }
  }

  function isOnline(user: Profile) {
    if (!user.last_seen_at) return false;
    return new Date().getTime() - new Date(user.last_seen_at).getTime() < 5 * 60 * 1000;
  }

  return (
    <div className="p-4 bg-[#f0f4f8] min-h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#0d1f35]">Branches</p>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] flex items-center gap-1.5"
        >
          <Plus size={13} />
          Add Branch
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white border border-[#e2ecf9] rounded-lg p-4 mb-3">
          <p className="text-xs font-semibold text-[#0d1f35] mb-3">
            {editingId ? 'Edit Branch' : 'New Branch'}
          </p>
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-3 text-red-600 text-xs">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Branch Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Branch name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (optional)"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={formLoading}
              className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] disabled:opacity-60"
            >
              {formLoading ? 'Saving...' : editingId ? 'Update Branch' : 'Create Branch'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-1">
                <div className="h-3 bg-gray-200 rounded flex-1" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-[#8aa0b8]">No branches yet</p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-2 text-xs text-[#1a56db] hover:text-[#1447c0] font-medium"
            >
              Create your first branch
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden sm:table-cell">Location</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Collectors</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <>
                  <tr
                    key={branch.id}
                    className="border-b border-[#f0f4f8] hover:bg-[#f8fafd] cursor-pointer transition-colors"
                    onClick={() => toggleBranchExpand(branch.id)}
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-[#8aa0b8]">
                      {branch.display_id || branch.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-[#0d1f35]">
                      <div className="flex items-center gap-1.5">
                        {expandedBranch === branch.id ? (
                          <ChevronUp size={13} className="text-[#8aa0b8]" />
                        ) : (
                          <ChevronDown size={13} className="text-[#8aa0b8]" />
                        )}
                        {branch.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        {branch.location ? (
                          <>
                            <MapPin size={12} className="text-[#8aa0b8]" />
                            {branch.location}
                          </>
                        ) : (
                          <span className="text-[#8aa0b8]">Not set</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 text-xs text-[#4b5e73]">
                        <Users size={12} className="text-[#8aa0b8]" />
                        {branch.collector_count ?? '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEdit(branch)}
                          className="text-[#8aa0b8] hover:text-[#1a56db] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if ((branch.collector_count ?? 0) > 0) {
                              toast.error(`Cannot delete "${branch.name}" — it has collectors. Remove them first.`);
                              return;
                            }
                            setDeleteTarget(branch);
                            setDeleteConfirmName('');
                          }}
                          className="text-[#8aa0b8] hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedBranch === branch.id && (
                    <tr key={`${branch.id}-expanded`} className="border-b border-[#f0f4f8]">
                      <td colSpan={5} className="px-4 py-3 bg-[#f8fafd]">
                        {loadingCollectors === branch.id ? (
                          <p className="text-xs text-[#8aa0b8] py-2">Loading collectors...</p>
                        ) : (branchCollectors[branch.id] || []).length === 0 ? (
                          <p className="text-xs text-[#8aa0b8] py-2">No collectors in this branch</p>
                        ) : (
                          <div className="space-y-1.5">
                            {(branchCollectors[branch.id] || []).map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-[#e2ecf9]"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-[10px] text-[#8aa0b8]">
                                    {c.display_id || c.id.slice(0, 8)}
                                  </span>
                                  <span className="text-xs font-medium text-[#0d1f35]">
                                    {c.nickname || c.full_name}
                                  </span>
                                  {c.tag && (
                                    <span className="text-[9px] text-[#8aa0b8] bg-[#f0f4f8] px-1 py-0.5 rounded">
                                      {c.tag}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1">
                                    {c.device_connected_at ? (
                                      isOnline(c) ? (
                                        <>
                                          <Wifi size={11} className="text-green-500" />
                                          <span className="text-[10px] text-green-600">Online</span>
                                        </>
                                      ) : (
                                        <>
                                          <WifiOff size={11} className="text-[#8aa0b8]" />
                                          <span className="text-[10px] text-[#8aa0b8]">
                                            {c.last_seen_at
                                              ? formatDistanceToNow(new Date(c.last_seen_at), { addSuffix: true })
                                              : 'Offline'}
                                          </span>
                                        </>
                                      )
                                    ) : (
                                      <span className="text-[10px] text-[#8aa0b8]">Not connected</span>
                                    )}
                                  </div>
                                  <span className={clsx(
                                    'px-1.5 py-0.5 rounded text-[9px] font-medium',
                                    c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                                  )}>
                                    {c.is_active ? 'active' : 'inactive'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#0d1f35] mb-2">Delete Branch</h3>
            <p className="text-xs text-[#4b5e73] mb-3">
              This action is permanent. To confirm, type the branch name:{' '}
              <strong>{deleteTarget.name}</strong>
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type branch name to confirm"
              className={`${inputCls} mb-3`}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}
                className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmName !== deleteTarget.name}
                className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
