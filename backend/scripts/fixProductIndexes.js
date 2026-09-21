// ---------------------------------------------------------------------------
// سكريبت إصلاح لمرة واحدة — شغّله لو ظهرت رسالة خطأ زي:
//   E11000 duplicate key error ... index: scaleItemCode_1 dup key: { scaleItemCode: "" }
//
// السبب: الإصدار القديم من الموديل كان بيستخدم unique+sparse، وده بيخزن
// قيم "" فاضية بدل ما يشيل الحقل، فأي منتجين معبأين (من غير كود ميزان)
// اتعارضوا مع بعض. السكريبت ده:
//   1) بينضف أي قيمة "" أو مسافات في barcode/scaleItemCode لكل المنتجات
//      الموجودة فعلاً (بيشيل الحقل تمامًا بدل ما يسيبه فاضي).
//   2) بيسقط الـ index القديم الغلط وينشئ الـ partial index الصح
//      (Product.syncIndexes() بيعمل ده أوتوماتيك حسب تعريف الموديل الحالي).
//
// الاستخدام:
//   cd backend
//   node scripts/fixProductIndexes.js
// ---------------------------------------------------------------------------
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("متصل بقاعدة البيانات:", mongoose.connection.name);

  // (1) تنضيف القيم الفاضية في كل المنتجات الموجودة
  const blankBarcode = await Product.updateMany(
    { $or: [{ barcode: "" }, { barcode: { $regex: /^\s*$/ } }] },
    { $unset: { barcode: "" } }
  );
  const blankScaleCode = await Product.updateMany(
    { $or: [{ scaleItemCode: "" }, { scaleItemCode: { $regex: /^\s*$/ } }] },
    { $unset: { scaleItemCode: "" } }
  );
  console.log(`تم تنضيف barcode الفاضي من ${blankBarcode.modifiedCount} منتج`);
  console.log(`تم تنضيف scaleItemCode الفاضي من ${blankScaleCode.modifiedCount} منتج`);

  // (2) إسقاط الـ indexes القديمة الغلط وإنشاء الـ partial indexes الصح
  //     (syncIndexes بيقارن الـ indexes الموجودة في الداتا بيز بتعريف
  //      الموديل الحالي، ويسقط اللي مش مطابق وينشئ الناقص)
  const result = await Product.syncIndexes();
  console.log("نتيجة مزامنة الـ indexes:", result);

  console.log("\n✅ تم الإصلاح. أعد تشغيل السيرفر وجرّب تاني.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ فشل الإصلاح:", err.message);
  process.exit(1);
});
