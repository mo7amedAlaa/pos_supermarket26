import { useState } from "react";
import {
  useGetSummaryQuery,
  useGetTopProductsQuery,
} from "../../store/apiSlice";
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

const STAT_CARDS_BASE = "flex flex-col gap-2 rounded-xl border p-4";

export default function ReportsPage() {
  const [topDays, setTopDays] = useState(30);

  const { data: summary } = useGetSummaryQuery();
  const { data: topProducts = [], isLoading: topLoading } =
    useGetTopProductsQuery({ days: topDays, limit: 8 });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800">
          <BarChart3 size={20} className="text-emerald-600" />
          التقارير والمبيعات
        </h2>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          مباشر
        </span>
      </div>

      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className={`${STAT_CARDS_BASE} border-zinc-200 bg-white`}>
            <Receipt size={18} className="text-zinc-400" />
            <div className="text-2xl font-semibold text-zinc-800">
              {summary.todaySalesCount}
            </div>
            <div className="text-xs text-zinc-500">عدد فواتير اليوم</div>
          </div>
          <div className={`${STAT_CARDS_BASE} border-zinc-200 bg-white`}>
            <Wallet size={18} className="text-zinc-400" />
            <div className="text-2xl font-semibold text-zinc-800">
              {summary.todaySalesTotal.toFixed(2)}
            </div>
            <div className="text-xs text-zinc-500">إجمالي مبيعات اليوم</div>
          </div>
          <div
            className={`${STAT_CARDS_BASE} border-emerald-200 bg-emerald-50/50`}
          >
            <TrendingUp size={18} className="text-emerald-600" />
            <div className="text-2xl font-semibold text-emerald-700">
              {(summary.todayProfit ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-emerald-700/70">أرباح اليوم</div>
          </div>
          <div className={`${STAT_CARDS_BASE} border-amber-200 bg-amber-50/50`}>
            <PackageX size={18} className="text-amber-600" />
            <div className="text-2xl font-semibold text-amber-700">
              {summary.lowStockCount}
            </div>
            <div className="text-xs text-amber-700/70">
              منتجات منخفضة المخزون
            </div>
          </div>
          <div className={`${STAT_CARDS_BASE} border-red-200 bg-red-50/50`}>
            <CalendarClock size={18} className="text-red-600" />
            <div className="text-2xl font-semibold text-red-700">
              {summary.expiringSoonCount ?? 0}
            </div>
            <div className="text-xs text-red-700/70">
              أصناف قربت تنتهي (30 يوم)
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-800">
          <Trophy size={17} className="text-emerald-600" />
          الأكثر مبيعًا
        </h3>
        <select
          value={topDays}
          onChange={(e) => setTopDays(Number(e.target.value))}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value={7}>آخر 7 أيام</option>
          <option value={30}>آخر 30 يوم</option>
          <option value={90}>آخر 90 يوم</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">المنتج</th>
              <th className="px-4 py-3">الكمية المباعة</th>
              <th className="px-4 py-3">الإيراد</th>
              <th className="px-4 py-3">الربح</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {topLoading && <SkeletonRows columns={5} rows={5} />}
            {!topLoading &&
              topProducts.map((p, i) => (
                <tr key={p.productId || i} className="hover:bg-zinc-50/70">
                  <td className="px-4 py-2.5 text-zinc-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-zinc-800">
                    {p.name}
                  </td>
                  <td className="px-4 py-2.5">{p.totalQuantity}</td>
                  <td className="px-4 py-2.5">{p.totalRevenue.toFixed(2)}</td>
                  <td className="px-4 py-2.5 font-medium text-emerald-700">
                    {p.totalProfit.toFixed(2)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!topLoading && topProducts.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="مفيش مبيعات في الفترة دي"
          subtitle="جرّب فترة زمنية أطول"
        />
      )}

      <div className="mt-6 flex justify-end">
        <Link
          to="/admin/invoices"
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          عرض كل الفواتير بالتفصيل <ArrowLeft size={15} />
        </Link>
      </div>
    </div>
  );
}
