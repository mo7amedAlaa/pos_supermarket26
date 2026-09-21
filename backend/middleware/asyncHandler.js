// بيلف أي دالة async في كنترولر عشان لو حصل استثناء (throw) يتلقفه
// error handler المركزي في server.js بدل ما نكرر try/catch في كل مكان.
// الكنترولرات الحالية عندها try/catch يدوي وده لسه شغال؛ الأداة دي
// مفيدة لأي كنترولر جديد يتضاف من غير ما ننسى معالجة الأخطاء.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
