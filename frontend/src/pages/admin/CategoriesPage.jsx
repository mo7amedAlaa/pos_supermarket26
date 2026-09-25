import { useState } from "react";
import {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
} from "../../store/apiSlice";
import { Tags, Plus, Trash2 } from "lucide-react";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

export default function CategoriesPage() {
  const [name, setName] = useState("");
  const confirm = useConfirm();
  const { addToast } = useToast();

  const {
    data: categories = [],
    isLoading: loading,
    isError: loadError,
    refetch: load,
  } = useGetCategoriesQuery();
  const [createCategory, { isLoading: adding }] = useCreateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createCategory({ name: trimmed }).unwrap();
      setName("");
      addToast("تم إضافة الفئة", "info");
    } catch (err) {
      addToast(err.data?.message || "تعذر إضافة الفئة", "error");
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm("حذف هذه الفئة؟", {
      danger: true,
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteCategory(id).unwrap();
      addToast("تم حذف الفئة", "info");
    } catch (err) {
      addToast(err.data?.message || "تعذر حذف الفئة", "error");
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800">
          <Tags size={20} className="text-emerald-600" />
          الفئات
        </h2>
      </div>

      <form className="mb-6 flex gap-2" onSubmit={handleAdd}>
        <input
          placeholder="اسم الفئة الجديدة"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <button
          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          type="submit"
          disabled={adding}
        >
          {adding ? (
            <Spinner />
          ) : (
            <>
              <Plus size={16} /> إضافة
            </>
          )}
        </button>
      </form>

      {loadError ? (
        <ErrorState message="تعذر تحميل الفئات" onRetry={load} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <SkeletonRows columns={2} rows={4} />}
              {!loading &&
                categories.map((c) => (
                  <tr key={c._id} className="hover:bg-zinc-50/70">
                    <td className="px-4 py-2.5 font-medium text-zinc-800">
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleDelete(c._id)}
                      >
                        <Trash2 size={14} /> حذف
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && categories.length === 0 && (
        <EmptyState
          icon={Tags}
          title="لا توجد فئات بعد"
          subtitle="أضف أول فئة من الحقل بالأعلى"
        />
      )}
    </div>
  );
}
