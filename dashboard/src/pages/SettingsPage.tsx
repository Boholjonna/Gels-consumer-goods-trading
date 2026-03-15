import { useState } from 'react';
import { ChevronDown, Trash2, AlertTriangle } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
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
    <div className="p-3 bg-[#0D1F33] min-h-full">
      <div className="max-w-2xl space-y-3">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden">
          <button
            onClick={() => setDangerOpen(!dangerOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1A3755]/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#E06C75]" />
              <span className="text-xs font-semibold text-[#E8EDF2]">Sensitive Settings</span>
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
                      Permanently delete all products from the database. This cannot be undone.
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
