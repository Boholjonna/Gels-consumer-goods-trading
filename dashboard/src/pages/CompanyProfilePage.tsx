import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { PrintableReceipt } from '@/components/PrintableReceipt';
import type { Order } from '@/types';
import toast from 'react-hot-toast';

const inputCls =
  'w-full border border-[#1E3F5E]/60 rounded-md px-3 py-2 text-xs bg-[#0D1F33] text-[#E8EDF2] placeholder-[#8FAABE]/40 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] transition-colors';
const labelCls = 'block text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider mb-1.5';

const MOCK_ORDER: Order = {
  id: 'preview',
  order_number: 'ORD-20260315-0001',
  collector_id: '',
  store_id: '',
  status: 'completed',
  subtotal: 2850,
  tax_amount: 0,
  total_amount: 2850,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  profiles: { full_name: 'Juan Dela Cruz', email: 'juan@example.com', nickname: 'Juan' },
  stores: { name: 'Sample Store', address: '123 Main St.' },
  order_items: [
    { id: '1', order_id: 'preview', product_id: 'p1', product_name: 'Product Alpha', quantity: 10, unit_price: 150, line_total: 1500, created_at: '' },
    { id: '2', order_id: 'preview', product_id: 'p2', product_name: 'Product Beta', quantity: 5, unit_price: 200, line_total: 1000, created_at: '' },
    { id: '3', order_id: 'preview', product_id: 'p3', product_name: 'Product Gamma', quantity: 7, unit_price: 50, line_total: 350, created_at: '' },
  ],
};

interface FormState {
  company_name: string;
  address: string;
  contact_phone: string;
  contact_email: string;
  receipt_footer: string;
}

export function CompanyProfilePage() {
  const { profile, loading, error, updateProfile } = useCompanyProfile();
  const [form, setForm] = useState<FormState>({
    company_name: '',
    address: '',
    contact_phone: '',
    contact_email: '',
    receipt_footer: '',
  });
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (profile && !initialized) {
      setForm({
        company_name: profile.company_name || '',
        address: profile.address || '',
        contact_phone: profile.contact_phone || '',
        contact_email: profile.contact_email || '',
        receipt_footer: profile.receipt_footer || '',
      });
      setInitialized(true);
    }
  }, [profile, initialized]);

  function handleChange(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        company_name: form.company_name || null,
        address: form.address || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        receipt_footer: form.receipt_footer || null,
      });
      toast.success('Company profile saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
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

  const companyOverride = {
    company_name: form.company_name || null,
    address: form.address || null,
    contact_phone: form.contact_phone || null,
    contact_email: form.contact_email || null,
    receipt_footer: form.receipt_footer || null,
  };

  return (
    <div className="p-3 bg-[#0D1F33] min-h-full">
      <div className="flex flex-col lg:flex-row gap-4 justify-center max-w-4xl mx-auto">
        {/* Left — Company Details Form */}
        <div className="flex-1 max-w-md mx-auto lg:mx-0 w-full">
          <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-lg p-5">
            <p className="text-xs font-semibold text-[#E8EDF2] mb-4">Company Details</p>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Company Name</label>
                <input
                  className={inputCls}
                  value={form.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className={labelCls}>Address</label>
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Enter company address"
                />
              </div>

              <div>
                <label className={labelCls}>Contact Phone</label>
                <input
                  className={inputCls}
                  value={form.contact_phone}
                  onChange={(e) => handleChange('contact_phone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className={labelCls}>Contact Email</label>
                <input
                  className={inputCls}
                  value={form.contact_email}
                  onChange={(e) => handleChange('contact_email', e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className={labelCls}>Receipt Footer / Terms</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.receipt_footer}
                  onChange={(e) => handleChange('receipt_footer', e.target.value)}
                  placeholder="Enter receipt footer text or terms"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 w-full bg-[#5B9BD5] text-white text-xs py-2 rounded-md hover:bg-[#4A8BC4] flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <Save size={13} />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {profile?.updated_at && (
            <p className="text-[10px] text-[#8FAABE]/40 mt-2 text-right">
              Last updated: {new Date(profile.updated_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* Right — Receipt Preview */}
        <div className="lg:w-[340px] flex-shrink-0">
          <p className="text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider mb-2 text-center">
            Receipt Preview
          </p>
          <div className="bg-white rounded-lg shadow-lg border border-[#1E3F5E]/20 overflow-hidden">
            <PrintableReceipt order={MOCK_ORDER} companyOverride={companyOverride} />
          </div>
          <p className="text-[10px] text-[#8FAABE]/30 mt-2 text-center">
            This preview updates as you edit the fields
          </p>
        </div>
      </div>
    </div>
  );
}
