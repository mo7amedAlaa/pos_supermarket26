import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetProductsQuery,
  useGetCategoriesQuery,
} from "../../store/apiSlice";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import { X, Search, PackageSearch, Check, Scale } from "lucide-react";

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
export default function ProductPicker({
  onSelect,
  onClose,
  mode = "modal",
  open = true,
}) {
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
    { skip: mode !== "inline" && !open },
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
    <div className="flex h-full flex-col">
      {mode === "modal" && (
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-800">
            <PackageSearch size={18} className="text-emerald-600" />
            تصفح المنتجات
          </h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex gap-2 px-5 py-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="ابحث بالاسم أو الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pr-9 pl-3 text-sm text-zinc-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-sm text-zinc-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">كل الفئات</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading && (
          <div className="flex justify-center py-10">
            <Spinner size={26} />
          </div>
        )}
        {loadError && (
          <ErrorState message="تعذر تحميل المنتجات" onRetry={load} />
        )}
        {!loading && !loadError && products.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title="لا توجد منتجات مطابقة"
            subtitle="جرّب كلمة بحث تانية"
          />
        )}

        {!loading && !loadError && products.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const outOfStock = p.quantity <= 0;
              const isWeighing = weighingProductId === p._id;
              return (
                <div key={p._id} className="relative">
                  <div
                    role="button"
                    tabIndex={outOfStock ? -1 : 0}
                    onClick={() => handleCardClick(p)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !outOfStock) {
                        e.preventDefault();
                        handleCardClick(p);
                      }
                    }}
                    aria-disabled={outOfStock}
                    className={`group relative flex flex-col gap-1 rounded-xl border p-3 text-right transition ${
                      outOfStock
                        ? "cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-60"
                        : "cursor-pointer border-zinc-200 bg-white hover:border-emerald-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 active:scale-[0.98]"
                    }`}
                  >
                    <AnimatePresence>
                      {justAddedId === p._id && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-emerald-600/90 text-white"
                        >
                          <Check size={26} />
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <span className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-zinc-800">
                      {p.name}
                    </span>
                    <span className="text-[15px] font-semibold text-emerald-700">
                      {p.sellingPrice.toFixed(2)} ج.م
                      {p.isWeighted && (
                        <span className="text-xs font-normal text-zinc-400">
                          /كجم
                        </span>
                      )}
                    </span>
                    {outOfStock ? (
                      <span className="mt-0.5 w-fit rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                        غير متوفر
                      </span>
                    ) : (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400">
                        {p.isWeighted && <Scale size={11} />}
                        متاح: {p.quantity} {p.unit}
                      </span>
                    )}
                  </div>

                  <AnimatePresence>
                    {isWeighing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-emerald-200 bg-white p-2.5 shadow-lg"
                      >
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max={p.quantity}
                          placeholder="الوزن (كجم)"
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          autoFocus
                          onKeyDown={(e) =>
                            e.key === "Enter" && confirmWeight(p)
                          }
                          className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setWeighingProductId(null)}
                            className="flex-1 rounded-md bg-zinc-100 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={
                              !weightInput ||
                              Number(weightInput) <= 0 ||
                              Number(weightInput) > p.quantity
                            }
                            onClick={() => confirmWeight(p)}
                            className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                          >
                            إضافة
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (mode === "inline") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white">
        {content}
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
    >
      {content}
    </Modal>
  );
}
