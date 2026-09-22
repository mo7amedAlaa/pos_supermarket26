import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { motion } from "framer-motion";
import { AlertCircle, Lightbulb } from "lucide-react";

// ---------------------------------------------------------------------------
// مسح بالكاميرا لباركود المنتجات (مش QR بس). المكتبة افتراضيًا بتحاول تقرا
// كل الأنواع من غير أولوية، وده بيبطّئ ويقلّل دقة قراءة باركود المنتجات
// (EAN-13) اللي شكله عريض ومسطّح، لأن إعدادات الافتراضي متظبطة أكتر على
// شكل QR المربّع. هنا بنحدد صراحة الأنواع المطلوبة (EAN/UPC/Code) وبنشكّل
// إطار المسح عريض بدل مربّع، وده اللي بيفرق فعليًا في نجاح القراءة.
//
// ملحوظة: مش بنستخدم مكوّن Modal الموحّد هنا عن قصد - مكتبة الكاميرا
// حساسة لتوقيت الـ mount/unmount (لازم العنصر يكون موجود فورًا عشان
// تبدأ تشغّل الفيديو)، فتأخير AnimatePresence للـ exit ممكن يسيب
// الكاميرا شغالة في الخلفية. الأب بيتحكم في الظهور/الاختفاء مباشرة.
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export default function CameraScanner({ onScan, onClose }) {
  const containerId = "camera-scanner-region";
  const scannerRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId, {
      formatsToSupport: BARCODE_FORMATS,
      // بيخلي المتصفح يستخدم BarcodeDetector المدمجة فيه لو متاحة (شغالة
      // في كروم على أندرويد ومعظم متصفحات الديسكتوب الحديثة) - أسرع
      // وأدق بكتير من القراءة البرمجية البحتة اللي المكتبة بتعملها لو
      // المتصفح مش داعمها.
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      verbose: false,
    });
    scannerRef.current = scanner;

    // إطار مسح عريض ومسطّح (مش مربّع) - أنسب لشكل باركود المنتجات
    const computeQrbox = (viewfinderWidth, viewfinderHeight) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      const width = Math.floor(minEdge * 0.85);
      const height = Math.floor(width * 0.42);
      return { width, height };
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 15, qrbox: computeQrbox, aspectRatio: 1.4 },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {}, // فشل قراءة فريم واحد شيء طبيعي جدًا ومتوقع، بنتجاهله
      )
      .then(() => {
        // نتأكد لو الجهاز بيدعم الفلاش (مفيد في الإضاءة الضعيفة)
        try {
          const capabilities = scanner.getRunningTrackCameraCapabilities?.();
          if (capabilities?.torchFeature?.()?.isSupported?.()) {
            setTorchSupported(true);
          }
        } catch {
          // مش كل نسخ المكتبة عندها الدالة دي - نتجاهل بهدوء
        }
      })
      .catch((err) => {
        setCameraError(
          err?.name === "NotAllowedError" || /permission/i.test(String(err))
            ? "تم رفض إذن الكاميرا. لازم تسمح للموقع بالوصول للكاميرا من إعدادات المتصفح."
            : err?.name === "NotFoundError"
              ? "مفيش كاميرا متاحة على الجهاز ده."
              : "تعذر تشغيل الكاميرا. جرّب تاني أو استخدم الإدخال اليدوي.",
        );
      });

    const hintTimer = setTimeout(() => setShowHint(true), 5000);

    return () => {
      clearTimeout(hintTimer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  const toggleTorch = async () => {
    try {
      const capabilities =
        scannerRef.current?.getRunningTrackCameraCapabilities?.();
      const torch = capabilities?.torchFeature?.();
      if (torch) {
        await torch.apply(!torchOn);
        setTorchOn((t) => !t);
      }
    } catch {
      // لو الجهاز مش بيدعمها فعليًا وقت التنفيذ، بنتجاهل بهدوء
    }
  };

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
        {cameraError ? (
          <div className="alert alert-error">
            <AlertCircle size={16} /> {cameraError}
          </div>
        ) : (
          <>
            <div id={containerId} style={{ width: "100%" }} />
            <p className="muted small camera-hint">
              قرّب الباركود لحد ما يملأ الإطار، وثبّت إيدك ثانية واحدة - المسافة
              المثالية حوالي 10-15 سم.
            </p>
            {showHint && (
              <p className="camera-hint-warning">
                لسه مبيقراش؟ جرّب تبعد شوية عشان الكاميرا تظبط التركيز، أو حسّن
                الإضاءة.
              </p>
            )}
          </>
        )}

        <div className="camera-scanner-actions">
          {torchSupported && !cameraError && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={toggleTorch}
            >
              <Lightbulb size={15} />{" "}
              {torchOn ? "إطفاء الفلاش" : "تشغيل الفلاش"}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            إغلاق الكاميرا
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
