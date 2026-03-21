import type { Order } from '@/types';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';

interface CompanyOverride {
  company_name?: string | null;
  address?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

interface PrintableReceiptProps {
  order: Order;
  companyOverride?: CompanyOverride;
}

const s = {
  root: {
    fontFamily: "'Courier New', Courier, monospace",
    padding: '6px 8px',
    maxWidth: '58mm',
    margin: '0 auto',
    color: '#000',
    fontSize: '8px',
    lineHeight: 1.25,
    fontWeight: 'bold' as const,
  },
  center: { textAlign: 'center' as const },
  bold: { fontWeight: 900 as const },
  companyName: {
    fontSize: '9px',
    fontWeight: 900 as const,
    textTransform: 'uppercase' as const,
    textAlign: 'left' as const,
    marginBottom: '1px',
  },
  addressLine: {
    fontSize: '7px',
    textAlign: 'left' as const,
    lineHeight: 1.3,
    fontWeight: 'bold' as const,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '8px',
    marginTop: '6px',
    marginBottom: '2px',
    fontWeight: 900 as const,
  },
  receiptLabel: { fontWeight: 900 as const },
  receiptNumber: { fontWeight: 900 as const },
  dateRow: {
    textAlign: 'right' as const,
    fontSize: '8px',
    marginBottom: '4px',
    fontWeight: 'bold' as const,
  },
  infoRow: {
    fontSize: '8px',
    marginBottom: '1px',
    fontWeight: 'bold' as const,
  },
  infoLabel: { fontWeight: 900 as const },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '7.5px',
    marginTop: '3px',
    border: '1px solid #000',
    fontWeight: 'bold' as const,
  },
  thLeft: {
    textAlign: 'left' as const,
    fontWeight: 900 as const,
    padding: '2px',
    border: '1px solid #000',
  },
  thCenter: {
    textAlign: 'center' as const,
    fontWeight: 900 as const,
    padding: '2px',
    border: '1px solid #000',
  },
  thRight: {
    textAlign: 'right' as const,
    fontWeight: 900 as const,
    padding: '2px',
    border: '1px solid #000',
  },
  tableHeaderRow: {
    border: '1px solid #000',
  },
  tdLeft: {
    textAlign: 'left' as const,
    padding: '2px',
    verticalAlign: 'top' as const,
    fontWeight: 'bold' as const,
  },
  tdCenter: {
    textAlign: 'center' as const,
    padding: '2px',
    verticalAlign: 'top' as const,
    whiteSpace: 'nowrap' as const,
    fontWeight: 'bold' as const,
  },
  tdRight: {
    textAlign: 'right' as const,
    padding: '2px',
    verticalAlign: 'top' as const,
    whiteSpace: 'nowrap' as const,
    fontWeight: 'bold' as const,
  },
  totalRow: {
    textAlign: 'right' as const,
    fontSize: '9px',
    fontWeight: 900 as const,
    marginTop: '6px',
    paddingTop: '3px',
  },
  signatureSection: {
    marginTop: '12px',
    fontSize: '7px',
    padding: '6px',
    fontWeight: 'bold' as const,
  },
  signatureText: {
    fontSize: '7px',
    marginBottom: '12px',
    lineHeight: 1.3,
    textAlign: 'left' as const,
    fontWeight: 'bold' as const,
  },
  signatureRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    fontSize: '7px',
    fontWeight: 'bold' as const,
  },
  signatureBox: {
    flex: 1,
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  signatureLine: {
    borderBottom: '1px solid #000',
    width: '100%',
    minHeight: '16px',
    marginBottom: '2px',
  },
  signatureLabel: {
    fontSize: '6px',
    textAlign: 'center' as const,
    fontWeight: 'bold' as const,
  },
} as const;

export function PrintableReceipt({ order, companyOverride }: PrintableReceiptProps) {
  const { profile } = useCompanyProfile();

  const co = companyOverride || {};
  const companyName = co.company_name ?? profile?.company_name ?? 'Gels consumer goods trading';
  const address = co.address ?? profile?.address ?? 'Purok Tambis, Curvada\nSan Remigio Cebu, PhIlippines, 6011';
  const phone = co.contact_phone ?? profile?.contact_phone ?? 'Tel.(032)3167836/0936-9445027';

  // Format date as MM/DD/YYYY
  const formatReceiptDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Format quantity - simple number
  const formatQuantity = (qty: number) => {
    return qty.toString();
  };

  // Format currency without currency symbol, just comma separator
  const formatPrice = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div id="printable-receipt" style={s.root}>
      {/* Header - Company Info */}
      <div className="receipt-section" style={{ textAlign: 'left', marginBottom: '3px' }}>
        <div style={s.companyName}>{companyName}</div>
        {address.split('\n').map((line, i) => (
          <div key={i} style={s.addressLine}>
            {line}
          </div>
        ))}
        {phone && <div style={s.addressLine}>{phone}</div>}
      </div>

      {/* Receipt Type and Number */}
      <div style={s.headerRow}>
        <span style={s.receiptLabel}>DELIVERY RECEIPT</span>
        <span style={s.receiptNumber}>{order.order_number}</span>
      </div>

      {/* Date */}
      <div style={s.dateRow}>Date: {formatReceiptDate(order.created_at)}</div>

      {/* Delivery Info */}
      <div style={s.infoRow}>
        <span style={s.infoLabel}>Delivered to: </span>
        {order.stores?.name || '_________________'}
      </div>
      <div style={s.infoRow}>
        <span style={s.infoLabel}>Address: </span>
        {order.stores?.address || '_________________'}
      </div>
      <div style={s.infoRow}>
        <span style={s.infoLabel}>TERMS: ________</span>
      </div>

      {/* Item Table */}
      <table style={s.table}>
        <thead>
          <tr style={s.tableHeaderRow}>
            <th style={s.thLeft}>Description</th>
            <th style={s.thCenter}>Qty</th>
            <th style={s.thRight}>Price</th>
            <th style={s.thRight}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items?.map((item) => (
            <tr key={item.id}>
              <td style={s.tdLeft}>{item.product_name}</td>
              <td style={s.tdCenter}>{formatQuantity(item.quantity)}</td>
              <td style={s.tdRight}>{formatPrice(item.unit_price)}</td>
              <td style={s.tdRight}>{formatPrice(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Total */}
      <div style={s.totalRow}>Total = {formatPrice(order.total_amount)}</div>

      {/* Signature Section */}
      <div style={s.signatureSection}>
        <div style={s.signatureText}>
          Received the above goods and services<br />in good order and condition
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <span style={{ whiteSpace: 'nowrap', fontSize: '7px', paddingBottom: '2px', fontWeight: 'bold' }}>By:</span>
          <div style={{ flex: 1, borderBottom: '1px solid #000', minHeight: '16px' }}></div>
          <div style={{ flex: 1, borderBottom: '1px solid #000', minHeight: '16px' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
          <span style={{ whiteSpace: 'nowrap', fontSize: '7px', visibility: 'hidden' }}>By:</span>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '6px', fontWeight: 'bold' }}>Authorized Signature</div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '6px', fontWeight: 'bold' }}>Customer's Signature Over Printed Name</div>
        </div>
      </div>
    </div>
  );
}
