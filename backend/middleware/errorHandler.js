// معالج أخطاء مركزي بيرجع أكواد HTTP ورسائل مناسبة حسب نوع الخطأ الفعلي،
// بدل ما كل خطأ (حتى أخطاء التحقق البسيطة) يترجم لـ 500 عامة.
function errorHandler(err, req, res, next) {
  // متتكررش لو الرد اتبعت فعلًا (نادر لكن ممكن مع streams)
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.message || "خطأ غير متوقع في السيرفر";

  // معرّف MongoDB غير صالح (مثال: /products/123 بدل ObjectId حقيقي)
  if (err.name === "CastError") {
    status = 400;
    message = "معرّف غير صالح";
  }

  // أخطاء التحقق من صحة البيانات في Mongoose (schema validation)
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join("، ");
  }

  // تعارض مفتاح فريد (duplicate key) - زي باركود مستخدم من قبل
  if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyPattern || {})[0] || "قيمة";
    message = `${field} مستخدم بالفعل، اختر قيمة مختلفة`;
  }

  // توكن JWT غير صالح أو منتهي
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    status = 401;
    message = "جلسة الدخول غير صالحة، سجّل الدخول تاني";
  }

  if (status >= 500) {
    // نطبع تفاصيل الخطأ كاملة في اللوج للمطوّر، لكن منرجعش تفاصيل حساسة للعميل
    console.error("خطأ سيرفر:", err);
    message = process.env.NODE_ENV === "production" ? "خطأ غير متوقع في السيرفر" : message;
  }

  res.status(status).json({ message });
}

// أي مسار غير موجود خالص (404) - يتحط بعد كل الـ routes
function notFoundHandler(req, res) {
  res.status(404).json({ message: `المسار غير موجود: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
