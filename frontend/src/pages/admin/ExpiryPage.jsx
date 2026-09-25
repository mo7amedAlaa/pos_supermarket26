import { useState } from "react";
import { useGetExpiringProductsQuery } from "../../store/apiSlice";
import { CalendarClock, CalendarCheck2 } from "lucide-react";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";

export default function ExpiryPage() {
  const [days, setDays] = useState(30);
  const {
    data: rows = [],
    isLoading: loading,
    isError: loadError,
    refetch: load,
  } = useGetExpiringProductsQuery({ days });

  const expiredCount = rows.filter((r) => r.expired).length;
  const soonCount = rows.filter((r) => !r.expired).length;

  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800">
          <CalendarClock size={20} className="text-emerald-600" />
          تواريخ الصلاحية
        </h2>
      </div>

      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          عرض الأصناف اللي هتنتهي خلال:
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value={7}>7 أيام</option>
            <option value={15}>15 يوم</option>
            <option value={30}>30 يوم</option>
            <option value={60}>60 يوم</option>
            <option value={90}>90 يوم</option>
          </select>
        </label>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="text-2xl font-semibold text-red-700">
            {expiredCount}
          </div>
          <div className="text-xs text-red-700/70">
            دفعات منتهية بالفعل (اسحبها من الرف)
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="text-2xl font-semibold text-amber-700">
            {soonCount}
          </div>
          <div className="text-xs text-amber-700/70">دفعات قربت تنتهي</div>
        </div>
      </div>

      {loadError ? (
        <ErrorState message="تعذر تحميل بيانات الصلاحية" onRetry={load} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">الفئة</th>
                <th className="px-4 py-3">الكمية في الدفعة</th>
                <th className="px-4 py-3">تاريخ الانتهاء</th>
                <th className="px-4 py-3">المتبقي</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <SkeletonRows columns={6} rows={4} />}
              {!loading &&
                rows.map((r) => (
                  <tr
                    key={r.batchId}
                    className={
                      r.expired
                        ? "bg-red-50/50"
                        : r.daysLeft <= 7
                          ? "bg-amber-50/50"
                          : "hover:bg-zinc-50/70"
                    }
                  >
                    <td className="px-4 py-2.5 font-medium text-zinc-800">
                      {r.name}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{r.category}</td>
                    <td className="px-4 py-2.5">{r.quantity}</td>
                    <td className="px-4 py-2.5">
                      {new Date(r.expiryDate).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.expired
                        ? `منذ ${Math.abs(r.daysLeft)} يوم`
                        : `${r.daysLeft} يوم`}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.expired ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          منتهي
                        </span>
                      ) : r.daysLeft <= 7 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                          عاجل
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          قريب
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <EmptyState
          icon={CalendarCheck2}
          title="مفيش أصناف قربت تنتهي في الفترة دي"
          subtitle="كل حاجة تمام 👍"
        />
      )}
    </div>
  );
}
