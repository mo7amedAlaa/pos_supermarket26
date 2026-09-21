import { forwardRef } from "react";

const InvoicePrint = forwardRef(({ invoice }, ref) => {
  if (!invoice) return null;

  return (
    <div ref={ref} className="receipt">
      <h2>سوبر ماركت</h2>
      <p>فاتورة رقم: {invoice.invoiceNumber}</p>
      <p>{new Date(invoice.createdAt).toLocaleString("ar-EG")}</p>
      <hr />
      <table className="receipt-table">
        <thead>
          <tr>
            <th>الصنف</th>
            <th>سعر</th>
            <th>كمية</th>
            <th>إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i}>
              <td>{item.name}</td>
              <td>
                {item.price.toFixed(2)}
                {item.isWeighted ? "/كجم" : ""}
              </td>
              <td>
                {item.isWeighted ? `${item.quantity.toFixed(3)} كجم` : item.quantity}
              </td>
              <td>{item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <p>المجموع: {invoice.total.toFixed(2)}</p>
      {invoice.discount > 0 && <p>الخصم: {invoice.discount.toFixed(2)}</p>}
      {invoice.tax > 0 && <p>الضريبة: {invoice.tax.toFixed(2)}</p>}
      <p className="receipt-grand-total">الإجمالي النهائي: {invoice.grandTotal.toFixed(2)}</p>
      <p>طريقة الدفع: {invoice.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</p>
      {invoice.paymentMethod === "cash" && (
        <>
          <p>المدفوع: {invoice.amountPaid?.toFixed(2)}</p>
          <p>الباقي: {invoice.change?.toFixed(2)}</p>
        </>
      )}
      <hr />
      <p className="receipt-thanks">شكراً لتسوقكم معنا</p>
    </div>
  );
});

export default InvoicePrint;
