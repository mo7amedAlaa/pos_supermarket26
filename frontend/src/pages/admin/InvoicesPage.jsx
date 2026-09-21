import { useState } from "react";
import { useGetInvoicesQuery, useGetInvoiceQuery } from "../../store/apiSlice";
import Modal from "../../components/Modal";
import SkeletonRows from "../../components/SkeletonRows";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { Receipt, FileX, ChevronRight, ChevronLeft, User, CreditCard, Wallet } from "lucide-react";

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
  const { data: detail, isFetching: detailLoading } = useGetInvoiceQuery(selectedId, { skip: !selectedId });

  const openDetail = (id) => setSelectedId(id);

  return (
    <div>
      <div className="page-header">
        <h2><Receipt size={20} className="page-header-icon" /> الفواتير</h2>
        <span className="muted small">{total} فاتورة إجمالًا</span>
      </div>

      {loadError ? (
        <ErrorState message="تعذر تحميل الفواتير" onRetry={load} />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>الكاشير</th>
              <th>عدد الأصناف</th>
              <th>الإجمالي</th>
              <th>الربح</th>
              <th>طريقة الدفع</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows columns={7} rows={8} />}
            {!loading && invoices.map((inv) => (
              <tr key={inv._id} className="cursor-pointer" onClick={() => openDetail(inv._id)}>
                <td className="mono">{inv.invoiceNumber}</td>
                <td>{inv.cashier?.name}</td>
                <td>{inv.items.length}</td>
                <td>{inv.grandTotal.toFixed(2)}</td>
                <td className="profit-cell">{(inv.profit ?? 0).toFixed(2)}</td>
                <td>{inv.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</td>
                <td>{new Date(inv.createdAt).toLocaleString("ar-EG")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !loadError && invoices.length === 0 && (
        <EmptyState icon={FileX} title="لا توجد فواتير بعد" subtitle="أول عملية بيع من شاشة الكاشير هتظهر هنا" />
      )}

      {pages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronRight size={15} /> السابق
          </button>
          <span className="muted">صفحة {page} من {pages}</span>
          <button className="btn btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            التالي <ChevronLeft size={15} />
          </button>
        </div>
      )}

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} wide>
        {detailLoading && (
          <div className="picker-loading"><Spinner size={26} /></div>
        )}
        {!detailLoading && detail && (
          <>
            <h3>فاتورة رقم {detail.invoiceNumber}</h3>
            <div className="invoice-detail-meta">
              <span><User size={14} /> {detail.cashier?.name}</span>
              <span>{detail.paymentMethod === "cash" ? <Wallet size={14} /> : <CreditCard size={14} />} {detail.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</span>
              <span className="muted small">{new Date(detail.createdAt).toLocaleString("ar-EG")}</span>
            </div>

            <table className="table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>سعر الوحدة</th>
                  <th>الكمية</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      {item.name}
                      {item.isWeighted && <span className="badge badge-weight">وزن</span>}
                    </td>
                    <td>{item.price.toFixed(2)}{item.isWeighted ? "/كجم" : ""}</td>
                    <td>{item.isWeighted ? `${item.quantity.toFixed(3)} كجم` : item.quantity}</td>
                    <td>{item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="totals-row"><span>الإجمالي الفرعي</span><span>{detail.total.toFixed(2)}</span></div>
            {detail.discount > 0 && <div className="totals-row"><span>الخصم</span><span>-{detail.discount.toFixed(2)}</span></div>}
            {detail.tax > 0 && <div className="totals-row"><span>الضريبة</span><span>+{detail.tax.toFixed(2)}</span></div>}
            <div className="totals-row totals-grand"><span>الإجمالي النهائي</span><span>{detail.grandTotal.toFixed(2)}</span></div>
            <div className="totals-row"><span>تكلفة البضاعة</span><span>{(detail.totalCost ?? 0).toFixed(2)}</span></div>
            <div className="totals-row"><span className="profit-cell">صافي الربح</span><span className="profit-cell">{(detail.profit ?? 0).toFixed(2)}</span></div>
            {detail.paymentMethod === "cash" && (
              <>
                <div className="totals-row"><span>المدفوع</span><span>{(detail.amountPaid ?? 0).toFixed(2)}</span></div>
                <div className="totals-row"><span>الباقي</span><span>{(detail.change ?? 0).toFixed(2)}</span></div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedId(null)}>إغلاق</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
