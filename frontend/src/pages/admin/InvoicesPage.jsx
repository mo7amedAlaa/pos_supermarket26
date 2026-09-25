import { useState } from "react";
import { useGetInvoicesQuery, useGetInvoiceQuery } from "../../store/apiSlice";
import Modal from "../../components/Modal";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import {
  Receipt,
  FileX,
  ChevronRight,
  ChevronLeft,
  User,
  CreditCard,
  Wallet,
} from "lucide-react";

const btnSecondary =
  "flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

const totalsRow =
  "flex items-center justify-between py-1.5 text-sm text-zinc-500";

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const limit = 25;
  const [selectedId, setSelectedId] = useState(null);

  const {
    data: invoicesData,
    isLoading: loading,
    isError: loadError,
    refetch: load,
  } = useGetInvoicesQuery({ page, limit });
  const invoices = invoicesData?.data ?? [];
  const pages = invoicesData?.pages ?? 1;
  const total = invoicesData?.total ?? 0;

  // بيتشغّل بس لما selectedId يتحدد (skip بيمنع أي طلب قبل كده)، وبيتخزن
  // في الكاش - لو المستخدم فتح نفس الفاتورة تاني، هتظهر فورًا من الكاش
  const { data: detail, isFetching: detailLoading } = useGetInvoiceQuery(
    selectedId,
    { skip: !selectedId },
  );

  const openDetail = (id) => setSelectedId(id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800">
          <Receipt size={20} className="text-emerald-600" />
          الفواتير
        </h2>
        <span className="text-xs text-zinc-400">{total} فاتورة إجمالًا</span>
      </div>

      {loadError ? (
        <ErrorState message="تعذر تحميل الفواتير" onRetry={load} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">رقم الفاتورة</th>
                <th className="px-4 py-3">الكاشير</th>
                <th className="px-4 py-3">عدد الأصناف</th>
                <th className="px-4 py-3">الإجمالي</th>
                <th className="px-4 py-3">الربح</th>
                <th className="px-4 py-3">طريقة الدفع</th>
                <th className="px-4 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <SkeletonRows columns={7} rows={8} />}
              {!loading &&
                invoices.map((inv) => (
                  <tr
                    key={inv._id}
                    className="cursor-pointer transition hover:bg-emerald-50/40"
                    onClick={() => openDetail(inv._id)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-2.5">{inv.cashier?.name}</td>
                    <td className="px-4 py-2.5">{inv.items.length}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-800">
                      {inv.grandTotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-emerald-700">
                      {(inv.profit ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      {inv.paymentMethod === "cash" ? "نقدي" : "بطاقة"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">
                      {new Date(inv.createdAt).toLocaleString("ar-EG")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && invoices.length === 0 && (
        <EmptyState
          icon={FileX}
          title="لا توجد فواتير بعد"
          subtitle="أول عملية بيع من شاشة الكاشير هتظهر هنا"
        />
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            className={btnSecondary}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronRight size={15} /> السابق
          </button>
          <span className="text-sm text-zinc-400">
            صفحة {page} من {pages}
          </span>
          <button
            className={btnSecondary}
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي <ChevronLeft size={15} />
          </button>
        </div>
      )}

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} wide>
        {detailLoading && (
          <div className="flex justify-center py-10">
            <Spinner size={26} />
          </div>
        )}
        {!detailLoading && detail && (
          <>
            <h3 className="text-base font-semibold text-zinc-800">
              فاتورة رقم {detail.invoiceNumber}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5">
                <User size={14} /> {detail.cashier?.name}
              </span>
              <span className="flex items-center gap-1.5">
                {detail.paymentMethod === "cash" ? (
                  <Wallet size={14} />
                ) : (
                  <CreditCard size={14} />
                )}
                {detail.paymentMethod === "cash" ? "نقدي" : "بطاقة"}
              </span>
              <span className="text-xs text-zinc-400">
                {new Date(detail.createdAt).toLocaleString("ar-EG")}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                    <th className="px-3 py-2.5">الصنف</th>
                    <th className="px-3 py-2.5">سعر الوحدة</th>
                    <th className="px-3 py-2.5">الكمية</th>
                    <th className="px-3 py-2.5">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {detail.items.map((item, i) => (
                    <tr key={i}>
                      <td className="flex items-center gap-1.5 px-3 py-2">
                        {item.name}
                        {item.isWeighted && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            وزن
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {item.price.toFixed(2)}
                        {item.isWeighted ? "/كجم" : ""}
                      </td>
                      <td className="px-3 py-2">
                        {item.isWeighted
                          ? `${item.quantity.toFixed(3)} كجم`
                          : item.quantity}
                      </td>
                      <td className="px-3 py-2">{item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
              <div className={totalsRow}>
                <span>الإجمالي الفرعي</span>
                <span>{detail.total.toFixed(2)}</span>
              </div>
              {detail.discount > 0 && (
                <div className={totalsRow}>
                  <span>الخصم</span>
                  <span>-{detail.discount.toFixed(2)}</span>
                </div>
              )}
              {detail.tax > 0 && (
                <div className={totalsRow}>
                  <span>الضريبة</span>
                  <span>+{detail.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 text-base font-semibold text-zinc-900">
                <span>الإجمالي النهائي</span>
                <span>{detail.grandTotal.toFixed(2)}</span>
              </div>
              <div className={totalsRow}>
                <span>تكلفة البضاعة</span>
                <span>{(detail.totalCost ?? 0).toFixed(2)}</span>
              </div>
              <div className={`${totalsRow} font-medium text-emerald-700`}>
                <span>صافي الربح</span>
                <span>{(detail.profit ?? 0).toFixed(2)}</span>
              </div>
              {detail.paymentMethod === "cash" && (
                <>
                  <div className={totalsRow}>
                    <span>المدفوع</span>
                    <span>{(detail.amountPaid ?? 0).toFixed(2)}</span>
                  </div>
                  <div className={totalsRow}>
                    <span>الباقي</span>
                    <span>{(detail.change ?? 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end border-t border-zinc-100 pt-4">
              <button
                className={btnSecondary}
                onClick={() => setSelectedId(null)}
              >
                إغلاق
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
