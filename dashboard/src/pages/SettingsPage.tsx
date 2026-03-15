import { useState, useEffect } from 'react';
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
} from 'lucide-react';
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

type SettingsTab = 'general' | 'data' | 'about';

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

export function SettingsPage() {
  const { total, clearAllProducts } = useProducts();
  const { mode, setMode } = useSidebar();
  const [dangerOpen, setDangerOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({ orderCount: 0, productCount: 0, userCount: 0, storeCount: 0 });
  const [exporting, setExporting] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadNotifPrefs);

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
  ];

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full flex justify-center">
      <div className="w-full max-w-5xl">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-sm font-bold text-[#E8EDF2]">Settings</h1>
        <p className="text-[10px] text-[#8FAABE]/50">Manage your dashboard preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-1 max-w-sm">
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

      <div className="max-w-2xl space-y-4">
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
          <>
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
              <div className="p-4 grid grid-cols-2 gap-3">
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
          </>
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
