import { useEffect, useState, useMemo, useRef, Suspense, lazy } from "react";
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
      <div className="page-header">
        <h2>
          <Package size={20} className="page-header-icon" /> المنتجات والمخزون
          (الجرد)
        </h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> إضافة منتج جديد
        </button>
      </div>

      <div className="toolbar">
        <div className="input-with-icon toolbar-search">
          <Search size={16} className="input-icon" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الباركود أو كود الميزان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          منخفض المخزون فقط
        </label>
      </div>

      {loadError ? (
        <ErrorState message="تعذر تحميل المنتجات" onRetry={loadProducts} />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>النوع</th>
              <th>الباركود / كود الميزان</th>
              <th>الفئة</th>
              <th>شراء</th>
              <th>بيع</th>
              <th>الكمية</th>
              <th>الكرتونة</th>
              <th>أقرب صلاحية</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows columns={10} rows={6} />}
            {!loading &&
              products.map((p) => {
                const nearest = p.nearestExpiry
                  ? new Date(p.nearestExpiry)
                  : null;
                const daysLeft = nearest
                  ? Math.ceil((nearest - new Date()) / 86400000)
                  : null;
                return (
                  <tr
                    key={p._id}
                    className={
                      p.quantity <= p.lowStockThreshold ? "row-low-stock" : ""
                    }
                  >
                    <td>
                      {p.name}
                      {p.recipeFrom?.product && (
                        <div className="muted small">
                          من: {p.recipeFrom.product.name} (
                          {p.recipeFrom.quantityPerUnit}{" "}
                          {p.recipeFrom.product.unit}/{p.unit})
                        </div>
                      )}
                    </td>
                    <td>
                      {p.isWeighted ? (
                        <span className="badge badge-weight">بالوزن</span>
                      ) : (
                        "معبأ"
                      )}
                    </td>
                    <td className="mono">
                      {p.isWeighted ? p.scaleItemCode : p.barcode}
                    </td>
                    <td>{p.category?.name || "-"}</td>
                    <td>{p.purchasePrice}</td>
                    <td>
                      {p.sellingPrice}
                      {p.isWeighted && (
                        <span className="muted small"> /كجم</span>
                      )}
                    </td>
                    <td>
                      {p.quantity} <span className="muted small">{p.unit}</span>
                    </td>
                    <td>
                      {p.unitsPerCarton > 1 ? `${p.unitsPerCarton} قطعة` : "-"}
                    </td>
                    <td>
                      {nearest ? (
                        <span
                          className={
                            daysLeft < 0
                              ? "badge badge-danger"
                              : daysLeft <= 30
                                ? "badge badge-warn"
                                : ""
                          }
                        >
                          {nearest.toLocaleDateString("ar-EG")}
                          {daysLeft < 0
                            ? " (منتهي)"
                            : daysLeft <= 30
                              ? ` (${daysLeft} يوم)`
                              : ""}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-link"
                        onClick={() => openEdit(p)}
                        title="تعديل"
                      >
                        <Pencil size={14} /> تعديل
                      </button>
                      {!p.isWeighted && p.barcode && (
                        <button
                          className="btn-link"
                          onClick={() => {
                            setLabelProduct(p);
                            setLabelCopies(1);
                          }}
                          title="عرض/طباعة الباركود"
                        >
                          <QrCode size={14} /> الباركود
                        </button>
                      )}
                      <button
                        className="btn-link"
                        onClick={() => openStockModal(p, "stock_in")}
                        title="توريد"
                      >
                        <PackagePlus size={14} /> توريد
                      </button>
                      {p.recipeFrom?.product && (
                        <button
                          className="btn-link"
                          onClick={() => openRepackageModal(p)}
                          title="تعبئة"
                        >
                          <Blend size={14} /> تعبئة
                        </button>
                      )}
                      <button
                        className="btn-link"
                        onClick={() => openStockModal(p, "stocktake")}
                        title="جرد"
                      >
                        <ClipboardCheck size={14} /> جرد
                      </button>
                      <button
                        className="btn-link"
                        onClick={() => openHistory(p)}
                        title="سجل الحركة"
                      >
                        <History size={14} /> السجل
                      </button>
                      <button
                        className="btn-link btn-link-danger"
                        onClick={() => handleDelete(p._id)}
                        title="حذف"
                      >
                        <Trash2 size={14} /> حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
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
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={16} /> إضافة منتج جديد
              </button>
            )
          }
        />
      )}

      {/* ---------- فورم إضافة / تعديل منتج ---------- */}
      <Modal open={showForm} onClose={() => setShowForm(false)} wide>
        <form onSubmit={handleSubmit}>
          <h3>{editingId ? "تعديل منتج" : "إضافة منتج جديد"}</h3>
          {error && <div className="alert alert-error">{error}</div>}

          <label>اسم المنتج</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <label className="checkbox-label switch-row">
            <input
              type="checkbox"
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
              <label>كود الصنف في الميزان (5 أرقام)</label>
              <input
                className="mono"
                value={form.scaleItemCode}
                onChange={(e) =>
                  setForm({ ...form, scaleItemCode: e.target.value })
                }
                placeholder="مثال: 12345"
                maxLength={5}
                required
              />
              <p className="muted small">
                ده نفس الكود اللي مبرمجه على الميزان للصنف ده. الميزان بيطبع
                باركود فيه الكود + الوزن.
              </p>
            </>
          ) : (
            <>
              <label>
                الباركود (امسح بالسكانر أو الكاميرا أو ولّده تلقائيًا)
              </label>
              <div className="barcode-row">
                <input
                  className="mono"
                  value={form.barcode}
                  onChange={(e) =>
                    setForm({ ...form, barcode: e.target.value })
                  }
                  required
                  disabled={!!editingId}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCamera(true)}
                  disabled={!!editingId}
                >
                  <Camera size={15} /> كاميرا
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
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

          <label>الفئة</label>
          <select
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

          <div className="form-row">
            <div>
              <label>سعر الشراء {form.isWeighted && "(للكيلو)"}</label>
              <input
                type="number"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm({ ...form, purchasePrice: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label>سعر البيع {form.isWeighted && "(للكيلو)"}</label>
              <input
                type="number"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) =>
                  setForm({ ...form, sellingPrice: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div>
              <label>
                {editingId
                  ? "الكمية (عدّلها من زر التوريد/الجرد)"
                  : form.recipeRawId
                    ? "عدد الوحدات المراد إنتاجها الآن"
                    : "الكمية الافتتاحية"}
              </label>
              <input
                type="number"
                step="0.001"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                disabled={!!editingId}
                required={!editingId}
              />
            </div>
            <div>
              <label>حد التنبيه لنقص المخزون</label>
              <input
                type="number"
                value={form.lowStockThreshold}
                onChange={(e) =>
                  setForm({ ...form, lowStockThreshold: e.target.value })
                }
              />
            </div>
          </div>

          {!form.isWeighted && (
            <div className="form-row">
              <div>
                <label>عدد القطع في الكرتونة</label>
                <input
                  type="number"
                  min="1"
                  value={form.unitsPerCarton}
                  onChange={(e) =>
                    setForm({ ...form, unitsPerCarton: e.target.value })
                  }
                />
                <p className="muted small">
                  مثال: كرتونة شيبسي = 24 كيس. هتورّد بالكرتونة وتبيع بالقطعة.
                </p>
              </div>
              <div>
                <label>الوحدة</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
            </div>
          )}

          {!form.isWeighted && rawMaterials.length > 0 && (
            <>
              <label className="checkbox-label switch-row">
                <input
                  type="checkbox"
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
                  <div className="form-row">
                    <div>
                      <label>الخامة</label>
                      <select
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
                      <label>الكمية المستهلكة من الخامة لكل وحدة (كجم)</label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="مثال: 0.1 لطبق 100 جرام"
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
                        <p className={enough ? "preview-qty" : "diff-negative"}>
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
              <p className="muted small">
                {form.recipeRawId && !editingId
                  ? 'الكمية اللي كتبتها فوق هتتخصم من الخامة دي فورًا وقت الحفظ. لإنتاج دفعات إضافية بعد كده، استخدم زرار "تعبئة" في جدول المنتجات.'
                  : 'بعد الحفظ، استخدم زرار "تعبئة" في جدول المنتجات لإنتاج وحدات جاهزة من الخامة دي - التكلفة والخصم من المخزون بيتحسبوا أوتوماتيك.'}
              </p>
            </>
          )}

          <label className="checkbox-label switch-row">
            <input
              type="checkbox"
              checked={form.trackExpiry}
              onChange={(e) =>
                setForm({ ...form, trackExpiry: e.target.checked })
              }
            />
            تتبّع تاريخ الصلاحية (للأكل والشرب والأدوية)
          </label>

          {form.trackExpiry && !editingId && (
            <>
              <label>تاريخ صلاحية الكمية الافتتاحية</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) =>
                  setForm({ ...form, expiryDate: e.target.value })
                }
              />
              <p className="muted small">
                كل شحنة جديدة هتدخلها بتاريخ صلاحية خاص بيها، والبيع بيخصم من
                الأقرب انتهاءً أولاً (FEFO).
              </p>
            </>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowForm(false)}
            >
              إلغاء
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
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
            <h3>
              {stockMode === "stocktake" ? "جرد" : "توريد"}: {stockModal.name}
            </h3>
            <p className="muted">
              الكمية الحالية: {stockModal.quantity} {stockModal.unit}
            </p>

            {stockMode === "stocktake" ? (
              <>
                <label>الكمية الفعلية المعدودة في المخزن</label>
                <input
                  type="number"
                  step="0.001"
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
                    className={
                      Number(stockForm.countedQuantity) - stockModal.quantity <
                      0
                        ? "diff-negative"
                        : "diff-positive"
                    }
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
                  <label className="checkbox-label switch-row">
                    <input
                      type="checkbox"
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
                  <div className="form-row">
                    <div>
                      <label>عدد الكراتين</label>
                      <input
                        type="number"
                        min="0"
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
                      <label>قطع سايبة (إضافية)</label>
                      <input
                        type="number"
                        min="0"
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
                    <label>الكمية المضافة</label>
                    <input
                      type="number"
                      step="0.001"
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
                  <p className="preview-qty">
                    إجمالي الداخل: <strong>{previewQty}</strong>{" "}
                    {stockModal.unit}
                  </p>
                )}

                <label>سعر شراء الوحدة في الشحنة دي</label>
                <input
                  type="number"
                  step="0.01"
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
                    <label>تاريخ صلاحية الشحنة</label>
                    <input
                      type="date"
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

            <label>ملاحظة (اختياري)</label>
            <input
              value={stockForm.note}
              onChange={(e) =>
                setStockForm({ ...stockForm, note: e.target.value })
              }
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStockModal(null)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="btn btn-primary"
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
            <h3>تعبئة: {repackageModal.name}</h3>
            <p className="muted">
              من الخامة: {repackageModal.recipeFrom.product.name} — متاح حاليًا{" "}
              {repackageModal.recipeFrom.product.quantity}{" "}
              {repackageModal.recipeFrom.product.unit}
            </p>

            <label>عدد الوحدات ({repackageModal.unit}) المراد إنتاجها</label>
            <input
              type="number"
              min="1"
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
                  <p className={enough ? "preview-qty" : "diff-negative"}>
                    محتاج {needed} {repackageModal.recipeFrom.product.unit} من
                    الخامة
                    {enough ? "" : ` — غير كافي! المتاح ${available} بس`}
                  </p>
                );
              })()}

            <label>ملاحظة (اختياري)</label>
            <input
              value={repackageNote}
              onChange={(e) => setRepackageNote(e.target.value)}
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRepackageModal(null)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="btn btn-primary"
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
            <h3>ملصق باركود: {labelProduct.name}</h3>
            <div className="label-preview">
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

            <label>عدد النسخ (لعدة قطع)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={labelCopies}
              onChange={(e) =>
                setLabelCopies(Math.max(1, Number(e.target.value) || 1))
              }
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setLabelProduct(null)}
              >
                إغلاق
              </button>
              <button
                type="button"
                className="btn btn-primary"
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
            <h3>
              <History size={18} className="page-header-icon" /> سجل الحركة:{" "}
              {historyProduct.name}
            </h3>
            {historyLoading ? (
              <div className="picker-loading">
                <Spinner size={26} />
              </div>
            ) : historyLogs.length === 0 ? (
              <EmptyState icon={History} title="مفيش حركة مسجلة لسه" />
            ) : (
              <table className="table" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>قبل</th>
                    <th>التغيير</th>
                    <th>بعد</th>
                    <th>ملاحظة</th>
                    <th>بواسطة</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log) => (
                    <tr key={log._id}>
                      <td>
                        {log.type === "sale" && (
                          <span className="badge badge-danger">
                            <ArrowDownCircle size={12} /> بيع
                          </span>
                        )}
                        {log.type === "stock_in" && (
                          <span className="badge badge-weight">
                            <ArrowUpCircle size={12} /> توريد
                          </span>
                        )}
                        {log.type === "adjustment" && (
                          <span className="badge badge-warn">
                            <MinusCircle size={12} /> تعديل
                          </span>
                        )}
                        {log.type === "stocktake" && (
                          <span className="badge badge-role-cashier">جرد</span>
                        )}
                      </td>
                      <td>{log.quantityBefore}</td>
                      <td
                        className={
                          log.quantityChange < 0
                            ? "diff-negative"
                            : "diff-positive"
                        }
                      >
                        {log.quantityChange > 0 ? "+" : ""}
                        {log.quantityChange}
                      </td>
                      <td>{log.quantityAfter}</td>
                      <td className="muted small">{log.note || "-"}</td>
                      <td>{log.performedBy?.name || "-"}</td>
                      <td className="muted small">
                        {new Date(log.createdAt).toLocaleString("ar-EG")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
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
