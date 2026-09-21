// ---------------------------------------------------------------------------
// توليد باركود داخلي (EAN-13) للمنتجات اللي مالهاش باركود من المصنع أصلًا
// (زي العيش البلدي، البقالة السايبة، منتجات محلية الصنع).
//
// بنستخدم بادئة "04" - وده رينج محجوز رسميًا في معيار GS1 للاستخدام
// الداخلي/المحلي جوه المتجر نفسه (Restricted Circulation Numbers)، يعني
// مضمون إنه مش هيتعارض مع أي باركود حقيقي مطبوع من مصنع فعلي.
//
// ملحوظة: بادئة 20-29 محجوزة بالفعل عندنا لباركود الميزان (شوف
// scaleBarcode.js)، فاخترنا 04 عشان نتجنب أي تداخل بين النوعين.
// ---------------------------------------------------------------------------

const INTERNAL_PREFIX = "04";

/**
 * يحسب رقم التحقق (check digit) لباركود EAN-13 حسب الخوارزمية الرسمية.
 * @param {string} first12Digits - أول 12 رقم من الباركود
 */
function calculateEAN13CheckDigit(first12Digits) {
  const digits = first12Digits.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit;
}

/**
 * يولّد باركود EAN-13 داخلي كامل وصالح من رقم تسلسلي.
 * @param {number} sequenceNumber - رقم تسلسلي فريد (من Counter)
 * @returns {string} باركود من 13 رقم بما فيهم رقم التحقق
 */
function generateInternalBarcode(sequenceNumber) {
  // 10 خانات للرقم التسلسلي بعد البادئة (04) = 12 رقم قبل رقم التحقق
  const sequencePart = String(sequenceNumber).padStart(10, "0");
  if (sequencePart.length > 10) {
    throw new Error("انتهت أرقام الباركود الداخلي المتاحة (تجاوزت 10 مليار منتج!)");
  }
  const first12 = INTERNAL_PREFIX + sequencePart;
  const checkDigit = calculateEAN13CheckDigit(first12);
  return first12 + checkDigit;
}

module.exports = { generateInternalBarcode, calculateEAN13CheckDigit, INTERNAL_PREFIX };
