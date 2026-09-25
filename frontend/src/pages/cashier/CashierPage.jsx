import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReactToPrintFallback } from "./usePrint";
import {
  useLazyScanProductQuery,
  useCreateInvoiceMutation,
} from "../../store/apiSlice";
import useHardwareScanner from "../../components/useHardwareScanner";
import CameraScanner from "../../components/CameraScanner";
import ProductPicker from "./ProductPicker";
import InvoicePrint from "./InvoicePrint";
import Spinner from "../../components/Spinner";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Camera,
  Trash2,
  LayoutDashboard,
  LogOut,
  AlertCircle,
  ScanBarcode,
  Printer,
  ScanLine,
  LayoutGrid,
  Columns2,
  Scale,
} from "lucide-react";

const MODES = [
  { id: "scanner", label: "الباركود", icon: ScanLine },
  { id: "browse", label: "المنتجات", icon: LayoutGrid },
  { id: "both", label: "الاثنين معًا", icon: Columns2 },
];

export default function CashierPage() {
  // طريقة عرض البيع: سكانر بس / تصفح منتجات بس / الاثنين مع بعض
  const [mode, setMode] = useState("both");

  // كل سطر: { product, quantity, unitPrice, source }
  const [cart, setCart] = useState([]);
  const [manualBarcode, setManualBarcode] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [scanError, setScanError] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [lastInvoice, setLastInvoice] = useState(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef(null);
  const { print } = useReactToPrintFallback(printRef);
  const [triggerScan] = useLazyScanProductQuery();
  const [createInvoiceMutation, { isLoading: loading }] =
    useCreateInvoiceMutation();

  // منطق مشترك لإضافة سطر للسلة - مستخدم سواء المنتج جه من مسح باركود
  // (سكانر/كاميرا/يدوي) أو من الضغط المباشر في شاشة "تصفح المنتجات"
  const addLineToCart = useCallback(
    ({ product, quantity, unitPrice, source }) => {
      setCart((prev) => {
        const existing = prev.find((l) => l.product._id === product._id);

        if (product.isWeighted) {
          if (quantity > product.quantity) {
            setScanError(
              `الكمية المتاحة من ${product.name} غير كافية (${product.quantity} ${product.unit})`,
            );
            return prev;
          }
          return [
            ...prev,
            {
              product,
              quantity,
              unitPrice,
              source,
              lineId: Date.now() + Math.random(),
            },
          ];
        }

        if (existing) {
          if (existing.quantity + quantity > product.quantity) {
            setScanError(`الكمية المتاحة من ${product.name} غير كافية`);
            return prev;
          }
          return prev.map((l) =>
            l.lineId === existing.lineId
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          );
        }
        if (quantity > product.quantity) {
          setScanError(`${product.name} غير متوفر في المخزون`);
          return prev;
        }
        return [
          ...prev,
          {
            product,
            quantity,
            unitPrice,
            source,
            lineId: Date.now() + Math.random(),
          },
        ];
      });
    },
    [],
  );

  const addToCart = useCallback(
    async (code) => {
      setScanError("");
      try {
        const data = await triggerScan(code).unwrap();
        addLineToCart(data);
      } catch (err) {
        setScanError(err.data?.message || "المنتج غير موجود - تأكد من الكود");
      }
    },
    [addLineToCart, triggerScan],
  );

  const handlePickProduct = useCallback(
    (product, quantity) => {
      setScanError("");
      addLineToCart({
        product,
        quantity,
        unitPrice: product.sellingPrice,
        source: product.isWeighted ? "manual-weight" : "picker",
      });
    },
    [addLineToCart],
  );

  // السكانر الفعلي شغال في الخلفية دايمًا بغض النظر عن وضع العرض المختار،
  // إلا وقت فتح الكاميرا أو شاشة الفاتورة (عشان منضربش إدخال في غلط مكان)
  useHardwareScanner((code) => addToCart(code), {
    active: !showCamera && !lastInvoice,
  });

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    addToCart(manualBarcode.trim());
    setManualBarcode("");
  };

  const updateQty = (lineId, qty) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.lineId === lineId
            ? {
                ...l,
                quantity: Math.max(
                  0,
                  Math.min(Number(qty), l.product.quantity),
                ),
              }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (lineId) =>
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const grandTotal = subtotal - Number(discount || 0) + Number(tax || 0);
  const change = amountPaid ? Number(amountPaid) - grandTotal : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const invoice = await createInvoiceMutation({
        items: cart.map((l) => ({
          productId: l.product._id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        discount: Number(discount || 0),
        tax: Number(tax || 0),
        paymentMethod,
        amountPaid: Number(amountPaid || grandTotal),
      }).unwrap();
      setLastInvoice(invoice);
      setCart([]);
      setDiscount(0);
      setTax(0);
      setAmountPaid("");
    } catch (err) {
      setScanError(err.data?.message || "تعذر إتمام عملية البيع");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const showScanInput = mode === "scanner" || mode === "both";
  const showBrowse = mode === "browse" || mode === "both";

  return (
    <div className="min-h-screen bg-[#F2F4F1] text-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 sm:py-3.5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-800 sm:text-lg">
          <ShoppingCart size={20} className="text-emerald-600" />
          <span className="hidden sm:inline">شاشة الكاشير</span>
        </h2>
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden text-sm text-zinc-500 sm:inline">
            {user?.name}
          </span>
          {user?.role === "admin" && (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-emerald-600"
              title="لوحة التحكم"
            >
              <LayoutDashboard size={16} />
              <span className="hidden sm:inline">لوحة التحكم</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-red-600"
            title="خروج"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* اختيار طريقة عرض البيع: باركود / منتجات / الاثنين معًا -
              على الشاشات الضيقة بيبان الأيقونة بس، والنص بيظهر من sm فأعلى */}
          <div className="relative flex w-fit gap-1 rounded-full bg-zinc-200/70 p-1">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                title={label}
                className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
                  mode === id
                    ? "text-white"
                    : "text-zinc-600 hover:text-zinc-800"
                }`}
              >
                {mode === id && (
                  <motion.span
                    layoutId="mode-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-emerald-600"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {showScanInput && (
            <form
              onSubmit={handleManualSubmit}
              className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="relative min-w-[180px] flex-1">
                <ScanLine
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pr-9 pl-3 font-mono text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  placeholder="امسح الباركود أو أدخله يدويًا ثم Enter"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-zinc-800 px-4 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                إضافة
              </button>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                title="كاميرا"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 sm:px-4"
              >
                <Camera size={15} />
                <span className="hidden sm:inline">كاميرا</span>
              </button>
            </form>
          )}

          <AnimatePresence>
            {scanError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                <AlertCircle size={16} /> {scanError}
              </motion.div>
            )}
          </AnimatePresence>

          {showScanInput && (
            <p className="-mt-2 text-xs text-zinc-400">
              السكانر الفعلي شغال تلقائيًا. باركود الميزان بيتقرأ لوحده ويجيب
              الوزن والسعر.
            </p>
          )}

          {showBrowse && (
            <ProductPicker mode="inline" onSelect={handlePickProduct} />
          )}

          <div className="rounded-xl border border-zinc-200 bg-white">
            {cart.length === 0 ? (
              <div className="py-10">
                <EmptyState
                  icon={ScanBarcode}
                  title="السلة فارغة"
                  subtitle="ابدأ بإضافة أول منتج"
                />
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                <AnimatePresence initial={false}>
                  {cart.map((l) => (
                    <motion.div
                      key={l.lineId}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-800">
                          {l.product.name}
                          {l.product.isWeighted && (
                            <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">
                              <Scale size={10} /> وزن
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {l.unitPrice.toFixed(2)} ج.م
                          {l.product.isWeighted && "/كجم"}
                        </div>
                      </div>

                      <input
                        type="number"
                        step={l.product.isWeighted ? "0.001" : "1"}
                        min={l.product.isWeighted ? "0.001" : "1"}
                        max={l.product.quantity}
                        value={l.quantity}
                        onChange={(e) => updateQty(l.lineId, e.target.value)}
                        className="w-20 rounded-md border border-zinc-200 px-2 py-1 text-center text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />

                      <div className="w-20 shrink-0 text-left text-sm font-semibold text-zinc-800">
                        {(l.unitPrice * l.quantity).toFixed(2)}
                      </div>

                      <button
                        onClick={() => removeLine(l.lineId)}
                        className="shrink-0 rounded-md p-1.5 text-zinc-300 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="flex h-fit flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 lg:sticky lg:top-4">
          <h3 className="text-base font-semibold text-zinc-800">الفاتورة</h3>

          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>الإجمالي الفرعي</span>
            <span>{subtotal.toFixed(2)}</span>
          </div>

          <label className="text-xs font-medium text-zinc-500">الخصم</label>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <label className="text-xs font-medium text-zinc-500">الضريبة</label>
          <input
            type="number"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-base font-semibold text-zinc-900">
            <span>الإجمالي النهائي</span>
            <span className="text-emerald-700">{grandTotal.toFixed(2)}</span>
          </div>

          <label className="mt-1 text-xs font-medium text-zinc-500">
            طريقة الدفع
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
          </select>

          <AnimatePresence>
            {paymentMethod === "cash" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-2 overflow-hidden"
              >
                <label className="text-xs font-medium text-zinc-500">
                  المبلغ المدفوع
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <div className="flex items-center justify-between text-sm text-zinc-500">
                  <span>الباقي</span>
                  <span className="font-medium text-zinc-800">
                    {change > 0 ? change.toFixed(2) : "0.00"}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            disabled={cart.length === 0 || loading}
            onClick={handleCheckout}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {loading ? (
              <>
                <Spinner /> جاري إتمام العملية...
              </>
            ) : (
              "إتمام البيع وطباعة الفاتورة"
            )}
          </button>
        </div>
      </div>

      {showCamera && (
        <CameraScanner
          onScan={(code) => {
            addToCart(code);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      <Modal open={!!lastInvoice} onClose={() => setLastInvoice(null)}>
        {lastInvoice && (
          <>
            <InvoicePrint ref={printRef} invoice={lastInvoice} />
            <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                onClick={() => setLastInvoice(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                إغلاق
              </button>
              <button
                onClick={print}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Printer size={15} /> طباعة
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
