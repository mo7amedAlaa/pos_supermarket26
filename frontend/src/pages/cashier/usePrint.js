// Lightweight print helper: opens the receipt markup in a new window with
// minimal receipt-only CSS, then triggers the browser print dialog.
// Avoids pulling in an extra npm package just for printing.
export function useReactToPrintFallback(ref) {
  const print = () => {
    if (!ref.current) return;
    const printWindow = window.open("", "_blank", "width=380,height=600");
    printWindow.document.write(`
      <html lang="ar" dir="rtl">
        <head>
          <title>فاتورة</title>
          <style>
            body { font-family: monospace, sans-serif; width: 300px; margin: 0 auto; padding: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { text-align: right; padding: 2px 4px; }
            hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
            h2 { text-align: center; margin: 4px 0; }
            .receipt-grand-total { font-weight: bold; font-size: 14px; }
            .receipt-thanks { text-align: center; margin-top: 10px; }
          </style>
        </head>
        <body>${ref.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return { print };
}
