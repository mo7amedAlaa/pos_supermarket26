import { forwardRef } from "react";

const InvoicePrint = forwardRef(({ invoice }, ref) => {
  if (!invoice) return null;

  return (
    <div
      ref={ref}
      className="mx-auto w-[300px] font-mono text-[13px] leading-relaxed text-zinc-800 print:w-full"
    >
      <div className="text-center">
        <h2 className="text-base font-bold">سوبر ماركت</h2>
        <p className="text-zinc-500">فاتورة رقم: {invoice.invoiceNumber}</p>
        <p className="text-zinc-500">
          {new Date(invoice.createdAt).toLocaleString("ar-EG")}
        </p>
      </div>

      <div className="my-2.5 border-t border-dashed border-zinc-300" />

      <table className="w-full text-right">
        <thead>
          <tr className="border-b border-zinc-300 text-xs text-zinc-500">
            <th className="pb-1 font-normal">الصنف</th>
            <th className="pb-1 font-normal">سعر</th>
            <th className="pb-1 font-normal">كمية</th>
            <th className="pb-1 font-normal">إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i}>
              <td className="py-0.5">{item.name}</td>
              <td className="py-0.5">
                {item.price.toFixed(2)}
                {item.isWeighted ? "/كجم" : ""}
              </td>
              <td className="py-0.5">
                {item.isWeighted
                  ? `${item.quantity.toFixed(3)} كجم`
                  : item.quantity}
              </td>
              <td className="py-0.5">{item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2.5 border-t border-dashed border-zinc-300" />

      <div className="space-y-0.5">
        <p className="flex justify-between">
          <span>المجموع</span>
          <span>{invoice.total.toFixed(2)}</span>
        </p>
        {invoice.discount > 0 && (
          <p className="flex justify-between text-zinc-500">
            <span>الخصم</span>
            <span>-{invoice.discount.toFixed(2)}</span>
          </p>
        )}
        {invoice.tax > 0 && (
          <p className="flex justify-between text-zinc-500">
            <span>الضريبة</span>
            <span>{invoice.tax.toFixed(2)}</span>
          </p>
        )}
        <p className="flex justify-between border-t border-zinc-300 pt-1 text-base font-bold">
          <span>الإجمالي النهائي</span>
          <span>{invoice.grandTotal.toFixed(2)}</span>
        </p>
        <p className="flex justify-between pt-1 text-zinc-500">
          <span>طريقة الدفع</span>
          <span>{invoice.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</span>
        </p>
        {invoice.paymentMethod === "cash" && (
          <>
            <p className="flex justify-between text-zinc-500">
              <span>المدفوع</span>
              <span>{invoice.amountPaid?.toFixed(2)}</span>
            </p>
            <p className="flex justify-between text-zinc-500">
              <span>الباقي</span>
              <span>{invoice.change?.toFixed(2)}</span>
            </p>
          </>
        )}
      </div>

      <div className="my-2.5 border-t border-dashed border-zinc-300" />

      <p className="text-center text-xs text-zinc-500">شكراً لتسوقكم معنا</p>
    </div>
  );
});

export default InvoicePrint;
