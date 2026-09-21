import { useEffect, useState } from "react";
import { useGetProductsQuery, useGetCategoriesQuery } from "../../store/apiSlice";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import { X, Search, PackageSearch, Check } from "lucide-react";

// شاشة تصفح المنتجات - بديل للسكانر، الكاشير يدوس على المنتج مباشرة
// عشان يضيفه للسلة. للمنتجات الموزونة، بيظهر حقل صغير يدخل فيه الوزن يدوي
// (لأنه مفيش باركود ميزان هنا أصلًا).
//
// mode="modal" (افتراضي): نافذة منبثقة بغطاء وزرار إغلاق - للاستخدام كزرار
//   منفصل.
// mode="inline": بدون غطاء ولا زرار إغلاق - عشان تتحط مباشرة جوه شاشة
//   الكاشير في وضع "تصفح" أو "الاثنين معًا".
//
// ملحوظة أداء: البيانات هنا بتيجي من RTK Query، فمشتركة في الكاش مع أي
// صفحة تانية طلبت نفس المنتجات (زي صفحة "المنتجات" في لوحة التحكم لو
// الأدمن فاتحها في تاب تاني) - وأي تغيير لحظي (بيع، توريد) بيحدّثها
// أوتوماتيك عن طريق invalidateTags المركزية، من غير أي كود إضافي هنا.
export default function ProductPicker({ onSelect, onClose, mode = "modal", open = true }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [weighingProductId, setWeighingProductId] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [justAddedId, setJustAddedId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: categories = [] } = useGetCategoriesQuery();
  const {
    data: products = [],
    isLoading: loading,
    isError: loadError,
    refetch: load,
  } = useGetProductsQuery(
    { search: debouncedSearch || undefined, category: categoryId || undefined },
    { skip: mode !== "inline" && !open }
  );

  const flashAdded = (id) => {
    setJustAddedId(id);
    setTimeout(() => setJustAddedId((cur) => (cur === id ? null : cur)), 700);
  };

  const handleCardClick = (product) => {
    if (product.quantity <= 0) return;
    if (product.isWeighted) {
      setWeighingProductId(product._id);
      setWeightInput("");
      return;
    }
    onSelect(product, 1);
    flashAdded(product._id);
  };

  const confirmWeight = (product) => {
    const weight = Number(weightInput);
    if (!weight || weight <= 0) return;
    if (weight > product.quantity) return;
    onSelect(product, weight);
    flashAdded(product._id);
    setWeighingProductId(null);
    setWeightInput("");
  };

  const content = (
    <>
      {mode === "modal" && (
        <div className="picker-header">
          <h3><PackageSearch size={19} className="page-header-icon" /> تصفح المنتجات</h3>
          <button className="btn-icon-only" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="picker-filters">
        <div className="input-with-icon" style={{ flex: 1 }}>
          <Search size={16} className="input-icon" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="picker-category-select">
            <option value="">كل الفئات</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="picker-grid-wrap">
        {loading && <div className="picker-loading"><Spinner size={26} /></div>}
        {loadError && <ErrorState message="تعذر تحميل المنتجات" onRetry={load} />}
        {!loading && !loadError && products.length === 0 && (
          <EmptyState icon={PackageSearch} title="لا توجد منتجات مطابقة" subtitle="جرّب كلمة بحث تانية" />
        )}

        {!loading && !loadError && products.length > 0 && (
          <div className="picker-grid">
            {products.map((p) => {
              const outOfStock = p.quantity <= 0;
              const isWeighing = weighingProductId === p._id;
              return (
                <div
                  key={p._id}
                  role="button"
                  tabIndex={outOfStock ? -1 : 0}
                  className={`picker-card${outOfStock ? " picker-card-disabled" : ""}${justAddedId === p._id ? " picker-card-added" : ""}`}
                  onClick={() => handleCardClick(p)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !outOfStock) {
                      e.preventDefault();
                      handleCardClick(p);
                    }
                  }}
                  aria-disabled={outOfStock}
                >
                  {justAddedId === p._id && (
                    <span className="picker-card-check"><Check size={26} /></span>
                  )}
                  <span className="picker-card-name">{p.name}</span>
                  <span className="picker-card-price">
                    {p.sellingPrice.toFixed(2)} ج.م{p.isWeighted ? "/كجم" : ""}
                  </span>
                  {outOfStock ? (
                    <span className="badge badge-danger">غير متوفر</span>
                  ) : (
                    <span className="muted small">متاح: {p.quantity} {p.unit}</span>
                  )}

                  {isWeighing && (
                    <div className="picker-weight-entry" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max={p.quantity}
                        placeholder="الوزن (كجم)"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && confirmWeight(p)}
                      />
                      <div className="picker-weight-actions">
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setWeighingProductId(null)}>
                          إلغاء
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          disabled={!weightInput || Number(weightInput) <= 0 || Number(weightInput) > p.quantity}
                          onClick={() => confirmWeight(p)}
                        >
                          إضافة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  if (mode === "inline") {
    return <div className="picker-inline">{content}</div>;
  }

  return (
    <Modal open={open} onClose={onClose} className="picker-modal">
      {content}
    </Modal>
  );
}
