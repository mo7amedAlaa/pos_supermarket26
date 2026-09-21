import { io } from "socket.io-client";

let socket = null;

// نتصل بنفس عنوان السيرفر اللي الـ API شغال عليه. في وضع التطوير Vite
// بيعمل proxy لـ /api على localhost:5000، لكن Socket.io محتاج العنوان
// الصريح للسيرفر (مش مسار نسبي زي axios).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
