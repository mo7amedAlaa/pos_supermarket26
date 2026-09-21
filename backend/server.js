require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { initSocket } = require("./utils/socket");
const { apiLimiter } = require("./middleware/rateLimiters");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

const isProd = process.env.NODE_ENV === "production";

connectDB();

const app = express();

// خلف بروكسي/لود بالانسر (nginx, Heroku, ...) عشان express-rate-limit
// ياخد الـ IP الحقيقي للعميل مش IP البروكسي
if (isProd) app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(isProd ? "combined" : "dev"));
app.use("/api", apiLimiter);

// نقطة فحص صحة السيرفر - تستخدمها أدوات المراقبة (uptime monitors,
// load balancer health checks) عشان تعرف السيرفر شغال وقاعدة البيانات متصلة
app.get("/api/health", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    db: dbStates[mongoose.connection.readyState] || "unknown",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/invoices", invoiceRoutes);

app.get("/", (req, res) => res.send("POS Supermarket API is running"));

app.use(notFoundHandler);
app.use(errorHandler);

// بنستخدم http.Server صراحة عشان نركّب Socket.io على نفس البورت
// ونشارك نفس السيرفر بين REST وWebSocket.
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server (HTTP + Realtime) running on port ${PORT}`));

// ---------------------------------------------------------------------------
// إغلاق نظيف (Graceful Shutdown): لو السيرفر اتوقف (إعادة نشر، إعادة تشغيل
// الخادم، Ctrl+C) بنسيب الطلبات الجارية تخلص وبنقفل الاتصال بقاعدة البيانات
// بدل ما نقطعه فجأة - ده بيمنع فقدان أو تلف بيانات فاتورة نص متسجلة.
// ---------------------------------------------------------------------------
const shutdown = (signal) => {
  console.log(`\n${signal} استلمت - جاري الإغلاق بأمان...`);
  server.close(async () => {
    console.log("تم إغلاق السيرفر عن استقبال طلبات جديدة");
    try {
      await mongoose.connection.close();
      console.log("تم قفل الاتصال بقاعدة البيانات");
    } finally {
      process.exit(0);
    }
  });

  // لو الإغلاق النظيف علّق لأي سبب، نجبر الإغلاق بعد 10 ثواني
  setTimeout(() => {
    console.error("الإغلاق النظيف أخد وقت أطول من اللازم - إغلاق إجباري");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// أي خطأ غير متوقع خالص (لم يُلتقط في أي مكان) - نسجّله ونطلع بأمان
// بدل ما السيرفر يفضل شغال في حالة غير مستقرة
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  shutdown("uncaughtException");
});
