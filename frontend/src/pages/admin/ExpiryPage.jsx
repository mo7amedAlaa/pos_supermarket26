import { useState } from "react";
import { useGetExpiringProductsQuery } from "../../store/apiSlice";
import { CalendarClock, CalendarCheck2 } from "lucide-react";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";

export default function ExpiryPage() {
  const [days, setDays] = useState(30);
  const { data: rows = [], isLoading: loading, isError: loadError, refetch: load } = useGetExpiringProductsQuery({ days });

  const expiredCount = rows.filter((r) => r.expired).length;
  const soonCount = rows.filter((r) => !r.expired).length;

  return (
    <div>
      <div className="page-header">
        <h2><CalendarClock size={20} className="page-header-icon" /> تواريخ الصلاحية</h2>
      </div>

      <div className="toolbar">
        <label>
          عرض الأصناف اللي هتنتهي خلال:
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="inline-select">
            <option value={7}>7 أيام</option>
            <option value={15}>15 يوم</option>
            <option value={30}>30 يوم</option>
            <option value={60}>60 يوم</option>
            <option value={90}>90 يوم</option>
          </select>
        </label>
      </div>

      <div className="stats-grid stats-grid-2">
        <div className="stat-card stat-danger">
          <div className="stat-value">{expiredCount}</div>
          <div className="stat-label">دفعات منتهية بالفعل (اسحبها من الرف)</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{soonCount}</div>
          <div className="stat-label">دفعات قربت تنتهي</div>
        </div>
      </div>

      {loadError ? (
        <ErrorState message="تعذر تحميل بيانات الصلاحية" onRetry={load} />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الفئة</th>
              <th>الكمية في الدفعة</th>
              <th>تاريخ الانتهاء</th>
              <th>المتبقي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows columns={6} rows={4} />}
            {!loading && rows.map((r) => (
              <tr key={r.batchId} className={r.expired ? "row-expired" : r.daysLeft <= 7 ? "row-low-stock" : ""}>
                <td>{r.name}</td>
                <td>{r.category}</td>
                <td>{r.quantity}</td>
                <td>{new Date(r.expiryDate).toLocaleDateString("ar-EG")}</td>
                <td>{r.expired ? `منذ ${Math.abs(r.daysLeft)} يوم` : `${r.daysLeft} يوم`}</td>
                <td>
                  {r.expired ? (
                    <span className="badge badge-danger">منتهي</span>
                  ) : r.daysLeft <= 7 ? (
                    <span className="badge badge-danger">عاجل</span>
                  ) : (
                    <span className="badge badge-warn">قريب</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
