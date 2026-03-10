interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-[#e2ecf9]">
        <h3 className="text-sm font-bold text-[#0d1f35] mb-2">{title}</h3>
        <p className="text-xs text-[#4b5e73] mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="bg-white border border-[#dce8f5] text-[#4b5e73] text-xs px-3 py-1.5 rounded-md hover:bg-[#f0f4f8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-600 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
