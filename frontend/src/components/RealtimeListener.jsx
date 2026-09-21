import { useEffect } from "react";
import { getSocket } from "../api/socket";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import useRealtimeCacheSync from "../hooks/useRealtimeCacheSync";

// مكوّن بدون واجهة (headless) - بيفضل شغال في الخلفية طول ما المستخدم
// داخل النظام، ويسمع لأحداث Realtime القادمة من السيرفر عبر Socket.io.
export default function RealtimeListener() {
  const { addToast } = useToast();
  const { user } = useAuth();

  // إلغاء الـ cache تلقائيًا في RTK Query لأي بيانات اتغيّرت من شاشة
  // تانية - مركزي هنا بدل ما كل صفحة تعمل نفس المنطق لوحدها
  useRealtimeCacheSync();

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onLowStock = (data) => {
      addToast(`⚠️ ${data.name}: الكمية المتبقية ${data.quantity} فقط`, "warning");
    };

    const onInvoiceCreated = (data) => {
      // منعرضش إشعار للكاشير نفسه اللي عمل البيع - هو شايف فاتورته أصلًا
      if (data.cashierId !== user._id) {
        addToast(
          `🧾 فاتورة جديدة #${data.invoiceNumber} بقيمة ${data.grandTotal.toFixed(2)} ج.م (${data.cashierName})`,
          "info"
        );
      }
    };

    socket.on("stock:low", onLowStock);
    socket.on("invoice:created", onInvoiceCreated);

    return () => {
      socket.off("stock:low", onLowStock);
      socket.off("invoice:created", onInvoiceCreated);
    };
  }, [user, addToast]);

  return null;
}
