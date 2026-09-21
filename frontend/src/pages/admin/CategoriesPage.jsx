import { useState } from "react";
import { useGetCategoriesQuery, useCreateCategoryMutation, useDeleteCategoryMutation } from "../../store/apiSlice";
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

  const { data: categories = [], isLoading: loading, isError: loadError, refetch: load } = useGetCategoriesQuery();
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
    const ok = await confirm("حذف هذه الفئة؟", { danger: true, confirmLabel: "حذف" });
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
      <div className="page-header">
        <h2><Tags size={20} className="page-header-icon" /> الفئات</h2>
      </div>

      <form className="inline-form" onSubmit={handleAdd}>
        <input
          placeholder="اسم الفئة الجديدة"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={adding}>
          {adding ? <Spinner /> : <><Plus size={16} /> إضافة</>}
        </button>
      </form>

      {loadError ? (
        <ErrorState message="تعذر تحميل الفئات" onRetry={load} />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows columns={2} rows={4} />}
            {!loading && categories.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>
                  <button className="btn-link btn-link-danger" onClick={() => handleDelete(c._id)}>
                    <Trash2 size={14} /> حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !loadError && categories.length === 0 && (
        <EmptyState icon={Tags} title="لا توجد فئات بعد" subtitle="أضف أول فئة من الحقل بالأعلى" />
      )}
    </div>
  );
}
