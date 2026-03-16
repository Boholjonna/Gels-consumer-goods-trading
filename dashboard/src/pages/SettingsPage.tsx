import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Trash2,
  Settings as SettingsIcon,
  PanelLeft,
  PanelLeftClose,
  MousePointerClick,
  Monitor,
  Bell,
  Database,
  Info,
  Download,
  ShoppingCart,
  Package,
  Users,
  MapPin,
  Shield,
  Camera,
  Loader2,
  UserCircle,
  Heart,
  Pencil,
  Check,
  X,
  Plus,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProducts } from '@/hooks/useProducts';
import { useSidebar, SidebarMode } from '@/contexts/SidebarContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const sectionCls = 'bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden';
const sectionHeaderCls = 'flex items-center gap-2 px-4 py-3 border-b border-[#1E3F5E]/60';
const sectionTitleCls = 'text-xs font-semibold text-[#E8EDF2]';
const sectionDescCls = 'text-[9px] text-[#8FAABE]/40 mt-0.5';
const itemCls = 'flex items-center justify-between px-4 py-3 border-b border-[#1E3F5E]/30 last:border-0';
const itemLabelCls = 'text-xs text-[#E8EDF2]';
const itemDescCls = 'text-[10px] text-[#8FAABE]/50 mt-0.5';

type SettingsTab = 'general' | 'data' | 'about' | 'credits';

interface SystemInfo {
  orderCount: number;
  productCount: number;
  userCount: number;
  storeCount: number;
}

function RadioGroup({ value, options, onChange }: {
  value: string;
  options: { value: string; label: string; icon?: React.ElementType }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-[#0D1F33] rounded-lg p-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors flex-1 justify-center',
              value === opt.value
                ? 'bg-[#5B9BD5] text-white'
                : 'text-[#8FAABE]/60 hover:text-[#E8EDF2] hover:bg-[#1A3755]'
            )}
          >
            {Icon && <Icon size={11} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const NOTIF_STORAGE_KEY = 'notification-prefs';

interface NotifPrefs {
  push: boolean;
  orders: boolean;
  stock: boolean;
}

function loadNotifPrefs(): NotifPrefs {
  try {
    const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { push: true, orders: true, stock: true };
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        checked ? 'bg-[#5B9BD5]' : 'bg-[#1E3F5E]'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
          checked ? 'translate-x-[18px] ml-0' : 'translate-x-[2px]'
        )}
      />
    </button>
  );
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  sort_order: number;
}

interface SortableMemberCardProps {
  member: TeamMember;
  creditsEditMode: boolean;
  editingId: string | null;
  editName: string;
  uploadingId: string | null;
  deletingId: string | null;
  onEditStart: (id: string, name: string) => void;
  onEditCancel: () => void;
  onEditNameChange: (name: string) => void;
  onNameSave: (id: string) => void;
  onAvatarUpload: (id: string, file: File) => void;
  onRemoveAvatar: (id: string) => void;
  onDelete: (id: string) => void;
  fileInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

function SortableMemberCard({
  member, creditsEditMode, editingId, editName, uploadingId, deletingId,
  onEditStart, onEditCancel, onEditNameChange, onNameSave, onAvatarUpload, onRemoveAvatar, onDelete, fileInputRefs,
}: SortableMemberCardProps) {
  const isEditing = editingId === member.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: member.id,
    disabled: !creditsEditMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#0D1F33] border border-[#1E3F5E]/30 rounded-xl p-5 flex flex-col items-center text-center relative group w-[180px]"
    >
      {/* Drag handle - only in edit mode */}
      {creditsEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-1/2 -translate-x-1/2 p-1 cursor-grab active:cursor-grabbing text-[#8FAABE]/30 hover:text-[#8FAABE]/60 transition-colors"
        >
          <GripVertical size={12} />
        </div>
      )}

      {/* Edit toggle - only in edit mode */}
      {creditsEditMode && (
        !isEditing ? (
          <button
            onClick={() => onEditStart(member.id, member.name)}
            className="absolute top-2 right-2 p-1 rounded-md text-[#8FAABE]/30 hover:text-[#5B9BD5] hover:bg-[#1A3755] transition-all"
            title="Edit"
          >
            <Pencil size={11} />
          </button>
        ) : (
          <button
            onClick={onEditCancel}
            className="absolute top-2 right-2 p-1 rounded-md text-[#8FAABE]/40 hover:text-[#E06C75] hover:bg-[#E06C75]/10 transition-all"
            title="Cancel"
          >
            <X size={11} />
          </button>
        )
      )}

      {/* Delete button - only in edit mode */}
      {creditsEditMode && !isEditing && (
        <button
          onClick={() => onDelete(member.id)}
          disabled={deletingId === member.id}
          className="absolute top-2 left-2 p-1 rounded-md text-[#8FAABE]/30 hover:text-[#E06C75] hover:bg-[#E06C75]/10 transition-all disabled:opacity-40"
          title="Remove"
        >
          {deletingId === member.id ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Trash2 size={11} />
          )}
        </button>
      )}

      {/* Avatar */}
      <div className="relative flex-shrink-0 mb-4">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.name}
            className="w-24 h-24 rounded-full object-cover border-2 border-[#1E3F5E]/60"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-[#162F4D] border-2 border-[#1E3F5E]/60 flex items-center justify-center">
            <UserCircle size={44} className="text-[#8FAABE]/30" />
          </div>
        )}
        {/* Upload overlay */}
        {isEditing && (
          <button
            onClick={() => fileInputRefs.current[member.id]?.click()}
            disabled={uploadingId === member.id}
            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center cursor-pointer transition-opacity"
          >
            {uploadingId === member.id ? (
              <Loader2 size={20} className="animate-spin text-white" />
            ) : (
              <Camera size={20} className="text-white" />
            )}
          </button>
        )}
        {/* Remove photo button */}
        {isEditing && member.avatar_url && (
          <button
            onClick={() => onRemoveAvatar(member.id)}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E06C75] flex items-center justify-center hover:bg-[#c75a63] transition-colors"
            title="Remove photo"
          >
            <X size={10} className="text-white" />
          </button>
        )}
        <input
          ref={(el) => { fileInputRefs.current[member.id] = el; }}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAvatarUpload(member.id, file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Name */}
      {isEditing ? (
        <div className="flex items-center gap-1 mb-1 w-full">
          <input
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onNameSave(member.id); if (e.key === 'Escape') onEditCancel(); }}
            className="flex-1 min-w-0 bg-[#162F4D] border border-[#1E3F5E]/60 rounded px-2 py-1 text-xs text-[#E8EDF2] text-center outline-none focus:border-[#5B9BD5]"
            autoFocus
          />
          <button
            onClick={() => onNameSave(member.id)}
            className="p-1 rounded text-[#98C379] hover:bg-[#98C379]/10 transition-colors flex-shrink-0"
            title="Save"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <p className="text-sm font-semibold text-[#E8EDF2] truncate w-full">{member.name}</p>
      )}
      <p className="text-xs text-[#8FAABE]/50 truncate w-full mt-0.5">{member.role}</p>
    </div>
  );
}

export function SettingsPage() {
  const { total, clearAllProducts } = useProducts();
  const { mode, setMode } = useSidebar();
  const [dangerOpen, setDangerOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({ orderCount: 0, productCount: 0, userCount: 0, storeCount: 0 });
  const [exporting, setExporting] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Researcher' | 'Developer'>('Researcher');
  const newMemberFileRef = useRef<HTMLInputElement | null>(null);
  const [newMemberFile, setNewMemberFile] = useState<File | null>(null);
  const [newMemberPreview, setNewMemberPreview] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creditsEditMode, setCreditsEditMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateNotifPref(key: keyof NotifPrefs, value: boolean) {
    setNotifPrefs((prev) => {
      // If turning off push, turn off all sub-toggles too
      const next = key === 'push' && !value
        ? { push: false, orders: false, stock: false }
        : { ...prev, [key]: value };
      // If turning on a sub-toggle, ensure push is on
      if (key !== 'push' && value) next.push = true;
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    async function loadCounts() {
      const [{ count: orders }, { count: products }, { count: users }, { count: stores }] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('stores').select('*', { count: 'exact', head: true }),
      ]);
      setSystemInfo({ orderCount: orders || 0, productCount: products || 0, userCount: users || 0, storeCount: stores || 0 });
    }
    loadCounts();
  }, []);

  // Load team members
  useEffect(() => {
    async function loadTeam() {
      setTeamLoading(true);
      const { data } = await supabase.from('team_members').select('*').order('sort_order');
      setTeamMembers((data as TeamMember[]) || []);
      setTeamLoading(false);
    }
    loadTeam();
  }, []);

  async function handleAvatarUpload(memberId: string, file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploadingId(memberId);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `team/${memberId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('team_members')
        .update({ avatar_url })
        .eq('id', memberId);
      if (dbError) throw dbError;

      setTeamMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, avatar_url } : m));
      toast.success('Photo updated');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingId(null);
    }
  }

  async function handleNameUpdate(memberId: string) {
    const trimmed = editName.trim();
    if (!trimmed) { toast.error('Name cannot be empty'); return; }
    try {
      const { error } = await supabase.from('team_members').update({ name: trimmed }).eq('id', memberId);
      if (error) throw error;
      setTeamMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, name: trimmed } : m));
      setEditingId(null);
      toast.success('Name updated');
    } catch {
      toast.error('Failed to update name');
    }
  }

  async function handleAddMember() {
    const trimmed = newMemberName.trim();
    if (!trimmed) { toast.error('Name is required'); return; }
    setAddingMember(true);
    try {
      const maxSort = teamMembers.reduce((max, m) => Math.max(max, m.sort_order), 0);
      const { data, error } = await supabase
        .from('team_members')
        .insert({ name: trimmed, role: newMemberRole, sort_order: maxSort + 1 })
        .select()
        .single();
      if (error) throw error;
      const member = data as TeamMember;

      // Upload photo if selected
      if (newMemberFile) {
        const ext = newMemberFile.name.split('.').pop() || 'jpg';
        const filePath = `team/${member.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, newMemberFile, { upsert: true, contentType: newMemberFile.type });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
          const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;
          await supabase.from('team_members').update({ avatar_url }).eq('id', member.id);
          member.avatar_url = avatar_url;
        }
      }

      setTeamMembers((prev) => [...prev, member]);
      setNewMemberName('');
      setNewMemberRole('Researcher');
      setNewMemberFile(null);
      setNewMemberPreview(null);
      toast.success('Team member added');
    } catch {
      toast.error('Failed to add team member');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleDeleteMember(memberId: string) {
    setDeletingId(memberId);
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', memberId);
      if (error) throw error;
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success('Team member removed');
    } catch {
      toast.error('Failed to remove team member');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRemoveAvatar(memberId: string) {
    try {
      const { error } = await supabase.from('team_members').update({ avatar_url: null }).eq('id', memberId);
      if (error) throw error;
      setTeamMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, avatar_url: null } : m));
      toast.success('Photo removed');
    } catch {
      toast.error('Failed to remove photo');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = teamMembers.findIndex((m) => m.id === active.id);
    const newIndex = teamMembers.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(teamMembers, oldIndex, newIndex);
    setTeamMembers(reordered);
    // Persist new sort_order
    const updates = reordered.map((m, i) => ({ id: m.id, sort_order: i }));
    try {
      for (const u of updates) {
        await supabase.from('team_members').update({ sort_order: u.sort_order }).eq('id', u.id);
      }
    } catch {
      toast.error('Failed to save order');
    }
  }

  async function handleClearAll() {
    setShowClearConfirm(false);
    try {
      await clearAllProducts();
      toast.success('All products cleared');
    } catch {
      toast.error('Failed to clear products');
    }
  }

  async function handleExport(table: string, label: string) {
    setExporting(table);
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error(`No ${label} data to export`);
        return;
      }
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map((row: Record<string, unknown>) => headers.map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')),
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${table}_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} exported successfully`);
    } catch {
      toast.error(`Failed to export ${label}`);
    } finally {
      setExporting(null);
    }
  }

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'data', label: 'Data', icon: Database },
    { key: 'about', label: 'About', icon: Info },
    { key: 'credits', label: 'Credits', icon: Heart },
  ];

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full flex justify-center">
      <div className="w-full max-w-5xl">
      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-1 max-w-sm mx-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 justify-center',
              activeTab === t.key
                ? 'bg-[#5B9BD5] text-white'
                : 'text-[#8FAABE]/60 hover:text-[#E8EDF2] hover:bg-[#1A3755]'
            )}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* General Tab */}
        {activeTab === 'general' && (
          <>
            {/* Appearance */}
            <div className={sectionCls}>
              <div className={sectionHeaderCls}>
                <Monitor size={14} className="text-[#5B9BD5]" />
                <div>
                  <p className={sectionTitleCls}>Appearance</p>
                  <p className={sectionDescCls}>Customize how the dashboard looks</p>
                </div>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <p className="text-xs text-[#E8EDF2] mb-2">Sidebar Behavior</p>
                  <RadioGroup
                    value={mode}
                    onChange={(v) => setMode(v as SidebarMode)}
                    options={[
                      { value: 'expanded', label: 'Expanded', icon: PanelLeft },
                      { value: 'collapsed', label: 'Collapsed', icon: PanelLeftClose },
                      { value: 'hover', label: 'Hover', icon: MousePointerClick },
                    ]}
                  />
                  <p className="text-[9px] text-[#8FAABE]/35 mt-1.5">
                    {mode === 'expanded' && 'Sidebar stays permanently expanded with labels visible'}
                    {mode === 'collapsed' && 'Sidebar shows icons only, freeing up screen space'}
                    {mode === 'hover' && 'Sidebar expands when you hover over it, collapses when you move away'}
                  </p>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className={sectionCls}>
              <div className={sectionHeaderCls}>
                <Bell size={14} className="text-[#5B9BD5]" />
                <div>
                  <p className={sectionTitleCls}>Notifications</p>
                  <p className={sectionDescCls}>Manage notification preferences</p>
                </div>
              </div>
              <div>
                <div className={itemCls}>
                  <div>
                    <p className={itemLabelCls}>Push Notifications</p>
                    <p className={itemDescCls}>Real-time order and stock alerts via the bell icon</p>
                  </div>
                  <Toggle checked={notifPrefs.push} onChange={(v) => updateNotifPref('push', v)} />
                </div>
                <div className={itemCls}>
                  <div>
                    <p className={cn(itemLabelCls, !notifPrefs.push && 'opacity-40')}>Order Alerts</p>
                    <p className={cn(itemDescCls, !notifPrefs.push && 'opacity-40')}>New orders, status changes</p>
                  </div>
                  <Toggle checked={notifPrefs.orders} onChange={(v) => updateNotifPref('orders', v)} />
                </div>
                <div className={itemCls}>
                  <div>
                    <p className={cn(itemLabelCls, !notifPrefs.push && 'opacity-40')}>Stock Alerts</p>
                    <p className={cn(itemDescCls, !notifPrefs.push && 'opacity-40')}>Low stock and out of stock warnings</p>
                  </div>
                  <Toggle checked={notifPrefs.stock} onChange={(v) => updateNotifPref('stock', v)} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <>
            {/* Export Data */}
            <div className={sectionCls}>
              <div className={sectionHeaderCls}>
                <Download size={14} className="text-[#5B9BD5]" />
                <div>
                  <p className={sectionTitleCls}>Export Data</p>
                  <p className={sectionDescCls}>Download your data as CSV files</p>
                </div>
              </div>
              <div>
                {[
                  { table: 'orders', label: 'Orders', icon: ShoppingCart, desc: `${systemInfo.orderCount} records` },
                  { table: 'products', label: 'Products', icon: Package, desc: `${systemInfo.productCount} records` },
                  { table: 'profiles', label: 'Users', icon: Users, desc: `${systemInfo.userCount} records` },
                  { table: 'stores', label: 'Stores', icon: MapPin, desc: `${systemInfo.storeCount} records` },
                ].map((item) => (
                  <div key={item.table} className={itemCls}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#0D1F33] flex items-center justify-center">
                        <item.icon size={13} className="text-[#5B9BD5]" />
                      </div>
                      <div>
                        <p className={itemLabelCls}>{item.label}</p>
                        <p className={itemDescCls}>{item.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleExport(item.table, item.label)}
                      disabled={exporting === item.table}
                      className="text-[10px] font-medium text-[#5B9BD5] bg-[#5B9BD5]/10 px-2.5 py-1 rounded-md hover:bg-[#5B9BD5]/20 transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      <Download size={10} />
                      {exporting === item.table ? 'Exporting...' : 'Export CSV'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div className={sectionCls}>
              <button
                onClick={() => setDangerOpen(!dangerOpen)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1A3755]/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-[#E06C75]" />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-[#E8EDF2]">Danger Zone</p>
                    <p className="text-[9px] text-[#8FAABE]/40 mt-0.5">Destructive actions that cannot be undone</p>
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  className={cn(
                    'text-[#8FAABE]/50 transition-transform',
                    dangerOpen && 'rotate-180'
                  )}
                />
              </button>

              {dangerOpen && (
                <div className="px-4 pb-4 border-t border-[#1E3F5E]/60">
                  <div className="mt-3 p-3 border border-[#E06C75]/20 rounded-lg bg-[#E06C75]/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#E8EDF2]">Clear All Products</p>
                        <p className="text-[10px] text-[#8FAABE]/50 mt-0.5">
                          Permanently delete all {total} product{total !== 1 ? 's' : ''} from the database. This cannot be undone.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        disabled={total === 0}
                        className="bg-[#162F4D] border border-[#E06C75]/30 text-[#E06C75] text-xs px-3 py-1.5 rounded-md hover:bg-[#E06C75]/10 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ml-4"
                      >
                        <Trash2 size={13} />
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="space-y-4">
              <div className={sectionCls}>
                <div className={sectionHeaderCls}>
                  <Info size={14} className="text-[#5B9BD5]" />
                  <div>
                    <p className={sectionTitleCls}>System Information</p>
                    <p className={sectionDescCls}>Dashboard version and platform details</p>
                  </div>
                </div>
                <div>
                  {[
                    { label: 'Application', value: 'POS Dashboard' },
                    { label: 'Version', value: '1.0.0' },
                    { label: 'Platform', value: 'Web Application' },
                    { label: 'Framework', value: 'React 18' },
                    { label: 'Backend', value: 'Supabase' },
                    { label: 'Currency', value: 'PHP (Philippine Peso)' },
                  ].map((item) => (
                    <div key={item.label} className={itemCls}>
                      <span className="text-[10px] text-[#8FAABE]/60">{item.label}</span>
                      <span className="text-xs text-[#E8EDF2]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Database Overview */}
              <div className={sectionCls}>
                <div className={sectionHeaderCls}>
                  <Database size={14} className="text-[#5B9BD5]" />
                  <div>
                    <p className={sectionTitleCls}>Database Overview</p>
                    <p className={sectionDescCls}>Record counts across all tables</p>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Orders', count: systemInfo.orderCount, icon: ShoppingCart },
                    { label: 'Products', count: systemInfo.productCount, icon: Package },
                    { label: 'Users', count: systemInfo.userCount, icon: Users },
                    { label: 'Stores', count: systemInfo.storeCount, icon: MapPin },
                  ].map((item) => (
                    <div key={item.label} className="bg-[#0D1F33] rounded-lg p-3 border border-[#1E3F5E]/30">
                      <div className="flex items-center gap-2 mb-1">
                        <item.icon size={12} className="text-[#5B9BD5]" />
                        <span className="text-[10px] text-[#8FAABE]/50">{item.label}</span>
                      </div>
                      <p className="text-sm font-bold text-[#E8EDF2] tabular-nums">{item.count.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <div className="space-y-4">
            {/* Team Members */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E3F5E]/60">
              <div className="flex items-center gap-2">
                <Heart size={14} className="text-[#E06C75]" />
                <div>
                  <p className={sectionTitleCls}>Researchers & Developers</p>
                  <p className={sectionDescCls}>The team behind this system</p>
                </div>
              </div>
              <button
                onClick={() => { setCreditsEditMode(!creditsEditMode); setEditingId(null); }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                  creditsEditMode
                    ? 'bg-[#5B9BD5] text-white'
                    : 'text-[#8FAABE]/50 hover:text-[#E8EDF2] hover:bg-[#1A3755]'
                )}
              >
                <Pencil size={10} />
                {creditsEditMode ? 'Done' : 'Edit'}
              </button>
            </div>
            <div className="p-4">
              {teamLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-[#5B9BD5]" />
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={teamMembers.map((m) => m.id)} strategy={rectSortingStrategy} disabled={!creditsEditMode}>
                    <div className="flex flex-wrap justify-center gap-6 max-w-[588px] mx-auto">
                      {teamMembers.map((member) => (
                        <SortableMemberCard
                          key={member.id}
                          member={member}
                          creditsEditMode={creditsEditMode}
                          editingId={editingId}
                          editName={editName}
                          uploadingId={uploadingId}
                          deletingId={deletingId}
                          onEditStart={(id, name) => { setEditingId(id); setEditName(name); }}
                          onEditCancel={() => setEditingId(null)}
                          onEditNameChange={setEditName}
                          onNameSave={handleNameUpdate}
                          onAvatarUpload={handleAvatarUpload}
                          onRemoveAvatar={handleRemoveAvatar}
                          onDelete={handleDeleteMember}
                          fileInputRefs={fileInputRefs}
                        />
                      ))}

                      {/* Add Member Card - only visible in edit mode */}
                      {creditsEditMode && (
                        <div className="bg-[#0D1F33] border-2 border-dashed border-[#1E3F5E]/40 rounded-xl p-5 flex flex-col items-center text-center w-[180px]">
                          <div className="relative flex-shrink-0 mb-4">
                            {newMemberPreview ? (
                              <img
                                src={newMemberPreview}
                                alt="New member"
                                className="w-24 h-24 rounded-full object-cover border-2 border-[#1E3F5E]/60 cursor-pointer"
                                onClick={() => newMemberFileRef.current?.click()}
                              />
                            ) : (
                              <button
                                onClick={() => newMemberFileRef.current?.click()}
                                className="w-24 h-24 rounded-full bg-[#162F4D] border-2 border-dashed border-[#1E3F5E]/60 flex items-center justify-center cursor-pointer hover:border-[#5B9BD5]/50 transition-colors"
                              >
                                <Camera size={24} className="text-[#8FAABE]/30" />
                              </button>
                            )}
                            <input
                              ref={newMemberFileRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setNewMemberFile(file);
                                  setNewMemberPreview(URL.createObjectURL(file));
                                }
                                e.target.value = '';
                              }}
                            />
                          </div>
                          <input
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); }}
                            placeholder="Name"
                            className="w-full bg-[#162F4D] border border-[#1E3F5E]/60 rounded px-2 py-1 text-xs text-[#E8EDF2] text-center outline-none focus:border-[#5B9BD5] mb-2 placeholder:text-[#8FAABE]/30"
                          />
                          <div className="flex gap-1 w-full mb-3">
                            {(['Researcher', 'Developer'] as const).map((role) => (
                              <button
                                key={role}
                                onClick={() => setNewMemberRole(role)}
                                className={cn(
                                  'flex-1 py-1 rounded text-[9px] font-medium transition-colors',
                                  newMemberRole === role
                                    ? 'bg-[#5B9BD5] text-white'
                                    : 'bg-[#162F4D] text-[#8FAABE]/40 hover:text-[#E8EDF2]'
                                )}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={handleAddMember}
                            disabled={addingMember || !newMemberName.trim()}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium bg-[#98C379]/10 text-[#98C379] hover:bg-[#98C379]/20 transition-colors disabled:opacity-40"
                          >
                            {addingMember ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Plus size={10} />
                            )}
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear All Products"
          message="This will permanently delete all products. This cannot be undone."
          confirmLabel="Clear All"
          onConfirm={handleClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
      </div>
    </div>
  );
}
