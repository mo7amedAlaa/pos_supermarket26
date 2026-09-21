import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion } from "framer-motion";

// Camera-based scanner for QR codes / barcodes, useful on phones/tablets
// or PCs without a physical scanner. Calls onScan(decodedText) once, then stops.
//
// ملحوظة: مش بنستخدم مكوّن Modal الموحّد هنا عن قصد - مكتبة الكاميرا
// حساسة لتوقيت الـ mount/unmount (لازم العنصر يكون موجود فورًا عشان
// تبدأ تشغّل الفيديو)، فتأخير AnimatePresence للـ exit ممكن يسيب
// الكاميرا شغالة في الخلفية. الأب بيتحكم في الظهور/الاختفاء مباشرة.
export default function CameraScanner({ onScan, onClose }) {
  const containerId = "camera-scanner-region";
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {} // ignore per-frame decode errors
      )
      .catch((err) => {
        console.error("تعذر تشغيل الكاميرا:", err);
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <motion.div
      className="camera-scanner-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="camera-scanner-box"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 320 }}
      >
        <div id={containerId} style={{ width: "100%" }} />
        <button className="btn btn-secondary" onClick={onClose}>
          إغلاق الكاميرا
        </button>
      </motion.div>
    </motion.div>
  );
}
