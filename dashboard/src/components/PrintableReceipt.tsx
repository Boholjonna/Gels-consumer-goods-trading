import type { Order } from '@/types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';

interface CompanyOverride {
  company_name?: string | null;
  address?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  receipt_footer?: string | null;
}

interface PrintableReceiptProps {
  order: Order;
  companyOverride?: CompanyOverride;
}

const DASH = '------------------------------------------------';

const s = {
  root: {
    fontFamily: "'Courier New', Courier, monospace",
    padding: '8px 10px',
    maxWidth: '300px',
    margin: '0 auto',
    color: '#000',
    fontSize: '11px',
    lineHeight: 1.4,
  },
  center: { textAlign: 'center' as const },
  bold: { fontWeight: 'bold' as const },
  divider: {
    textAlign: 'center' as const,
    fontSize: '11px',
    color: '#444',
    margin: '4px 0',
    overflow: 'hidden' as const,
    whiteSpace: 'nowrap' as const,
    letterSpacing: '-0.5px',
  },
  companyName: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    textAlign: 'center' as const,
  },
  subText: { fontSize: '10px', textAlign: 'center' as const },
  metaRow: { display: 'flex', justifyContent: 'space-between', gap: '4px' },
  metaLabel: { fontWeight: 'bold' as const, whiteSpace: 'nowrap' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '11px' },
  thLeft: { textAlign: 'left' as const, fontWeight: 'bold' as const, paddingBottom: '2px', borderBottom: '1px solid #000' },
  thCenter: { textAlign: 'center' as const, fontWeight: 'bold' as const, paddingBottom: '2px', borderBottom: '1px solid #000' },
  thRight: { textAlign: 'right' as const, fontWeight: 'bold' as const, paddingBottom: '2px', borderBottom: '1px solid #000' },
  tdLeft: { textAlign: 'left' as const, paddingTop: '2px', paddingBottom: '2px', verticalAlign: 'top' as const },
  tdCenter: { textAlign: 'center' as const, paddingTop: '2px', paddingBottom: '2px', verticalAlign: 'top' as const },
  tdRight: { textAlign: 'right' as const, paddingTop: '2px', paddingBottom: '2px', verticalAlign: 'top' as const },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '11px' },
  grandTotal: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' as const },
  sigLine: { borderBottom: '1px solid #000', minHeight: '24px' },
  sigLabel: { textAlign: 'center' as const, fontSize: '10px', paddingTop: '2px' },
  footer: { textAlign: 'center' as const, fontSize: '9px', color: '#444', marginTop: '8px', whiteSpace: 'pre-wrap' as const },
} as const;

export function PrintableReceipt({ order, companyOverride }: PrintableReceiptProps) {
  const { profile } = useCompanyProfile();

  const co = companyOverride || {};
  const companyName = co.company_name ?? profile?.company_name ?? 'Company Name';
  const address = co.address ?? profile?.address;
  const phone = co.contact_phone ?? profile?.contact_phone;
  const email = co.contact_email ?? profile?.contact_email;
  const footerText = co.receipt_footer ?? profile?.receipt_footer;

  return (
    <div id="printable-receipt" style={s.root}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={s.companyName}>{companyName}</div>
        {address && <div style={s.subText}>{address}</div>}
        {phone && <div style={s.subText}>Tel: {phone}</div>}
        {email && <div style={s.subText}>{email}</div>}
      </div>

      <div style={s.divider}>{DASH}</div>

      {/* Order Metadata */}
      <div style={{ margin: '4px 0' }}>
        <div style={s.metaRow}>
          <span style={s.metaLabel}>Order:</span>
          <span>{order.order_number}</span>
        </div>
        <div style={s.metaRow}>
          <span style={s.metaLabel}>Date:</span>
          <span>{formatDate(order.created_at)}</span>
        </div>
        {order.profiles?.full_name && (
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Collector:</span>
            <span>{order.profiles.full_name}</span>
          </div>
        )}
        {order.stores?.name && (
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Store:</span>
            <span>{order.stores.name}</span>
          </div>
        )}
      </div>

      <div style={s.divider}>{DASH}</div>

      {/* Item List */}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.thLeft}>Item</th>
            <th style={s.thCenter}>Qty</th>
            <th style={s.thRight}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items?.map((item) => (
            <tr key={item.id}>
              <td style={s.tdLeft}>{item.product_name}</td>
              <td style={s.tdCenter}>{item.quantity}</td>
              <td style={s.tdRight}>{formatCurrency(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={s.divider}>{DASH}</div>

      {/* Totals */}
      <div style={{ margin: '4px 0' }}>
        <div style={s.totalRow}>
          <span>Subtotal</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        <div style={s.totalRow}>
          <span>Tax</span>
          <span>{formatCurrency(order.tax_amount)}</span>
        </div>
        <div style={{ ...s.grandTotal, marginTop: '2px', paddingTop: '2px', borderTop: '1px solid #000' }}>
          <span>TOTAL</span>
          <span>{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      {order.notes && (
        <>
          <div style={s.divider}>{DASH}</div>
          <div style={{ fontSize: '10px', margin: '4px 0' }}>
            <span style={s.bold}>Notes:</span> {order.notes}
          </div>
        </>
      )}

      <div style={s.divider}>{DASH}</div>

      {/* Signature Lines */}
      <div style={{ margin: '20px 0 8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '45%' }}><div style={s.sigLine} /></td>
              <td style={{ width: '10%' }} />
              <td style={{ width: '45%' }}><div style={s.sigLine} /></td>
            </tr>
            <tr>
              <td style={s.sigLabel}>Received By</td>
              <td />
              <td style={s.sigLabel}>Prepared By</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        {footerText || 'Thank you for your order!'}
      </div>
    </div>
  );
}
