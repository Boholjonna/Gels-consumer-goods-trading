import { useState } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import toast from 'react-hot-toast';

interface FieldDef {
  key: 'company_name' | 'address' | 'contact_phone' | 'contact_email' | 'receipt_footer';
  label: string;
  placeholder: string;
  multiline?: boolean;
}

const fields: FieldDef[] = [
  { key: 'company_name', label: 'Company Name', placeholder: 'Enter company name' },
  { key: 'address', label: 'Address', placeholder: 'Enter company address' },
  { key: 'contact_phone', label: 'Contact Phone', placeholder: 'Enter phone number' },
  { key: 'contact_email', label: 'Contact Email', placeholder: 'Enter email address' },
  { key: 'receipt_footer', label: 'Receipt Footer / Terms', placeholder: 'Enter receipt footer text or terms', multiline: true },
];

type FieldKey = FieldDef['key'];

const inputCls = 'border border-[#1E3F5E]/60 rounded-md px-2.5 py-1.5 text-xs bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] flex-1';

export function CompanyProfilePage() {
  const { profile, loading, error, updateProfile } = useCompanyProfile();
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit(key: FieldKey) {
    setEditingField(key);
    setEditValue((profile?.[key] ?? '') as string);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue('');
  }

  async function saveField(key: FieldKey) {
    setSaving(true);
    try {
      await updateProfile({ [key]: editValue || null });
      toast.success('Updated successfully');
      setEditingField(null);
      setEditValue('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-3 bg-[#0D1F33] min-h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5B9BD5]" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-[#0D1F33] min-h-full">
        <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-6 text-center">
          <p className="text-xs text-[#E06C75]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg overflow-hidden max-w-2xl">
        {fields.map((field, idx) => {
          const isEditing = editingField === field.key;
          const value = (profile?.[field.key] ?? null) as string | null;

          return (
            <div
              key={field.key}
              className={`px-4 py-3 ${idx < fields.length - 1 ? 'border-b border-[#1E3F5E]/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider mb-1.5">
                    {field.label}
                  </p>
                  {isEditing ? (
                    <div className="flex items-start gap-2">
                      {field.multiline ? (
                        <textarea
                          className={`${inputCls} resize-none`}
                          rows={3}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={field.placeholder}
                          autoFocus
                        />
                      ) : (
                        <input
                          className={inputCls}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={field.placeholder}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveField(field.key);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      )}
                      <button
                        onClick={() => saveField(field.key)}
                        disabled={saving}
                        className="p-1.5 text-[#98C379] hover:bg-[#98C379]/10 rounded-md transition-colors"
                      >
                        {saving ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 text-[#8FAABE]/50 hover:text-[#E8EDF2] hover:bg-[#1A3755] rounded-md transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <p className={`text-xs ${value ? 'text-[#E8EDF2]' : 'text-[#8FAABE]/40 italic'}`}>
                      {value || 'Not set'}
                    </p>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(field.key)}
                    className="p-1.5 text-[#8FAABE]/40 hover:text-[#5B9BD5] hover:bg-[#1A3755] rounded-md transition-colors mt-4"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {profile?.updated_at && (
        <p className="text-[10px] text-[#8FAABE]/40 mt-3 max-w-2xl text-right">
          Last updated: {new Date(profile.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
