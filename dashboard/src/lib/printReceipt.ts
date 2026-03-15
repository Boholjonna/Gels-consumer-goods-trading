/**
 * Prints a receipt by rendering it into a hidden iframe.
 * This ensures the print preview matches the 80mm thermal receipt size
 * instead of showing the full page layout.
 */
export function printReceiptElement(receiptEl: HTMLElement) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '80mm';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<style>
  @page {
    size: 80mm auto;
    margin: 0;
  }
  html, body {
    width: 80mm;
    margin: 0;
    padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  * {
    box-sizing: border-box;
  }
  table {
    display: table !important;
  }
  thead {
    display: table-header-group !important;
  }
  tbody {
    display: table-row-group !important;
  }
  tr {
    display: table-row !important;
  }
  th, td {
    display: table-cell !important;
  }
</style>
</head>
<body>
${receiptEl.outerHTML}
</body>
</html>`);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Clean up after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
  };
}
