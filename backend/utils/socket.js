let io = null;

/**
 * يُستدعى مرة واحدة من server.js وقت الإقلاع، بيربط Socket.io بسيرفر HTTP.
 */
function initSocket(httpServer) {
  const { Server } = require("socket.io");

  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 اتصال Realtime جديد:", socket.id);

    // كل عميل (شاشة كاشير أو أدمن) بينضم لغرفة "pos" عشان يستقبل التحديثات
    socket.join("pos");

    socket.on("disconnect", () => {
      console.log("🔌 انقطع اتصال:", socket.id);
    });
  });

  return io;
}

/**
 * يُستخدم من أي كنترولر عشان يبعت حدث للشاشات المتصلة.
 * لو Socket.io لسه ما اتهيأش (مثلاً وقت تشغيل اختبارات)، بيتجاهل الحدث
 * بهدوء بدل ما يوقف الطلب الأساسي.
 */
function emitEvent(eventName, payload) {
  if (!io) return;
  io.to("pos").emit(eventName, payload);
}

module.exports = { initSocket, emitEvent };
