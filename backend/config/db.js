const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // عدد الاتصالات المتزامنة مع MongoDB - القيمة الافتراضية (100) كافية
      // لمعظم محلات السوبر ماركت حتى مع عدة كاشير وأدمن شغالين في نفس الوقت.
      // كبّرها لو عندك أكتر من 10 شاشات كاشير شغالة بكثافة.
      maxPoolSize: Number(process.env.DB_MAX_POOL_SIZE || 50),
      minPoolSize: Number(process.env.DB_MIN_POOL_SIZE || 5),
      // مهلة اختيار سيرفر مناسب قبل ما نرمي خطأ - تفشل بسرعة بدل ما تعلّق الطلب
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host} (pool: ${conn.connection.readyState})`);
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
