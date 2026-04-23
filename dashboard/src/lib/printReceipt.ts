import { getReceiptPrintFontCss, RECEIPT_FONT_FAMILY, waitForReceiptFonts } from '@/lib/receiptPrintFont';
import toast from 'react-hot-toast';

/**
 * Prints a receipt by rendering it into a hidden iframe.
 * Uses thermal receipt paper size (58mm width) with auto height
 * for proper rendering of delivery receipts.
 */
export function printReceiptElement(receiptEl: HTMLElement) {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '58mm';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      toast.error('Failed to initialize print dialog');
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${getReceiptPrintFontCss()}
  @page {
    size: 58mm auto;
    margin: 2mm;
  }
  html, body {
    width: 58mm;
    margin: 0;
    padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: ${RECEIPT_FONT_FAMILY};
  }
  * {
    box-sizing: border-box;
  }
  table {
    display: table !important;
    page-break-inside: auto !important;
  }
  thead {
    display: table-header-group !important;
  }
  tbody {
    display: table-row-group !important;
  }
  tr {
    display: table-row !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  th, td {
    display: table-cell !important;
  }
  .receipt-section {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .receipt-page {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 4mm);
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
  }
  .receipt-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .receipt-container {
    display: block !important;
  }
</style>
</head>
<body>
${receiptEl.innerHTML}
</body>
</html>`);
    doc.close();

    let printed = false;

    const triggerPrint = async () => {
      if (printed) return;
      printed = true;

      try {
        await waitForReceiptFonts(doc.fonts);
      } catch (err) {
        console.warn('Font loading failed, proceeding with print anyway', err);
      }

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          toast.success('Print dialog opened');
        } catch (err) {
          console.error('Print failed:', err);
          toast.error('Failed to open print dialog');
        }
        // Clean up after print dialog closes
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          } catch (err) {
            console.warn('Error removing iframe:', err);
          }
        }, 1000);
      }, 100);
    };

    iframe.onload = () => {
      void triggerPrint();
    };

    // Fallback if iframe loads synchronously
    if (doc.readyState === 'complete') {
      void triggerPrint();
    }
  } catch (err) {
    console.error('Print receipt error:', err);
    toast.error('Failed to prepare receipt for printing');
  }
}
