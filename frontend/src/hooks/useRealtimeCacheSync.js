import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { getSocket } from "../api/socket";
import { apiSlice } from "../store/apiSlice";

// ---------------------------------------------------------------------------
// بدل ما كل صفحة (المنتجات، التقارير، الفواتير...) تعمل useEffect منفصل
// بيسمع لأحداث Socket.io وينده على reload() بتاعها، النظام كله دلوقتي
// عنده نقطة واحدة بتسمع للأحداث وتنده invalidateTags من RTK Query.
// RTK Query تلقائيًا بيعيد تحميل أي بيانات فعليًا مستخدمة في شاشة مفتوحة
// حاليًا وعندها نفس الـ tag - بدون أي كود إضافي في الصفحات نفسها.
// ---------------------------------------------------------------------------
export default function useRealtimeCacheSync() {
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = getSocket();

    const invalidate = (tags) => () => dispatch(apiSlice.util.invalidateTags(tags));

    const onStockChanged = invalidate(["Product", "Summary", "Expiring"]);
    const onProductChanged = invalidate(["Product", "Summary", "Expiring"]);
    const onInvoiceCreated = invalidate(["Invoice", "Summary", "TopProducts", "Product"]);

    socket.on("stock:changed", onStockChanged);
    socket.on("product:created", onProductChanged);
    socket.on("product:changed", onProductChanged);
    socket.on("product:deleted", onProductChanged);
    socket.on("invoice:created", onInvoiceCreated);

    return () => {
      socket.off("stock:changed", onStockChanged);
      socket.off("product:created", onProductChanged);
      socket.off("product:changed", onProductChanged);
      socket.off("product:deleted", onProductChanged);
      socket.off("invoice:created", onInvoiceCreated);
    };
  }, [dispatch]);
}
