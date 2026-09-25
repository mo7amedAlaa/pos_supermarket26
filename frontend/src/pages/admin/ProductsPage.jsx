import { useEffect, useState, useMemo, useRef, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetProductsQuery,
  useGetCategoriesQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGenerateBarcodeMutation,
  useAdjustStockMutation,
  useRepackageMutation,
  useLazyGetProductLogsQuery,
} from "../../store/apiSlice";
import useHardwareScanner from "../../components/useHardwareScanner";
import CameraScanner from "../../components/CameraScanner";
import Spinner from "../../components/Spinner";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Modal from "../../components/Modal";
import { usePrintBarcodeLabel } from "../../components/usePrintBarcodeLabel";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  PackagePlus,
  ClipboardCheck,
  Blend,
  QrCode,
  Camera,
  Wand2,
  Search,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
} from "lucide-react";

// jsbarcode مكتبة مش صغيرة ومستخدمة بس لما الأدمن يفتح معاينة الملصق -
// نحمّلها عند الطلب بدل ما تتضاف لأول تحميل للصفحة كلها
const BarcodeLabel = lazy(() => import("../../components/BarcodeLabel"));

// كلاسات موحدة بنكررها في كل الفورمات جوه الصفحة دي
const input =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50 disabled:text-zinc-400";
const label = "mb-1 mt-3 block text-xs font-medium text-zinc-500";
const btnPrimary =
  "flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300";
const btnSecondary =
  "flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50";
const btnLink =
  "flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-emerald-50 hover:text-emerald-700";
const btnLinkDanger =
  "flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-red-50 hover:text-red-600";
const checkboxRow = "mt-3 flex items-center gap-2 text-sm text-zinc-700";
const formRow = "grid grid-cols-1 gap-3 sm:grid-cols-2";

const emptyForm = {
  name: "",
  barcode: "",
  isWeighted: false,
  scaleItemCode: "",
  category: "",
  purchasePrice: "",
  sellingPrice: "",
  quantity: "",
  unit: "piece",
  unitsPerCarton: 1,
  lowStockThreshold: 5,
  trackExpiry: false,
  expiryDate: "",
  recipeRawId: "",
  recipeQuantityPerUnit: "",
};

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const confirm = useConfirm();
  const { addToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [stockModal, setStockModal] = useState(null);
  const [stockMode, setStockMode] = useState("stock_in");
  const [stockForm, setStockForm] = useState({
    cartons: "",
    looseUnits: "",
    quantityChange: "",
    countedQuantity: "",
    purchasePrice: "",
    expiryDate: "",
    note: "",
    useCartons: true,
  });

  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState("");

  const [labelProduct, setLabelProduct] = useState(null); // منتج بنعرض ملصق الباركود بتاعه
  const [labelCopies, setLabelCopies] = useState(1);
  const labelRef = useRef(null);
  const { print: printLabel } = usePrintBarcodeLabel(labelRef);

  const [repackageModal, setRepackageModal] = useState(null); // منتج بنعمله "تعبئة" من خامته
  const [repackagePortions, setRepackagePortions] = useState("");
  const [repackageNote, setRepackageNote] = useState("");

  const [historyProduct, setHistoryProduct] = useState(null); // منتج بنعرض سجل حركته

  // ---------------------------------------------------------------------
  // RTK Query: كل جلب أو تعديل بيانات بيعدي من هنا. الفايدة المباشرة:
  // - مفيش أي useEffect يدوي بينده api.get ويحط النتيجة في useState
  // - الكاش بيتشارك تلقائيًا؛ لو صفحة تانية جابت نفس المنتجات، هنا
  //   هياخدها من الكاش على طول من غير طلب شبكة جديد
  // - أي mutation (إضافة/تعديل/حذف/توريد) بتعمل invalidateTags، وأي
  //   query شغالة حاليًا وعندها نفس الـ tag بتتحدث لوحدها - مفيش
  //   loadProducts() يدوي بعد كل عملية زي ما كان قبل كده
  // ---------------------------------------------------------------------

  // debounce: منستناش كل ضغطة كيبورد تبعت طلب API لوحدها
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: products = [],
    isLoading: loading,
    isError: loadError,
    refetch: loadProducts,
  } = useGetProductsQuery({
    search: debouncedSearch || undefined,
    lowStock: lowStockOnly || undefined,
  });

  const { data: categories = [] } = useGetCategoriesQuery();

  // قائمة الخامات (منتجات موزونة) - استعلام منفصل بدون فلتر بحث، عشان
  // تفضل متاحة كاملة في دروب داون "ربط بخامة" - RTK Query بيكاشها لوحدها
  const { data: allProductsForRecipes = [] } = useGetProductsQuery({});
  const rawMaterials = useMemo(
    () => allProductsForRecipes.filter((p) => p.isWeighted),
    [allProductsForRecipes],
  );

  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [deleteProductMutation] = useDeleteProductMutation();
  const [generateBarcode, { isLoading: generatingBarcode }] =
    useGenerateBarcodeMutation();
  const [adjustStock, { isLoading: stockSaving }] = useAdjustStockMutation();
  const [repackage, { isLoading: repackageSaving }] = useRepackageMutation();
  const [
    triggerGetLogs,
    { data: historyLogs = [], isFetching: historyLoading },
  ] = useLazyGetProductLogsQuery();

  const saving = creating || updating;

  useHardwareScanner(
    (code) => {
      if (showForm && !form.isWeighted)
        setForm((f) => ({ ...f, barcode: code }));
    },
    { active: showForm },
  );

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name,
      barcode: p.barcode || "",
      isWeighted: p.isWeighted,
      scaleItemCode: p.scaleItemCode || "",
      category: p.category?._id || "",
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      quantity: p.quantity,
      unit: p.unit,
      unitsPerCarton: p.unitsPerCarton,
      lowStockThreshold: p.lowStockThreshold,
      trackExpiry: p.trackExpiry,
      expiryDate: "",
      recipeRawId: p.recipeFrom?.product?._id || "",
      recipeQuantityPerUnit: p.recipeFrom?.quantityPerUnit ?? "",
    });
    setEditingId(p._id);
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // نبني الـ payload بالحقول المناسبة بس لحالة المنتج (موزون/معبأ)
      // بدل ما نبعت كل حقول الفورم زي ما هي، عشان منبعتش حقل فاضي
      // (barcode أو scaleItemCode) يبوظ منتج تاني أو يعمل تعارض في القاعدة.
      const payload = {
        name: form.name.trim(),
        isWeighted: form.isWeighted,
        category: form.category || undefined,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        lowStockThreshold: Number(form.lowStockThreshold),
        trackExpiry: form.trackExpiry,
      };

      if (form.isWeighted) {
        payload.scaleItemCode = form.scaleItemCode.trim();
        payload.unit = form.unit || "kg";
        payload.unitsPerCarton = 1;
        // مفيش باركود للمنتج الموزون - متبعتوش خالص
      } else {
        payload.barcode = form.barcode.trim();
        payload.unit = form.unit;
        payload.unitsPerCarton = Number(form.unitsPerCarton || 1);
        // مفيش كود ميزان للمنتج المعبأ - متبعتوش خالص

        // ربط المنتج بخامة (زي طبق جبنة 100جم من قالب جبنة سايب) - اختياري
        if (form.recipeRawId && form.recipeQuantityPerUnit) {
          payload.recipeFrom = {
            product: form.recipeRawId,
            quantityPerUnit: Number(form.recipeQuantityPerUnit),
          };
        } else {
          payload.recipeFrom = null; // يمسح الربط الموجود لو الأدمن ألغاه
        }
      }

      if (editingId) {
        // عند التعديل: الباركود/كود الميزان/الكمية مالهمش مكان هنا خالص
        // (الكمية بتتغير من زرار توريد/جرد بس، والكود ثابت من وقت الإنشاء)
        delete payload.barcode;
        delete payload.scaleItemCode;
        delete payload.isWeighted;
        await updateProduct({ id: editingId, ...payload }).unwrap();
        addToast("تم تعديل المنتج بنجاح", "info");
      } else {
        payload.quantity = Number(form.quantity || 0);
        if (form.trackExpiry && form.expiryDate) {
          payload.expiryDate = form.expiryDate;
        }
        await createProduct(payload).unwrap();
        addToast("تم إضافة المنتج بنجاح", "info");
      }
      setShowForm(false);
    } catch (err) {
      setError(err.data?.message || "حدث خطأ");
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm(
      "هل أنت متأكد من حذف هذا المنتج؟ الإجراء ده مينفعش يترجع.",
      {
        danger: true,
        confirmLabel: "حذف",
      },
    );
    if (!ok) return;
    try {
      await deleteProductMutation(id).unwrap();
      addToast("تم حذف المنتج", "info");
    } catch (err) {
      addToast(err.data?.message || "تعذر حذف المنتج", "error");
    }
  };

  const handleGenerateBarcode = async () => {
    try {
      const data = await generateBarcode().unwrap();
      setForm((f) => ({ ...f, barcode: data.barcode }));
      addToast("تم توليد باركود جديد", "info");
    } catch (err) {
      addToast(err.data?.message || "تعذر توليد باركود", "error");
    }
  };

  const openStockModal = (p, mode) => {
    setStockModal(p);
    setStockMode(mode);
    setStockForm({
      cartons: "",
      looseUnits: "",
      quantityChange: "",
      countedQuantity: mode === "stocktake" ? p.quantity : "",
      purchasePrice: p.purchasePrice,
      expiryDate: "",
      note: "",
      useCartons: p.unitsPerCarton > 1,
    });
  };

  const openRepackageModal = (p) => {
    setRepackageModal(p);
    setRepackagePortions("");
    setRepackageNote("");
  };

  const openHistory = (p) => {
    setHistoryProduct(p);
    triggerGetLogs(p._id);
  };

  const submitRepackage = async (e) => {
    e.preventDefault();
    try {
      const data = await repackage({
        id: repackageModal._id,
        portions: Number(repackagePortions),
        note: repackageNote,
      }).unwrap();
      addToast(
        `تم إنتاج ${repackagePortions} ${repackageModal.unit} - تكلفة الوحدة ${data.costPerPortion.toFixed(2)} ج.م`,
        "info",
      );
      setRepackageModal(null);
    } catch (err) {
      addToast(err.data?.message || "تعذر إتمام التعبئة", "error");
    }
  };

  const submitStockChange = async (e) => {
    e.preventDefault();
    let body;
    if (stockMode === "stocktake") {
      body = {
        type: "stocktake",
        countedQuantity: Number(stockForm.countedQuantity),
        note: stockForm.note,
      };
    } else {
      body = {
        type: "stock_in",
        purchasePrice:
          stockForm.purchasePrice !== ""
            ? Number(stockForm.purchasePrice)
            : undefined,
        expiryDate: stockForm.expiryDate || undefined,
        note: stockForm.note,
      };
      if (stockForm.useCartons) {
        body.cartons = Number(stockForm.cartons || 0);
        body.looseUnits = Number(stockForm.looseUnits || 0);
      } else {
        body.quantityChange = Number(stockForm.quantityChange);
      }
    }
    try {
      await adjustStock({ id: stockModal._id, ...body }).unwrap();
      addToast(
        stockMode === "stocktake"
          ? "تم تسجيل الجرد بنجاح"
          : "تم تسجيل التوريد بنجاح",
        "info",
      );
      setStockModal(null);
    } catch (err) {
      addToast(err.data?.message || "حدث خطأ", "error");
    }
  };

  // معاينة حية لإجمالي الكمية الداخلة
  const previewQty =
    stockModal && stockForm.useCartons
      ? Number(stockForm.cartons || 0) * stockModal.unitsPerCarton +
        Number(stockForm.looseUnits || 0)
      : Number(stockForm.quantityChange || 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800">
          <Package size={20} className="text-emerald-600" />
          المنتجات والمخزون (الجرد)
        </h2>
        <button className={btnPrimary} onClick={openAdd}>
          <Plus size={16} /> إضافة منتج جديد
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="بحث بالاسم أو الباركود أو كود الميزان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${input} pr-9`}
          />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="h-4 w-4 rounded accent-emerald-600"
          />
          منخفض المخزون فقط
        </label>
      </div>

      {loadError ? (
        <ErrorState message="تعذر تحميل المنتجات" onRetry={loadProducts} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">الاسم</th>
                <th className="hidden px-4 py-3 sm:table-cell">النوع</th>
                <th className="hidden px-4 py-3 md:table-cell">
                  الباركود / كود الميزان
                </th>
                <th className="hidden px-4 py-3 lg:table-cell">الفئة</th>
                <th className="hidden px-4 py-3 lg:table-cell">شراء</th>
                <th className="px-4 py-3">بيع</th>
                <th className="px-4 py-3">الكمية</th>
                <th className="hidden px-4 py-3 xl:table-cell">الكرتونة</th>
                <th className="hidden px-4 py-3 md:table-cell">أقرب صلاحية</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <SkeletonRows columns={10} rows={6} />}
              {!loading &&
                products.map((p) => {
                  const nearest = p.nearestExpiry
                    ? new Date(p.nearestExpiry)
                    : null;
                  const daysLeft = nearest
                    ? Math.ceil((nearest - new Date()) / 86400000)
                    : null;
                  const isLow = p.quantity <= p.lowStockThreshold;
                  return (
                    <tr
                      key={p._id}
                      className={
                        isLow ? "bg-amber-50/50" : "hover:bg-zinc-50/70"
                      }
                    >
                      <td className="px-4 py-2.5">
                        {p.name}
                        {p.recipeFrom?.product && (
                          <div className="text-xs text-zinc-400">
                            من: {p.recipeFrom.product.name} (
                            {p.recipeFrom.quantityPerUnit}{" "}
                            {p.recipeFrom.product.unit}/{p.unit})
                          </div>
                        )}
                      </td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">
                        {p.isWeighted ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            بالوزن
                          </span>
                        ) : (
                          <span className="text-zinc-500">معبأ</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-2.5 font-mono text-xs text-zinc-500 md:table-cell">
                        {p.isWeighted ? p.scaleItemCode : p.barcode}
                      </td>
                      <td className="hidden px-4 py-2.5 text-zinc-500 lg:table-cell">
                        {p.category?.name || "-"}
                      </td>
                      <td className="hidden px-4 py-2.5 lg:table-cell">
                        {p.purchasePrice}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.sellingPrice}
                        {p.isWeighted && (
                          <span className="text-xs text-zinc-400"> /كجم</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.quantity}{" "}
                        <span className="text-xs text-zinc-400">{p.unit}</span>
                      </td>
                      <td className="hidden px-4 py-2.5 text-zinc-500 xl:table-cell">
                        {p.unitsPerCarton > 1
                          ? `${p.unitsPerCarton} قطعة`
                          : "-"}
                      </td>
                      <td className="hidden px-4 py-2.5 md:table-cell">
                        {nearest ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              daysLeft < 0
                                ? "bg-red-50 text-red-600"
                                : daysLeft <= 30
                                  ? "bg-amber-50 text-amber-700"
                                  : "text-zinc-500"
                            }`}
                          >
                            {nearest.toLocaleDateString("ar-EG")}
                            {daysLeft < 0
                              ? " (منتهي)"
                              : daysLeft <= 30
                                ? ` (${daysLeft} يوم)`
                                : ""}
                          </span>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-0.5">
                          <button
                            className={btnLink}
                            onClick={() => openEdit(p)}
                            title="تعديل"
                          >
                            <Pencil size={14} />{" "}
                            <span className="hidden sm:inline">تعديل</span>
                          </button>
                          {!p.isWeighted && p.barcode && (
                            <button
                              className={btnLink}
                              onClick={() => {
                                setLabelProduct(p);
                                setLabelCopies(1);
                              }}
                              title="عرض/طباعة الباركود"
                            >
                              <QrCode size={14} />{" "}
                              <span className="hidden sm:inline">الباركود</span>
                            </button>
                          )}
                          <button
                            className={btnLink}
                            onClick={() => openStockModal(p, "stock_in")}
                            title="توريد"
                          >
                            <PackagePlus size={14} />{" "}
                            <span className="hidden sm:inline">توريد</span>
                          </button>
                          {p.recipeFrom?.product && (
                            <button
                              className={btnLink}
                              onClick={() => openRepackageModal(p)}
                              title="تعبئة"
                            >
                              <Blend size={14} />{" "}
                              <span className="hidden sm:inline">تعبئة</span>
                            </button>
                          )}
                          <button
                            className={btnLink}
                            onClick={() => openStockModal(p, "stocktake")}
                            title="جرد"
                          >
                            <ClipboardCheck size={14} />{" "}
                            <span className="hidden sm:inline">جرد</span>
                          </button>
                          <button
                            className={btnLink}
                            onClick={() => openHistory(p)}
                            title="سجل الحركة"
                          >
                            <History size={14} />{" "}
                            <span className="hidden sm:inline">السجل</span>
                          </button>
                          <button
                            className={btnLinkDanger}
                            onClick={() => handleDelete(p._id)}
                            title="حذف"
                          >
                            <Trash2 size={14} />{" "}
                            <span className="hidden sm:inline">حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && products.length === 0 && (
        <EmptyState
          icon={Package}
          title={
            search || lowStockOnly
              ? "لا توجد منتجات مطابقة"
              : "لا توجد منتجات بعد"
          }
          subtitle={
            search || lowStockOnly
              ? "جرّب تغيير كلمة البحث أو الفلتر"
              : "ابدأ بإضافة أول منتج في المخزون"
          }
          action={
            !search &&
            !lowStockOnly && (
              <button className={btnPrimary} onClick={openAdd}>
                <Plus size={16} /> إضافة منتج جديد
              </button>
            )
          }
        />
      )}

      {/* ---------- فورم إضافة / تعديل منتج ---------- */}
      <Modal open={showForm} onClose={() => setShowForm(false)} wide>
        <form onSubmit={handleSubmit} className="p-1">
          <h3 className="text-base font-semibold text-zinc-800">
            {editingId ? "تعديل منتج" : "إضافة منتج جديد"}
          </h3>
          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className={label}>اسم المنتج</label>
          <input
            className={input}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <label className={checkboxRow}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-emerald-600"
              checked={form.isWeighted}
              onChange={(e) =>
                setForm({
                  ...form,
                  isWeighted: e.target.checked,
                  unit: e.target.checked ? "kg" : "piece",
                  unitsPerCarton: e.target.checked ? 1 : form.unitsPerCarton,
                })
              }
              disabled={!!editingId}
            />
            منتج يُباع بالوزن (جبنة، لحوم، خضار) — يُقرأ من باركود الميزان
          </label>

          {form.isWeighted ? (
            <>
              <label className={label}>كود الصنف في الميزان (5 أرقام)</label>
              <input
                className={`${input} font-mono`}
                value={form.scaleItemCode}
                onChange={(e) =>
                  setForm({ ...form, scaleItemCode: e.target.value })
                }
                placeholder="مثال: 12345"
                maxLength={5}
                required
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                ده نفس الكود اللي مبرمجه على الميزان للصنف ده. الميزان بيطبع
                باركود فيه الكود + الوزن.
              </p>
            </>
          ) : (
            <>
              <label className={label}>
                الباركود (امسح بالسكانر أو الكاميرا أو ولّده تلقائيًا)
              </label>
              <div className="flex gap-2">
                <input
                  className={`${input} font-mono`}
                  value={form.barcode}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                  required
                  disabled={!!editingId}
                />
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setShowCamera(true)}
                  disabled={!!editingId}
                >
                  <Camera size={15} /> كاميرا
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={handleGenerateBarcode}
                  disabled={!!editingId || generatingBarcode}
                  title="لمنتج مالوش باركود من المصنع (عيش، بقالة سايبة، منتج محلي)"
                >
                  {generatingBarcode ? (
                    <Spinner />
                  ) : (
                    <>
                      <Wand2 size={15} /> توليد باركود
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          <label className={label}>الفئة</label>
          <select
            className={input}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="">بدون فئة</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className={formRow}>
            <div>
              <label className={label}>
                سعر الشراء {form.isWeighted && "(للكيلو)"}
              </label>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm({ ...form, purchasePrice: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className={label}>
                سعر البيع {form.isWeighted && "(للكيلو)"}
              </label>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.sellingPrice}
                onChange={(e) =>
                  setForm({ ...form, sellingPrice: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className={formRow}>
            <div>
              <label className={label}>
                {editingId
                  ? "الكمية (عدّلها من زر التوريد/الجرد)"
                  : form.recipeRawId
                    ? "عدد الوحدات المراد إنتاجها الآن"
                    : "الكمية الافتتاحية"}
              </label>
              <input
                type="number"
                step="0.001"
                className={input}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                disabled={!!editingId}
                required={!editingId}
              />
            </div>
            <div>
              <label className={label}>حد التنبيه لنقص المخزون</label>
              <input
                type="number"
                className={input}
                value={form.lowStockThreshold}
                onChange={(e) =>
                  setForm({ ...form, lowStockThreshold: e.target.value })
                }
              />
            </div>
          </div>

          {!form.isWeighted && (
            <div className={formRow}>
              <div>
                <label className={label}>عدد القطع في الكرتونة</label>
                <input
                  type="number"
                  min="1"
                  className={input}
                  value={form.unitsPerCarton}
                  onChange={(e) =>
                    setForm({ ...form, unitsPerCarton: e.target.value })
                  }
                />
                <p className="mt-1.5 text-xs text-zinc-400">
                  مثال: كرتونة شيبسي = 24 كيس. هتورّد بالكرتونة وتبيع بالقطعة.
                </p>
              </div>
              <div>
                <label className={label}>الوحدة</label>
                <input
                  className={input}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
            </div>
          )}

          {!form.isWeighted && rawMaterials.length > 0 && (
            <>
              <label className={checkboxRow}>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-emerald-600"
                  checked={!!form.recipeRawId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recipeRawId: e.target.checked ? rawMaterials[0]._id : "",
                      recipeQuantityPerUnit: e.target.checked
                        ? form.recipeQuantityPerUnit
                        : "",
                    })
                  }
                />
                المنتج ده مُعبّأ/مقسّم من خامة تانية (زي طبق جبنة أو أنشوجة من
                قالب سايب)
              </label>

              {form.recipeRawId && (
                <>
                  <div className={formRow}>
                    <div>
                      <label className={label}>الخامة</label>
                      <select
                        className={input}
                        value={form.recipeRawId}
                        onChange={(e) =>
                          setForm({ ...form, recipeRawId: e.target.value })
                        }
                      >
                        {rawMaterials.map((r) => (
                          <option key={r._id} value={r._id}>
                            {r.name} (متاح: {r.quantity} {r.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label}>
                        الكمية المستهلكة من الخامة لكل وحدة (كجم)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="مثال: 0.1 لطبق 100 جرام"
                        className={input}
                        value={form.recipeQuantityPerUnit}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            recipeQuantityPerUnit: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {!editingId &&
                    form.quantity > 0 &&
                    form.recipeQuantityPerUnit > 0 &&
                    (() => {
                      const rawProduct = rawMaterials.find(
                        (r) => r._id === form.recipeRawId,
                      );
                      const needed = Number(
                        (form.quantity * form.recipeQuantityPerUnit).toFixed(3),
                      );
                      const enough =
                        rawProduct && rawProduct.quantity >= needed;
                      return (
                        <p
                          className={`mt-2 text-xs font-medium ${enough ? "text-emerald-700" : "text-red-600"}`}
                        >
                          هيتم خصم {needed} {rawProduct?.unit} من "
                          {rawProduct?.name}" فورًا عند الحفظ
                          {enough
                            ? ""
                            : ` — غير كافي! المتاح ${rawProduct?.quantity} بس`}
                        </p>
                      );
                    })()}
                </>
              )}
              <p className="mt-1.5 text-xs text-zinc-400">
                {form.recipeRawId && !editingId
                  ? 'الكمية اللي كتبتها فوق هتتخصم من الخامة دي فورًا وقت الحفظ. لإنتاج دفعات إضافية بعد كده، استخدم زرار "تعبئة" في جدول المنتجات.'
                  : 'بعد الحفظ، استخدم زرار "تعبئة" في جدول المنتجات لإنتاج وحدات جاهزة من الخامة دي - التكلفة والخصم من المخزون بيتحسبوا أوتوماتيك.'}
              </p>
            </>
          )}

          <label className={checkboxRow}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-emerald-600"
              checked={form.trackExpiry}
              onChange={(e) =>
                setForm({ ...form, trackExpiry: e.target.checked })
              }
            />
            تتبّع تاريخ الصلاحية (للأكل والشرب والأدوية)
          </label>

          {form.trackExpiry && !editingId && (
            <>
              <label className={label}>تاريخ صلاحية الكمية الافتتاحية</label>
              <input
                type="date"
                className={input}
                value={form.expiryDate}
                onChange={(e) =>
                  setForm({ ...form, expiryDate: e.target.value })
                }
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                كل شحنة جديدة هتدخلها بتاريخ صلاحية خاص بيها، والبيع بيخصم من
                الأقرب انتهاءً أولاً (FEFO).
              </p>
            </>
          )}

          <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setShowForm(false)}
            >
              إلغاء
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? <Spinner /> : "حفظ"}
            </button>
          </div>
        </form>
      </Modal>

      {showCamera && (
        <CameraScanner
          onScan={(code) => {
            setForm((f) => ({ ...f, barcode: code }));
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* ---------- فورم التوريد / الجرد ---------- */}
      <Modal open={!!stockModal} onClose={() => setStockModal(null)}>
        {stockModal && (
          <form onSubmit={submitStockChange}>
            <h3 className="text-base font-semibold text-zinc-800">
              {stockMode === "stocktake" ? "جرد" : "توريد"}: {stockModal.name}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              الكمية الحالية: {stockModal.quantity} {stockModal.unit}
            </p>

            {stockMode === "stocktake" ? (
              <>
                <label className={label}>
                  الكمية الفعلية المعدودة في المخزن
                </label>
                <input
                  type="number"
                  step="0.001"
                  className={input}
                  value={stockForm.countedQuantity}
                  onChange={(e) =>
                    setStockForm({
                      ...stockForm,
                      countedQuantity: e.target.value,
                    })
                  }
                  required
                />
                {stockForm.countedQuantity !== "" && (
                  <p
                    className={`mt-2 text-xs font-medium ${
                      Number(stockForm.countedQuantity) - stockModal.quantity <
                      0
                        ? "text-red-600"
                        : "text-emerald-700"
                    }`}
                  >
                    الفرق:{" "}
                    {(
                      Number(stockForm.countedQuantity) - stockModal.quantity
                    ).toFixed(3)}
                  </p>
                )}
              </>
            ) : (
              <>
                {stockModal.unitsPerCarton > 1 && (
                  <label className={checkboxRow}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-emerald-600"
                      checked={stockForm.useCartons}
                      onChange={(e) =>
                        setStockForm({
                          ...stockForm,
                          useCartons: e.target.checked,
                        })
                      }
                    />
                    إدخال بالكراتين (الكرتونة = {stockModal.unitsPerCarton}{" "}
                    {stockModal.unit})
                  </label>
                )}

                {stockForm.useCartons && stockModal.unitsPerCarton > 1 ? (
                  <div className={formRow}>
                    <div>
                      <label className={label}>عدد الكراتين</label>
                      <input
                        type="number"
                        min="0"
                        className={input}
                        value={stockForm.cartons}
                        onChange={(e) =>
                          setStockForm({
                            ...stockForm,
                            cartons: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={label}>قطع سايبة (إضافية)</label>
                      <input
                        type="number"
                        min="0"
                        className={input}
                        value={stockForm.looseUnits}
                        onChange={(e) =>
                          setStockForm({
                            ...stockForm,
                            looseUnits: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <label className={label}>الكمية المضافة</label>
                    <input
                      type="number"
                      step="0.001"
                      className={input}
                      value={stockForm.quantityChange}
                      onChange={(e) =>
                        setStockForm({
                          ...stockForm,
                          quantityChange: e.target.value,
                        })
                      }
                      required
                    />
                  </>
                )}

                {previewQty > 0 && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    إجمالي الداخل: <strong>{previewQty}</strong>{" "}
                    {stockModal.unit}
                  </p>
                )}

                <label className={label}>سعر شراء الوحدة في الشحنة دي</label>
                <input
                  type="number"
                  step="0.01"
                  className={input}
                  value={stockForm.purchasePrice}
                  onChange={(e) =>
                    setStockForm({
                      ...stockForm,
                      purchasePrice: e.target.value,
                    })
                  }
                />

                {stockModal.trackExpiry && (
                  <>
                    <label className={label}>تاريخ صلاحية الشحنة</label>
                    <input
                      type="date"
                      className={input}
                      value={stockForm.expiryDate}
                      onChange={(e) =>
                        setStockForm({
                          ...stockForm,
                          expiryDate: e.target.value,
                        })
                      }
                    />
                  </>
                )}
              </>
            )}

            <label className={label}>ملاحظة (اختياري)</label>
            <input
              className={input}
              value={stockForm.note}
              onChange={(e) =>
                setStockForm({ ...stockForm, note: e.target.value })
              }
            />

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setStockModal(null)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={stockSaving}
              >
                {stockSaving ? <Spinner /> : "حفظ"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ---------- تعبئة/تقسيم من خامة ---------- */}
      <Modal open={!!repackageModal} onClose={() => setRepackageModal(null)}>
        {repackageModal && (
          <form onSubmit={submitRepackage}>
            <h3 className="text-base font-semibold text-zinc-800">
              تعبئة: {repackageModal.name}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              من الخامة: {repackageModal.recipeFrom.product.name} — متاح حاليًا{" "}
              {repackageModal.recipeFrom.product.quantity}{" "}
              {repackageModal.recipeFrom.product.unit}
            </p>

            <label className={label}>
              عدد الوحدات ({repackageModal.unit}) المراد إنتاجها
            </label>
            <input
              type="number"
              min="1"
              className={input}
              value={repackagePortions}
              onChange={(e) => setRepackagePortions(e.target.value)}
              required
              autoFocus
            />

            {repackagePortions > 0 &&
              (() => {
                const needed = Number(
                  (
                    repackagePortions *
                    repackageModal.recipeFrom.quantityPerUnit
                  ).toFixed(3),
                );
                const available = repackageModal.recipeFrom.product.quantity;
                const enough = available >= needed;
                return (
                  <p
                    className={`mt-2 text-xs font-medium ${enough ? "text-emerald-700" : "text-red-600"}`}
                  >
                    محتاج {needed} {repackageModal.recipeFrom.product.unit} من
                    الخامة
                    {enough ? "" : ` — غير كافي! المتاح ${available} بس`}
                  </p>
                );
              })()}

            <label className={label}>ملاحظة (اختياري)</label>
            <input
              className={input}
              value={repackageNote}
              onChange={(e) => setRepackageNote(e.target.value)}
            />

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setRepackageModal(null)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={repackageSaving}
              >
                {repackageSaving ? <Spinner /> : "تنفيذ التعبئة"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ---------- معاينة وطباعة ملصق الباركود ---------- */}
      <Modal
        open={!!labelProduct}
        onClose={() => setLabelProduct(null)}
        className="label-modal"
      >
        {labelProduct && (
          <>
            <h3 className="text-base font-semibold text-zinc-800">
              ملصق باركود: {labelProduct.name}
            </h3>
            <div className="mt-3 flex justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4">
              <Suspense fallback={<Spinner size={24} />}>
                <BarcodeLabel
                  ref={labelRef}
                  barcode={labelProduct.barcode}
                  name={labelProduct.name}
                  price={labelProduct.sellingPrice}
                  unit={labelProduct.unit}
                />
              </Suspense>
            </div>

            <label className={label}>عدد النسخ (لعدة قطع)</label>
            <input
              type="number"
              min="1"
              max="100"
              className={input}
              value={labelCopies}
              onChange={(e) =>
                setLabelCopies(Math.max(1, Number(e.target.value) || 1))
              }
            />

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setLabelProduct(null)}
              >
                إغلاق
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => printLabel(labelCopies)}
              >
                طباعة {labelCopies > 1 ? `(${labelCopies} نسخة)` : ""}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ---------- سجل حركة المخزون ---------- */}
      <Modal
        open={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
        wide
      >
        {historyProduct && (
          <>
            <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-800">
              <History size={18} className="text-emerald-600" /> سجل الحركة:{" "}
              {historyProduct.name}
            </h3>
            {historyLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size={26} />
              </div>
            ) : historyLogs.length === 0 ? (
              <EmptyState icon={History} title="مفيش حركة مسجلة لسه" />
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                      <th className="px-3 py-2.5">النوع</th>
                      <th className="px-3 py-2.5">قبل</th>
                      <th className="px-3 py-2.5">التغيير</th>
                      <th className="px-3 py-2.5">بعد</th>
                      <th className="px-3 py-2.5">ملاحظة</th>
                      <th className="px-3 py-2.5">بواسطة</th>
                      <th className="px-3 py-2.5">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {historyLogs.map((log) => (
                      <tr key={log._id}>
                        <td className="px-3 py-2">
                          {log.type === "sale" && (
                            <span className="flex w-fit items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                              <ArrowDownCircle size={12} /> بيع
                            </span>
                          )}
                          {log.type === "stock_in" && (
                            <span className="flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              <ArrowUpCircle size={12} /> توريد
                            </span>
                          )}
                          {log.type === "adjustment" && (
                            <span className="flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              <MinusCircle size={12} /> تعديل
                            </span>
                          )}
                          {log.type === "stocktake" && (
                            <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                              جرد
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{log.quantityBefore}</td>
                        <td
                          className={`px-3 py-2 font-medium ${log.quantityChange < 0 ? "text-red-600" : "text-emerald-700"}`}
                        >
                          {log.quantityChange > 0 ? "+" : ""}
                          {log.quantityChange}
                        </td>
                        <td className="px-3 py-2">{log.quantityAfter}</td>
                        <td className="px-3 py-2 text-xs text-zinc-400">
                          {log.note || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {log.performedBy?.name || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-400">
                          {new Date(log.createdAt).toLocaleString("ar-EG")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-5 flex justify-end border-t border-zinc-100 pt-4">
              <button
                className={btnSecondary}
                onClick={() => setHistoryProduct(null)}
              >
                إغلاق
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
