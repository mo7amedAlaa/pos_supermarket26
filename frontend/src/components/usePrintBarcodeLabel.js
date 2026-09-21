// بيفتح نافذة طباعة مخصصة لملصقات الباركود، مع دعم طباعة أكتر من نسخة
// (مفيد لو عايز تطبع 20 ملصق لكل قطع كرتونة كاملة مثلًا).
export function usePrintBarcodeLabel(ref) {
  const print = (copies = 1) => {
    if (!ref.current) return;
    const labelHtml = ref.current.outerHTML;
    const printWindow = window.open("", "_blank", "width=400,height=300");

    const labelsHtml = Array.from({ length: Math.max(1, copies) })
      .map(() => `<div class="label-copy">${labelHtml}</div>`)
      .join("");

    printWindow.document.write(`
      <html lang="ar" dir="rtl">
        <head>
          <title>ملصق باركود</title>
          <style>
            body { font-family: Tahoma, sans-serif; margin: 0; padding: 10px; }
            .label-copy {
              display: inline-block; border: 1px dashed #999; border-radius: 4px;
              padding: 8px 12px; margin: 4px; text-align: center; page-break-inside: avoid;
            }
            .barcode-label-name { font-size: 12px; font-weight: bold; margin-bottom: 2px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .barcode-label-price { font-size: 13px; font-weight: bold; margin-top: 2px; }
            svg { display: block; margin: 0 auto; }
          </style>
        </head>
        <body>${labelsHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return { print };
}
