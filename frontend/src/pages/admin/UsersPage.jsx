import { useState } from "react";
import { useGetUsersQuery, useCreateUserMutation } from "../../store/apiSlice";
import { Users, UserPlus, ShieldCheck, ShoppingCart, AlertCircle } from "lucide-react";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { useToast } from "../../context/ToastContext";

const emptyForm = { name: "", username: "", password: "", role: "cashier" };

export default function UsersPage() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const { addToast } = useToast();

  const { data: users = [], isLoading: loading, isError: loadError, refetch: load } = useGetUsersQuery();
  const [createUser, { isLoading: saving }] = useCreateUserMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createUser(form).unwrap();
      setForm(emptyForm);
      addToast("تم إضافة المستخدم بنجاح", "info");
    } catch (err) {
      setError(err.data?.message || "حدث خطأ");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2><Users size={20} className="page-header-icon" /> المستخدمون (الأدمن والكاشير)</h2>
      </div>

      <form className="card-form" onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <div className="form-row">
          <div>
            <label>الاسم</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label>اسم المستخدم (للدخول)</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>كلمة المرور</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div>
            <label>الدور</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="cashier">كاشير</option>
              <option value="admin">أدمن</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? <Spinner /> : <><UserPlus size={16} /> إضافة مستخدم</>}
        </button>
      </form>

      {loadError ? (
        <ErrorState message="تعذر تحميل المستخدمين" onRetry={load} />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>اسم المستخدم</th>
              <th>الدور</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows columns={3} rows={3} />}
            {!loading && users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td className="mono">{u.username}</td>
                <td>
                  {u.role === "admin" ? (
                    <span className="badge badge-role-admin"><ShieldCheck size={12} /> أدمن</span>
                  ) : (
                    <span className="badge badge-role-cashier"><ShoppingCart size={12} /> كاشير</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !loadError && users.length === 0 && (
        <EmptyState icon={Users} title="لا يوجد مستخدمون بعد" subtitle="أضف أول حساب من الفورم بالأعلى" />
      )}
    </div>
  );
}
