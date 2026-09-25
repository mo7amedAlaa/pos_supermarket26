import { useState } from "react";
import { useGetUsersQuery, useCreateUserMutation } from "../../store/apiSlice";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { useToast } from "../../context/ToastContext";

const input =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const label = "mb-1 block text-xs font-medium text-zinc-500";

const emptyForm = { name: "", username: "", password: "", role: "cashier" };

export default function UsersPage() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const { addToast } = useToast();

  const {
    data: users = [],
    isLoading: loading,
    isError: loadError,
    refetch: load,
  } = useGetUsersQuery();
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
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800">
          <Users size={20} className="text-emerald-600" />
          المستخدمون (الأدمن والكاشير)
        </h2>
      </div>

      <form
        className="mb-6 rounded-xl border border-zinc-200 bg-white p-5"
        onSubmit={handleSubmit}
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>الاسم</label>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>اسم المستخدم (للدخول)</label>
            <input
              className={input}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>كلمة المرور</label>
            <input
              type="password"
              className={input}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>الدور</label>
            <select
              className={input}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="cashier">كاشير</option>
              <option value="admin">أدمن</option>
            </select>
          </div>
        </div>
        <button
          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <Spinner />
          ) : (
            <>
              <UserPlus size={16} /> إضافة مستخدم
            </>
          )}
        </button>
      </form>

      {loadError ? (
        <ErrorState message="تعذر تحميل المستخدمين" onRetry={load} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">اسم المستخدم</th>
                <th className="px-4 py-3">الدور</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <SkeletonRows columns={3} rows={3} />}
              {!loading &&
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-zinc-50/70">
                    <td className="px-4 py-2.5 font-medium text-zinc-800">
                      {u.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                      {u.username}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.role === "admin" ? (
                        <span className="flex w-fit items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          <ShieldCheck size={12} /> أدمن
                        </span>
                      ) : (
                        <span className="flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <ShoppingCart size={12} /> كاشير
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && users.length === 0 && (
        <EmptyState
          icon={Users}
          title="لا يوجد مستخدمون بعد"
          subtitle="أضف أول حساب من الفورم بالأعلى"
        />
      )}
    </div>
  );
}
