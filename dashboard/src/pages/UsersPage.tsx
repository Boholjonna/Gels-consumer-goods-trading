import { useState, useEffect, useMemo } from 'react';
import { Plus, Wifi, WifiOff, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UserDetailModal } from '@/components/UserDetailModal';
import { cn } from '@/lib/utils';
import type { Profile, ActivationCode } from '@/types';
import toast from 'react-hot-toast';

type UserWithCode = Profile & { activation_code?: ActivationCode | null };

const inputCls = 'border border-[#1E3F5E]/60 rounded-md px-2.5 py-1.5 text-xs bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] w-full';
const labelCls = 'block text-xs font-medium text-[#8FAABE]/70 mb-1';
const PAGE_SIZE = 20;

export function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithCode | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Form state
  const [nickname, setNickname] = useState('');
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

  useEffect(() => {
    fetchUsers();
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

    setFormLoading(true);
    setFormError('');

    try {
      const { error } = await supabase.functions.invoke('create-collector', {
        body: { nickname: nickname.trim(), tag: tag.trim() || undefined },
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
    setTag('');
    setFormError('');
  }

  function isOnline(user: Profile) {
    if (!user.last_seen_at) return false;
    return new Date().getTime() - new Date(user.last_seen_at).getTime() < 5 * 60 * 1000;
  }

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.nickname || '').toLowerCase().includes(q) ||
        (u.display_id || '').toLowerCase().includes(q) ||
        (u.tag || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FAABE]/50"
          />
          <input
            type="text"
            placeholder="Search by nickname, ID, or tag..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#1E3F5E]/60 rounded-lg bg-[#162F4D] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-1 focus:ring-[#5B9BD5] focus:border-[#5B9BD5]"
          />
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="bg-[#5B9BD5] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#4A8BC4] flex items-center gap-1.5"
        >
          <Plus size={13} />
          Add Collector
        </button>
      </div>

      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse py-1">
                <div className="h-3 bg-[#1A3755] rounded w-20" />
                <div className="h-3 bg-[#1A3755] rounded flex-1" />
                <div className="h-3 bg-[#1A3755] rounded w-16" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs text-[#8FAABE]/50">
              {search ? 'No collectors match your search' : 'No collectors found'}
            </p>
            {!search && (
              <button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="mt-2 text-xs text-[#5B9BD5] hover:text-[#5B9BD5]/80 font-medium"
              >
                Add your first collector
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E3F5E]/60 bg-[#1A3755]/50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8FAABE]/50 uppercase tracking-wide">ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8FAABE]/50 uppercase tracking-wide">Nickname</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8FAABE]/50 uppercase tracking-wide hidden md:table-cell">Connected</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#8FAABE]/50 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#8FAABE]/50 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#1E3F5E]/30 hover:bg-[#1A3755]/40 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(user)}
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-[#8FAABE]/50">
                      {user.display_id || user.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-[#E8EDF2]">
                      {user.nickname || user.full_name}
                      {user.tag && (
                        <span className="ml-1.5 px-1 py-0.5 bg-[#0D1F33] text-[#8FAABE]/50 text-[9px] rounded">
                          {user.tag}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        {user.device_connected_at ? (
                          <>
                            {isOnline(user) ? (
                              <Wifi size={12} className="text-[#98C379]" />
                            ) : (
                              <WifiOff size={12} className="text-[#8FAABE]/50" />
                            )}
                            <span className={cn(
                              'text-[10px]',
                              isOnline(user) ? 'text-[#98C379]' : 'text-[#8FAABE]/50'
                            )}>
                              {isOnline(user) ? 'Online' : 'Offline'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-[#8FAABE]/50">Not connected</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        user.is_active ? 'bg-[#98C379]/10 text-[#98C379]' : 'bg-[#1A3755]/30 text-[#8FAABE]/50'
                      )}>
                        {user.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {user.is_active ? (
                          <button
                            onClick={() => setDeactivateTarget(user)}
                            className="text-[10px] text-[#E8EDF2]/80 hover:text-[#E8EDF2] font-medium"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleActivate(user)}
                              className="text-[10px] text-[#5B9BD5] hover:text-[#5B9BD5]/80 font-medium"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(user); setDeleteConfirmName(''); }}
                              className="text-[10px] text-[#E06C75] hover:text-[#E06C75] font-medium"
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

        {/* Pagination footer */}
        {!loading && filteredUsers.length > 0 && (
          <div className="px-3 py-2 border-t border-[#1E3F5E]/60 bg-[#1A3755]/50 flex justify-between items-center">
            <p className="text-[10px] text-[#8FAABE]/50">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#E8EDF2]/80 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="text-[10px] text-[#E8EDF2]/80">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  disabled={safePage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#E8EDF2]/80 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Collector Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#162F4D] rounded-lg max-w-md w-full p-5 shadow-lg border border-[#1E3F5E]/60">
            <h3 className="text-sm font-bold text-[#E8EDF2] mb-4">New Collector</h3>
            {formError && (
              <div className="bg-[#E06C75]/10 border border-[#E06C75]/30 rounded-md p-3 mb-3 text-[#E06C75] text-xs">
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
            <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[#1E3F5E]/60">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#E8EDF2]/80 text-xs px-3 py-1.5 rounded-md hover:bg-[#1A3755]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={formLoading}
                className="bg-[#5B9BD5] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#4A8BC4] disabled:opacity-60"
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
          <div className="bg-[#162F4D] rounded-lg max-w-sm w-full p-5 shadow-lg border border-[#1E3F5E]/60">
            <h3 className="text-sm font-bold text-[#E8EDF2] mb-2">Deactivate User</h3>
            <p className="text-xs text-[#E8EDF2]/80 mb-4">
              Are you sure you want to deactivate "{deactivateTarget.nickname || deactivateTarget.full_name}"?
              They will be unable to sign in to the mobile app.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeactivateTarget(null)}
                className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#E8EDF2]/80 text-xs px-3 py-1.5 rounded-md hover:bg-[#1A3755]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="bg-[#E06C75] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#E06C75]/80"
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
          <div className="bg-[#162F4D] rounded-lg max-w-sm w-full p-5 shadow-lg border border-[#1E3F5E]/60">
            <h3 className="text-sm font-bold text-[#E8EDF2] mb-2">Delete Collector</h3>
            <p className="text-xs text-[#E8EDF2]/80 mb-3">
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
                className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#E8EDF2]/80 text-xs px-3 py-1.5 rounded-md hover:bg-[#1A3755]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmName !== (deleteTarget.nickname || deleteTarget.full_name)}
                className="bg-[#E06C75] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#E06C75]/80 disabled:opacity-40 disabled:cursor-not-allowed"
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
          onClose={() => setSelectedUser(null)}
          onUpdated={fetchUsers}
        />
      )}
    </div>
  );
}
