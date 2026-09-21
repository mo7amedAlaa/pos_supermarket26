import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReactToPrintFallback } from "./usePrint";
import { useLazyScanProductQuery, useCreateInvoiceMutation } from "../../store/apiSlice";
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
  const [createInvoiceMutation, { isLoading: loading }] = useCreateInvoiceMutation();

  // منطق مشترك لإضافة سطر للسلة - مستخدم سواء المنتج جه من مسح باركود
  // (سكانر/كاميرا/يدوي) أو من الضغط المباشر في شاشة "تصفح المنتجات"
  const addLineToCart = useCallback(({ product, quantity, unitPrice, source }) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product._id === product._id);

      if (product.isWeighted) {
        if (quantity > product.quantity) {
          setScanError(`الكمية المتاحة من ${product.name} غير كافية (${product.quantity} ${product.unit})`);
          return prev;
        }
        return [...prev, { product, quantity, unitPrice, source, lineId: Date.now() + Math.random() }];
      }

      if (existing) {
        if (existing.quantity + quantity > product.quantity) {
          setScanError(`الكمية المتاحة من ${product.name} غير كافية`);
          return prev;
        }
        return prev.map((l) =>
          l.lineId === existing.lineId ? { ...l, quantity: l.quantity + quantity } : l
        );
      }
      if (quantity > product.quantity) {
        setScanError(`${product.name} غير متوفر في المخزون`);
        return prev;
      }
      return [...prev, { product, quantity, unitPrice, source, lineId: Date.now() + Math.random() }];
    });
  }, []);

  const addToCart = useCallback(async (code) => {
    setScanError("");
    try {
      const data = await triggerScan(code).unwrap();
      addLineToCart(data);
    } catch (err) {
      setScanError(err.data?.message || "المنتج غير موجود - تأكد من الكود");
    }
  }, [addLineToCart, triggerScan]);

  const handlePickProduct = useCallback((product, quantity) => {
    setScanError("");
    addLineToCart({
      product,
      quantity,
      unitPrice: product.sellingPrice,
      source: product.isWeighted ? "manual-weight" : "picker",
    });
  }, [addLineToCart]);

  // السكانر الفعلي شغال في الخلفية دايمًا بغض النظر عن وضع العرض المختار،
  // إلا وقت فتح الكاميرا أو شاشة الفاتورة (عشان منضربش إدخال في غلط مكان)
  useHardwareScanner((code) => addToCart(code), { active: !showCamera && !lastInvoice });

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
            ? { ...l, quantity: Math.max(0, Math.min(Number(qty), l.product.quantity)) }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (lineId) => setCart((prev) => prev.filter((l) => l.lineId !== lineId));

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

  const handleLogout = () => { logout(); navigate("/login"); };

  const showScanInput = mode === "scanner" || mode === "both";
  const showBrowse = mode === "browse" || mode === "both";

  return (
    <div className="cashier-page">
      <div className="cashier-header">
        <h2><ShoppingCart size={20} className="page-header-icon" /> شاشة الكاشير</h2>
        <div className="cashier-header-actions">
          <span className="muted">{user?.name}</span>
          {user?.role === "admin" && (
            <button className="btn-link" onClick={() => navigate("/admin")}>
              <LayoutDashboard size={14} /> لوحة التحكم
            </button>
          )}
          <button className="btn-link" onClick={handleLogout}>
            <LogOut size={14} /> خروج
          </button>
        </div>
      </div>

      <div className="cashier-grid">
        <div className="cashier-scan-panel">
          {/* اختيار طريقة عرض البيع: باركود / منتجات / الاثنين معًا */}
          <div className="mode-tabs">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`mode-tab${mode === id ? " active" : ""}`}
                onClick={() => setMode(id)}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {showScanInput && (
            <form onSubmit={handleManualSubmit} className="inline-form">
              <div className="input-with-icon" style={{ flex: 1 }}>
                <ScanLine size={16} className="input-icon" />
                <input
                  className="mono"
                  placeholder="امسح الباركود (عادي أو ميزان) أو أدخله يدويًا ثم Enter"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  autoFocus
                />
              </div>
              <button className="btn btn-secondary" type="submit">إضافة</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCamera(true)}>
                <Camera size={15} /> كاميرا
              </button>
            </form>
          )}

          {scanError && (
            <div className="alert alert-error">
              <AlertCircle size={16} /> {scanError}
            </div>
          )}

          {showScanInput && (
            <p className="muted small">
              السكانر الفعلي شغال تلقائيًا. باركود الميزان بيتقرأ لوحده ويجيب الوزن والسعر.
            </p>
          )}

          {showBrowse && (
            <ProductPicker mode="inline" onSelect={handlePickProduct} />
          )}

          {cart.length === 0 ? (
            <EmptyState icon={ScanBarcode} title="السلة فارغة" subtitle="ابدأ بإضافة أول منتج" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>السعر</th>
                  <th>الكمية / الوزن</th>
                  <th>الإجمالي</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {cart.map((l) => (
                    <motion.tr
                      key={l.lineId}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <td>
                        {l.product.name}
                        {l.product.isWeighted && <span className="badge badge-weight">وزن</span>}
                      </td>
                      <td>
                        {l.unitPrice.toFixed(2)}
                        {l.product.isWeighted && <span className="muted small"> /كجم</span>}
                      </td>
                      <td>
                        <input
                          type="number"
                          step={l.product.isWeighted ? "0.001" : "1"}
                          min={l.product.isWeighted ? "0.001" : "1"}
                          max={l.product.quantity}
                          value={l.quantity}
                          onChange={(e) => updateQty(l.lineId, e.target.value)}
                          className="qty-input"
                        />
                        <span className="muted small"> {l.product.unit}</span>
                      </td>
                      <td>{(l.unitPrice * l.quantity).toFixed(2)}</td>
                      <td>
                        <button className="btn-link btn-link-danger" onClick={() => removeLine(l.lineId)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>

        <div className="cashier-checkout-panel">
          <h3>الفاتورة</h3>
          <div className="totals-row"><span>الإجمالي الفرعي</span><span>{subtotal.toFixed(2)}</span></div>
          <label>الخصم</label>
          <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <label>الضريبة</label>
          <input type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
          <div className="totals-row totals-grand">
            <span>الإجمالي النهائي</span><span>{grandTotal.toFixed(2)}</span>
          </div>

          <label>طريقة الدفع</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
          </select>

          {paymentMethod === "cash" && (
            <>
              <label>المبلغ المدفوع</label>
              <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              <div className="totals-row">
                <span>الباقي</span><span>{change > 0 ? change.toFixed(2) : "0.00"}</span>
              </div>
            </>
          )}

          <button className="btn btn-primary btn-block" disabled={cart.length === 0 || loading}
            onClick={handleCheckout}>
            {loading ? <><Spinner /> جاري إتمام العملية...</> : "إتمام البيع وطباعة الفاتورة"}
          </button>
        </div>
      </div>

      {showCamera && (
        <CameraScanner
          onScan={(code) => { addToCart(code); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}

      <Modal open={!!lastInvoice} onClose={() => setLastInvoice(null)}>
        {lastInvoice && (
          <>
            <InvoicePrint ref={printRef} invoice={lastInvoice} />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setLastInvoice(null)}>إغلاق</button>
              <button className="btn btn-primary" onClick={print}>
                <Printer size={15} /> طباعة
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
