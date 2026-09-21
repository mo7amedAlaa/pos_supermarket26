const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// عدّاد تسلسلي بسيط بيُستخدم لتوليد أرقام باركود داخلية فريدة بأمان حتى
// لو اتنين أدمن ضغطوا "توليد باركود" في نفس اللحظة بالظبط. الأمان هنا
// جاي من findOneAndUpdate + $inc اللي هو عملية ذرية (atomic) في MongoDB
// نفسها - مفيش احتمال إن اتنين ياخدوا نفس الرقم زي ما ممكن يحصل لو
// قرينا آخر رقم وزودنا عليه في كود التطبيق (race condition كلاسيكي).
// ---------------------------------------------------------------------------
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // اسم العدّاد، مثال: "internal_barcode"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { Counter, getNextSequence };
