// ---------------------------------------------------------------------------
// باركود الميزان (Scale / Embedded-value barcodes)
// ---------------------------------------------------------------------------
// الموازين في السوبر ماركت بتطبع باركود EAN-13 مدمج فيه الوزن أو السعر.
// الشكل الشائع في مصر وأوروبا (13 رقم):
//
//   2 0 | 1 2 3 4 5 | 0 1 2 5 0 | 7
//   ----   ---------   ---------   -
//   بادئة   كود الصنف   القيمة      checksum
//   (2)      (5)         (5)         (1)
//
// القيمة ممكن تكون:
//   - "weight" : الوزن بالجرام   (01250 = 1.250 كجم)
//   - "price"  : السعر بالقرش     (01250 = 12.50 جنيه)
//
// اضبط الإعدادات دي حسب الميزان اللي عندك في المحل من ملف .env
// ---------------------------------------------------------------------------

const config = {
  // البادئات المقبولة كباركود ميزان (مفصولة بفاصلة في .env)
  prefixes: (process.env.SCALE_BARCODE_PREFIXES || "20,21,22,23,24,25,26,27,28,29")
    .split(",")
    .map((p) => p.trim()),

  // "weight" أو "price"
  embeddedValue: process.env.SCALE_EMBEDDED_VALUE || "weight",

  itemCodeLength: 5,
  valueLength: 5,
};

/**
 * يحاول يفك باركود ميزان.
 * @returns {null | { itemCode, weightKg?, priceEGP? }}
 *          بيرجع null لو الباركود مش باركود ميزان (يعني باركود مصنع عادي).
 */
function parseScaleBarcode(code) {
  const raw = String(code || "").trim();

  // لازم يكون 13 رقم أرقام بس
  if (!/^\d{13}$/.test(raw)) return null;

  const prefix = raw.slice(0, 2);
  if (!config.prefixes.includes(prefix)) return null;

  const itemCode = raw.slice(2, 2 + config.itemCodeLength);
  const valueDigits = raw.slice(
    2 + config.itemCodeLength,
    2 + config.itemCodeLength + config.valueLength
  );
  const value = parseInt(valueDigits, 10);

  if (Number.isNaN(value)) return null;

  if (config.embeddedValue === "price") {
    // القيمة بالقرش -> جنيه
    return { itemCode, priceEGP: value / 100 };
  }

  // القيمة بالجرام -> كيلوجرام
  return { itemCode, weightKg: value / 1000 };
}

module.exports = { parseScaleBarcode, scaleConfig: config };
