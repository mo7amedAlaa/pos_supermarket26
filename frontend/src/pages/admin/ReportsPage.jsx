import { useState } from "react";
import { useGetSummaryQuery, useGetTopProductsQuery } from "../../store/apiSlice";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Receipt,
  Wallet,
  TrendingUp,
  PackageX,
  CalendarClock,
  Trophy,
  ArrowLeft,
} from "lucide-react";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";

export default function ReportsPage() {
  const [topDays, setTopDays] = useState(30);

  const { data: summary } = useGetSummaryQuery();
  const { data: topProducts = [], isLoading: topLoading } = useGetTopProductsQuery({ days: topDays, limit: 8 });

  return (
    <div>
      <div className="page-header">
        <h2><BarChart3 size={20} className="page-header-icon" /> التقارير والمبيعات</h2>
        <span className="live-badge"><span className="live-dot" /> مباشر</span>
      </div>

      {summary && (
        <div className="stats-grid">
          <div className="stat-card">
            <Receipt size={20} className="stat-icon" />
            <div className="stat-value">{summary.todaySalesCount}</div>
            <div className="stat-label">عدد فواتير اليوم</div>
          </div>
          <div className="stat-card">
            <Wallet size={20} className="stat-icon" />
            <div className="stat-value">{summary.todaySalesTotal.toFixed(2)}</div>
            <div className="stat-label">إجمالي مبيعات اليوم</div>
          </div>
          <div className="stat-card stat-success">
            <TrendingUp size={20} className="stat-icon" />
            <div className="stat-value">{(summary.todayProfit ?? 0).toFixed(2)}</div>
            <div className="stat-label">أرباح اليوم</div>
          </div>
          <div className="stat-card stat-warning">
            <PackageX size={20} className="stat-icon" />
            <div className="stat-value">{summary.lowStockCount}</div>
            <div className="stat-label">منتجات منخفضة المخزون</div>
          </div>
          <div className="stat-card stat-danger">
            <CalendarClock size={20} className="stat-icon" />
            <div className="stat-value">{summary.expiringSoonCount ?? 0}</div>
            <div className="stat-label">أصناف قربت تنتهي (30 يوم)</div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h3><Trophy size={17} className="page-header-icon" /> الأكثر مبيعًا</h3>
        <select value={topDays} onChange={(e) => setTopDays(Number(e.target.value))} className="inline-select">
          <option value={7}>آخر 7 أيام</option>
          <option value={30}>آخر 30 يوم</option>
          <option value={90}>آخر 90 يوم</option>
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>المنتج</th>
            <th>الكمية المباعة</th>
            <th>الإيراد</th>
            <th>الربح</th>
          </tr>
        </thead>
        <tbody>
          {topLoading && <SkeletonRows columns={5} rows={5} />}
          {!topLoading && topProducts.map((p, i) => (
            <tr key={p.productId || i}>
              <td>{i + 1}</td>
              <td>{p.name}</td>
              <td>{p.totalQuantity}</td>
              <td>{p.totalRevenue.toFixed(2)}</td>
              <td className="profit-cell">{p.totalProfit.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!topLoading && topProducts.length === 0 && (
        <EmptyState icon={Trophy} title="مفيش مبيعات في الفترة دي" subtitle="جرّب فترة زمنية أطول" />
      )}

      <div className="reports-invoices-link">
        <Link to="/admin/invoices" className="btn btn-secondary">
          عرض كل الفواتير بالتفصيل <ArrowLeft size={15} />
        </Link>
      </div>
    </div>
  );
}
