import { useState } from 'react';
import { ChevronDown, Trash2, AlertTriangle } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const { total, clearAllProducts } = useProducts();
  const [dangerOpen, setDangerOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  async function handleClearAll() {
    setShowClearConfirm(false);
    try {
      await clearAllProducts();
      toast.success('All products cleared');
    } catch {
      toast.error('Failed to clear products');
    }
  }

  return (
    <div className="p-3 bg-[#f0f4f8] min-h-full">
      <div className="max-w-2xl space-y-3">
        {/* Danger Zone - Collapsible */}
        <div className="bg-white border border-[#e2ecf9] rounded-lg overflow-hidden">
          <button
            onClick={() => setDangerOpen(!dangerOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f8fafd] transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-xs font-semibold text-[#0d1f35]">Sensitive Settings</span>
            </div>
            <ChevronDown
              size={14}
              className={clsx(
                'text-[#8aa0b8] transition-transform',
                dangerOpen && 'rotate-180'
              )}
            />
          </button>

          {dangerOpen && (
            <div className="px-4 pb-4 border-t border-[#e2ecf9]">
              <div className="mt-3 p-3 border border-red-100 rounded-lg bg-red-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#0d1f35]">Clear All Products</p>
                    <p className="text-[10px] text-[#8aa0b8] mt-0.5">
                      Permanently delete all products from the database. This cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={total === 0}
                    className="bg-white border border-red-200 text-red-500 text-xs px-3 py-1.5 rounded-md hover:bg-red-50 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ml-4"
                  >
                    <Trash2 size={13} />
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
  );
}
