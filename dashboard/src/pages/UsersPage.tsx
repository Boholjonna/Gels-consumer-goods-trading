import { useState, useEffect, useMemo } from 'react';
import { Plus, Wifi, WifiOff, Search, ChevronUp, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UserDetailModal } from '@/components/UserDetailModal';
import { cn } from '@/lib/utils';
import type { Profile, ActivationCode } from '@/types';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

type UserWithCode = Profile & { activation_code?: ActivationCode | null };

type StatusTab = 'all' | 'active' | 'inactive';
type ConnFilter = 'all' | 'online' | 'offline' | 'not_connected';
type SortField = 'nickname' | 'created_at' | 'last_seen_at';
type SortDir = 'asc' | 'desc';

const statusTabs: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const connOptions: { key: ConnFilter; label: string }[] = [
  { key: 'all', label: 'All connections' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'not_connected', label: 'Not connected' },
];

const inputCls = 'border border-[#1E3F5E]/60 rounded-md px-2.5 py-1.5 text-xs bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] w-full';
const labelCls = 'block text-xs font-medium text-[#8FAABE]/70 mb-1';
const PAGE_SIZE = 20;

function isOnline(user: Profile) {
  if (!user.last_seen_at) return false;
  return new Date().getTime() - new Date(user.last_seen_at).getTime() < 5 * 60 * 1000;
}

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
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [connFilter, setConnFilter] = useState<ConnFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  function handleStatusTab(tab: StatusTab) {
    setStatusTab(tab);
    setPage(1);
  }

  function handleConnFilter(filter: ConnFilter) {
    setConnFilter(filter);
    setPage(1);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'nickname' ? 'asc' : 'desc');
    }
    setPage(1);
  }

  function SortIcon({ column }: { column: SortField }) {
    if (sortField !== column) return <ChevronDown size={12} className="text-[#8FAABE]/30 ml-0.5 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-[#5B9BD5] ml-0.5 inline" />
      : <ChevronDown size={12} className="text-[#5B9BD5] ml-0.5 inline" />;
  }

  const filteredUsers = useMemo(() => {
    let result = users;

    // Status filter
    if (statusTab === 'active') result = result.filter((u) => u.is_active);
    else if (statusTab === 'inactive') result = result.filter((u) => !u.is_active);

    // Connection filter
    if (connFilter === 'online') result = result.filter((u) => isOnline(u));
    else if (connFilter === 'offline') result = result.filter((u) => u.device_connected_at && !isOnline(u));
    else if (connFilter === 'not_connected') result = result.filter((u) => !u.device_connected_at);

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          (u.nickname || '').toLowerCase().includes(q) ||
          (u.display_id || '').toLowerCase().includes(q) ||
          (u.tag || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nickname') {
        cmp = (a.nickname || a.full_name || '').localeCompare(b.nickname || b.full_name || '');
      } else if (sortField === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'last_seen_at') {
        const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        cmp = aTime - bTime;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [users, search, statusTab, connFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Summary counts
  const onlineCount = users.filter((u) => isOnline(u)).length;
  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      {/* Top bar: search + connection filter + add button */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FAABE]/40" />
          <input
            type="text"
            placeholder="Search by nickname, ID, or tag..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#1E3F5E]/60 rounded-lg bg-[#162F4D] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]"
          />
        </div>

        <select
          value={connFilter}
          onChange={(e) => handleConnFilter(e.target.value as ConnFilter)}
          className="text-xs bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg px-2 py-2 text-[#E8EDF2] focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] cursor-pointer"
        >
          {connOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#5B9BD5] text-white rounded-lg hover:bg-[#4A8BC4] transition-colors"
        >
          <Plus size={13} />
          Add Collector
        </button>
      </div>

      {/* Status tabs with summary badges */}
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-2 mb-3 flex items-center gap-1.5 flex-wrap">
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
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] text-[#98C379] tabular-nums">{onlineCount} online</span>
          <span className="text-[10px] text-[#8FAABE]/50 tabular-nums">{activeCount}/{users.length} active</span>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
        {loading ? (
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
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={24} className="text-[#8FAABE]/30 mx-auto mb-2" />
            <p className="text-xs text-[#8FAABE]/50">
              {search ? 'No collectors match your search' : connFilter !== 'all' ? 'No collectors with this connection status' : statusTab !== 'all' ? `No ${statusTab} collectors` : 'No collectors found'}
            </p>
            {!search && connFilter === 'all' && statusTab === 'all' && (
              <button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="mt-2 text-xs text-[#5B9BD5] hover:text-[#7EB8E0] font-medium"
              >
                Add your first collector
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#1E3F5E]/60 bg-[#1A3755]/50">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider">ID</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('nickname')}>
                      Nickname <SortIcon column="nickname" />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider hidden md:table-cell">Tag</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('last_seen_at')}>
                      Connection <SortIcon column="last_seen_at" />
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('created_at')}>
                      Joined <SortIcon column="created_at" />
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#8FAABE]/60 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((user) => (
                    <tr
                      key={user.id}
                      tabIndex={0}
                      className="border-b border-[#1E3F5E]/30 transition-colors hover:bg-[#1A3755]/40 cursor-pointer focus:outline-none focus-visible:bg-[#1A3755]/60"
                      onClick={() => handleRowClick(user)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(user); }}
                    >
                      <td className="px-3 py-2 font-mono text-[10px] text-[#8FAABE]/50">
                        {user.display_id || user.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs font-medium text-[#E8EDF2]">
                          {user.nickname || user.full_name}
                        </p>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        {user.tag ? (
                          <span className="px-1.5 py-0.5 bg-[#0D1F33] text-[#8FAABE]/60 text-[10px] rounded font-medium">
                            {user.tag}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#8FAABE]/30">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1.5">
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
                                {isOnline(user) ? 'Online' : user.last_seen_at ? formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true }) : 'Offline'}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-[#8FAABE]/30">Not connected</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium',
                          user.is_active ? 'bg-[#98C379]/10 text-[#98C379]' : 'bg-[#8FAABE]/10 text-[#8FAABE]/50'
                        )}>
                          {user.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-[10px] text-[#8FAABE]/50 tabular-nums">
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
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
                                className="text-[10px] text-[#E06C75] hover:text-[#E06C75]/80 font-medium"
                              >
                                Delete
                              </button>
                            </>
                          )}
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
              <span className="text-[10px] text-[#8FAABE]/50 tabular-nums">{filteredUsers.length} collector{filteredUsers.length !== 1 ? 's' : ''}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => p - 1)} disabled={safePage === 1} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                  <span className="text-[10px] text-[#8FAABE]/50 tabular-nums px-1">Page {safePage} of {totalPages}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={safePage >= totalPages} className="text-[10px] px-2 py-0.5 rounded border border-[#1E3F5E]/60 text-[#8FAABE]/70 hover:bg-[#162F4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              )}
            </div>
          </>
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
