const rateLimit = require("express-rate-limit");

// حماية شاشة تسجيل الدخول من محاولات تخمين كلمة المرور (brute force):
// 10 محاولات كحد أقصى كل 15 دقيقة لكل IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "محاولات دخول كتيرة جدًا، حاول تاني بعد شوية" },
  standardHeaders: true,
  legacyHeaders: false,
});

// حد عام أوسع لباقي الـ API عشان يحمي من إساءة استخدام أو سكريبت بيضرب
// السيرفر بسرعة غير طبيعية، من غير ما يأثر على الاستخدام العادي لعدة كاشير.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // 300 طلب في الدقيقة لكل IP - كافي جدًا لعدة شاشات كاشير شغالة بكثافة
  message: { message: "عدد كبير جدًا من الطلبات، حاول تاني بعد لحظات" },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, apiLimiter };
