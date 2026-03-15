interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#162F4D] rounded-lg max-w-sm w-full p-5 shadow-lg border border-[#1E3F5E]/60">
        <h3 className="text-sm font-semibold text-[#E8EDF2] mb-2">{title}</h3>
        <p className="text-xs text-[#8FAABE]/60 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="bg-[#162F4D] border border-[#1E3F5E]/60 text-[#E8EDF2]/80 text-xs px-3 py-1.5 rounded-md hover:bg-[#1A3755] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-[#E06C75] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[#D45F68] transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
