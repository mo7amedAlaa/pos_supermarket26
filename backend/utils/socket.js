const { Server } = require("socket.io");

let io = null;

function initSocket(httpServer) {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.join("pos");

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
    });
  });

  return io;
}

function emitEvent(eventName, payload) {
  if (!io) {
    console.warn(`Socket.IO is not initialized: ${eventName}`);

    return;
  }

  io.to("pos").emit(eventName, payload);
}

function getIO() {
  return io;
}

module.exports = {
  initSocket,
  emitEvent,
  getIO,
};
