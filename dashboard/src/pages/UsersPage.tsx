import { useState, useEffect } from 'react';
import { Plus, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { UserDetailModal } from '@/components/UserDetailModal';
import { clsx } from 'clsx';
import type { Profile, ActivationCode, Branch } from '@/types';
import toast from 'react-hot-toast';

type UserWithCode = Profile & { activation_code?: ActivationCode | null };

const inputCls = 'border border-[#dce8f5] rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db] w-full';
const labelCls = 'block text-xs font-medium text-[#4b5e73] mb-1';

export function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithCode | null>(null);

  // Form state
  const [nickname, setNickname] = useState('');
  const [branchId, setBranchId] = useState('');
  const [tag, setTag] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'collector')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data as Profile[]) || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function fetchBranches() {
    try {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setBranches((data as Branch[]) || []);
    } catch {
      // Non-critical
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchBranches();
    const interval = setInterval(() => {
      fetchUsers();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreateUser() {
    if (!nickname.trim()) {
      setFormError('Nickname is required');
      return;
    }
    if (!branchId) {
      setFormError('A branch is required. Please select or create one first.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const { error } = await supabase.functions.invoke('create-collector', {
        body: { nickname: nickname.trim(), branch_id: branchId, tag: tag.trim() || undefined },
      });
      if (error) throw error;
      toast.success('Collector created');
      setShowCreateModal(false);
      resetForm();
      await fetchUsers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create collector');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', deactivateTarget.id);
      if (error) throw error;
      toast.success('User deactivated');
      await fetchUsers();
    } catch {
      toast.error('Failed to deactivate user');
    }
    setDeactivateTarget(null);
  }

  async function handleActivate(user: Profile) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('User activated');
      await fetchUsers();
    } catch {
      toast.error('Failed to activate user');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const expectedName = deleteTarget.nickname || deleteTarget.full_name;
    if (deleteConfirmName !== expectedName) {
      toast.error('Name does not match');
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('delete-collector', {
        body: { user_id: deleteTarget.id },
      });
      if (error) throw error;
      toast.success('Collector deleted');
      await fetchUsers();
    } catch {
      toast.error('Failed to delete collector');
    }
    setDeleteTarget(null);
    setDeleteConfirmName('');
  }

  async function handleRowClick(user: Profile) {
    if (user.role !== 'collector') return;
    try {
      const { data: codeData } = await supabase
        .from('activation_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSelectedUser({ ...user, activation_code: codeData as ActivationCode | null });
    } catch {
      toast.error('Failed to load user details');
    }
  }

  function resetForm() {
    setNickname('');
    setBranchId('');
    setTag('');
    setFormError('');
  }

  function isOnline(user: Profile) {
    if (!user.last_seen_at) return false;
    return new Date().getTime() - new Date(user.last_seen_at).getTime() < 5 * 60 * 1000;
  }

  function getBranchName(id: string | null) {
    if (!id) return null;
    return branches.find((b) => b.id === id)?.name || null;
  }

  return (
    <div className="p-4 bg-[#f0f4f8] min-h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#0d1f35]">Collectors</p>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] flex items-center gap-1.5"
        >
          <Plus size={13} />
          Add Collector
        </button>
      </div>

      <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-1">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded flex-1" />
                <div className="h-3 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-[#8aa0b8]">No collectors found</p>
            <button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              className="mt-2 text-xs text-[#1a56db] hover:text-[#1447c0] font-medium"
            >
              Add your first collector
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2ecf9] bg-[#f8fafd]">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Nickname</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden sm:table-cell">Branch</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide hidden md:table-cell">Connected</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8aa0b8] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#f0f4f8] hover:bg-[#f8fafd] cursor-pointer transition-colors"
                    onClick={() => handleRowClick(user)}
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-[#8aa0b8]">
                      {user.display_id || user.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-[#0d1f35]">
                      {user.nickname || user.full_name}
                      {user.tag && (
                        <span className="ml-1.5 px-1 py-0.5 bg-[#f0f4f8] text-[#8aa0b8] text-[9px] rounded">
                          {user.tag}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#4b5e73] hidden sm:table-cell">
                      {getBranchName(user.branch_id) || (
                        <span className="text-[#8aa0b8]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        {user.device_connected_at ? (
                          <>
                            {isOnline(user) ? (
                              <Wifi size={12} className="text-green-500" />
                            ) : (
                              <WifiOff size={12} className="text-[#8aa0b8]" />
                            )}
                            <span className={clsx(
                              'text-[10px]',
                              isOnline(user) ? 'text-green-600' : 'text-[#8aa0b8]'
                            )}>
                              {isOnline(user) ? 'Online' : 'Offline'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-[#8aa0b8]">Not connected</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {user.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {user.is_active ? (
                          <button
                            onClick={() => setDeactivateTarget(user)}
                            className="text-[10px] text-[#4b5e73] hover:text-[#0d1f35] font-medium"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleActivate(user)}
                              className="text-[10px] text-[#1a56db] hover:text-[#1447c0] font-medium"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(user); setDeleteConfirmName(''); }}
                              className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Collector Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#0d1f35] mb-4">New Collector</h3>
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3 text-red-600 text-xs">
                {formError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nickname *</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter nickname"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Branch *</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className={`${inputCls} bg-white`}
                >
                  <option value="">Select branch...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {branches.length === 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); navigate('/branches'); }}
                    className="text-xs text-[#1a56db] hover:text-[#1447c0] mt-1"
                  >
                    No branches yet — create one first
                  </button>
                )}
              </div>
              <div>
                <label className={labelCls}>Tag (optional)</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. zone-a"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[#e2ecf9]">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={formLoading}
                className="bg-[#1a56db] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#1447c0] disabled:opacity-60"
              >
                {formLoading ? 'Creating...' : 'Create Collector'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      {deactivateTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#0d1f35] mb-2">Deactivate User</h3>
            <p className="text-xs text-[#4b5e73] mb-4">
              Are you sure you want to deactivate "{deactivateTarget.nickname || deactivateTarget.full_name}"?
              They will be unable to sign in to the mobile app.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-600"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation with name entry */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#0d1f35] mb-2">Delete Collector</h3>
            <p className="text-xs text-[#4b5e73] mb-3">
              This action is permanent. To confirm, type the collector's name:{' '}
              <strong>{deleteTarget.nickname || deleteTarget.full_name}</strong>
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type collector name to confirm"
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
                disabled={deleteConfirmName !== (deleteTarget.nickname || deleteTarget.full_name)}
                className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          branches={branches}
          onClose={() => setSelectedUser(null)}
          onUpdated={fetchUsers}
        />
      )}
    </div>
  );
}
