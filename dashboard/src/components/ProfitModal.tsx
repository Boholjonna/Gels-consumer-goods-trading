import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { printReceiptElement } from '@/lib/printReceipt';
import { RECEIPT_FONT_FAMILY } from '@/lib/receiptPrintFont';
import toast from 'react-hot-toast';

interface ProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  productBreakdown: Array<{
    product_name: string;
    quantity: number;
    profit_per_unit: number;
    total_profit: number;
  }>;
  totalProfit: number;
  selectedDate: Date;
}

export function ProfitModal({ isOpen, onClose, productBreakdown, totalProfit, selectedDate }: ProfitModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (printRef.current) {
      const receiptEl = printRef.current.querySelector('#profit-receipt-content') as HTMLElement;
      if (receiptEl) {
        printReceiptElement(receiptEl);
      } else {
        toast.error('Receipt is not ready');
      }
    }
  };

  const formatReceiptDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatPrice = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#162F4D] border border-[#1E3F5E]/60 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E3F5E]/30">
          <h2 className="text-lg font-bold text-[#E8EDF2]">Daily Profit Breakdown</h2>
          <button
            onClick={onClose}
            className="p-1 text-[#8FAABE]/50 hover:text-[#E8EDF2] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-3 border-b border-[#1E3F5E]/30 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#5B9BD5] text-white text-xs rounded-md hover:bg-[#4A8BC4] transition-colors font-medium"
          >
            <Printer size={14} />
            Generate Receipt
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Summary */}
          <div className="bg-[#98C379]/10 border border-[#98C379]/20 rounded-lg p-4 mb-4">
            <p className="text-[10px] text-[#8FAABE]/50 uppercase tracking-wider mb-2">Total Profit</p>
            <p className="text-2xl font-bold text-[#98C379]">{formatCurrency(totalProfit)}</p>
          </div>

          {/* Product breakdown table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E3F5E]/60">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="text-center px-3 py-2 text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider">
                    Profit/Unit
                  </th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#8FAABE]/50 uppercase tracking-wider">
                    Total Profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {productBreakdown.map((product) => (
                  <tr key={product.product_name} className="border-b border-[#1E3F5E]/30 hover:bg-[#1A3755]/30 transition-colors">
                    <td className="px-3 py-2 text-xs text-[#E8EDF2]">{product.product_name}</td>
                    <td className="px-3 py-2 text-xs text-[#E8EDF2] text-center">{product.quantity}</td>
                    <td className="px-3 py-2 text-xs text-[#98C379] text-right">
                      {formatCurrency(product.profit_per_unit)}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#98C379] font-semibold text-right">
                      {formatCurrency(product.total_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Hidden print receipt */}
        <div ref={printRef} style={{ display: 'none' }}>
          <div id="profit-receipt-content" style={{ fontFamily: RECEIPT_FONT_FAMILY, padding: '6px 8px', maxWidth: '58mm', margin: '0 auto', color: '#000', fontSize: '8px', lineHeight: 1.25, fontWeight: 'bold' }}>
            <div style={{ textAlign: 'left', marginBottom: '3px', fontSize: '9.9px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              DAILY PROFIT REPORT
            </div>
            <div style={{ fontSize: '8px', marginBottom: '6px', fontWeight: 'bold' }}>
              Date: {formatReceiptDate(selectedDate)}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5px', marginTop: '3px', border: '1px solid #000', fontWeight: 'bold' }}>
              <thead>
                <tr style={{ border: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', fontWeight: 900, padding: '2px', border: '1px solid #000' }}>Description</th>
                  <th style={{ textAlign: 'center', fontWeight: 900, padding: '2px', border: '1px solid #000' }}>Qty</th>
                  <th style={{ textAlign: 'right', fontWeight: 900, padding: '2px', border: '1px solid #000' }}>Profit/Unit</th>
                  <th style={{ textAlign: 'right', fontWeight: 900, padding: '2px', border: '1px solid #000' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {productBreakdown.map((product) => (
                  <tr key={product.product_name} style={{ border: '1px solid #000' }}>
                    <td style={{ textAlign: 'left', padding: '2px', border: '1px solid #000', fontWeight: 'bold' }}>{product.product_name}</td>
                    <td style={{ textAlign: 'center', padding: '2px', border: '1px solid #000', fontWeight: 'bold' }}>{product.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '2px', border: '1px solid #000', fontWeight: 'bold' }}>{formatPrice(product.profit_per_unit)}</td>
                    <td style={{ textAlign: 'right', padding: '2px', border: '1px solid #000', fontWeight: 'bold' }}>{formatPrice(product.total_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', fontSize: '9px', fontWeight: 900, marginTop: '6px', paddingTop: '3px' }}>
              Total Profit = {formatPrice(totalProfit)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
